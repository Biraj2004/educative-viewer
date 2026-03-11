"""
backend/app.py

Simple Flask API server for the Educative scraper database.

Endpoints  (all POST, params via JSON body)
---------
POST /courses                   → list of all courses  body: {}
POST /course                    → toc for a course     body: {"course_id": 1}
POST /topic                     → topic components     body: {"course_id": 1, "topic_index": 3}
POST /notify                    → trigger Next.js cache revalidation
                                  body: {"tag": "courses"} or {"course_id": 1} or {"course_id": 1, "topic_index": 3}
                                  optional: {"secret": "..."}  (falls back to NOTIFY_SECRET env var)

Webhook / cache-busting
-----------------------
Set these env vars (or a .env file) before running:

    NEXTJS_WEBHOOK_URL  = http://localhost:3000/api/revalidate
    REVALIDATE_SECRET   = some-shared-secret   (must match Next.js REVALIDATE_SECRET)
    NOTIFY_SECRET       = secret that callers must send to /notify
    WATCH_DB_CHANGES    = 1   (enable background DB change watcher, default off)
    WATCH_INTERVAL      = 10  (seconds between DB polls, default 10)

    The watcher queries the DB directly — it detects exactly which courses/topics
    changed and fires only the relevant Next.js cache tags instead of blasting all.

Run
---
    python backend/app.py
"""

import json
import logging
import hashlib
import os
import re
import sqlite3
import base64
import io
import threading
import time
import uuid
import urllib.request
import urllib.error
from pathlib import Path
from waitress import serve

import bcrypt
import jwt as pyjwt
import pyotp
import segno
from flask import Flask, jsonify, request, abort

# ── Load .env file if present (python-dotenv optional) ───────────────────── #

_env_path = Path(__file__).parent / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    # dotenv not installed — parse the .env file manually (key=value lines)
    if _env_path.exists():
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _, _v = _line.partition("=")
                    _v = _v.strip()
                    if len(_v) >= 2 and _v[0] == _v[-1] and _v[0] in ('"', "'"):
                        _v = _v[1:-1]
                    os.environ.setdefault(_k.strip(), _v)

# ── Configuration ─────────────────────────────────────────────────────────── #

DB_PATH            = os.environ.get("DB_PATH", r"/path/to/educative_scraper.db")
NEXTJS_WEBHOOK_URL = os.environ.get("NEXTJS_WEBHOOK_URL", "http://localhost:3000/webhook")
REVALIDATE_SECRET  = os.environ.get("REVALIDATE_SECRET", "")   # shared with Next.js
NOTIFY_SECRET      = os.environ.get("NOTIFY_SECRET", "")       # protects /notify
WATCH_DB_CHANGES   = os.environ.get("WATCH_DB_CHANGES", "0") == "1"
WATCH_INTERVAL     = int(os.environ.get("WATCH_INTERVAL", "10"))
DEBOUNCE_DELAY     = int(os.environ.get("DEBOUNCE_DELAY", "15"))  # seconds of quiet before flushing

# ── Auth configuration ────────────────────────────────────────────────────── #

_auth_db_env = os.environ.get("AUTH_DB_PATH", "").strip()
AUTH_DB_PATH          = _auth_db_env if _auth_db_env else str(Path(__file__).parent / "users.db")
JWT_SECRET            = os.environ.get("JWT_SECRET", "changeme-dev-secret")
JWT_EXPIRES_DAYS      = int(os.environ.get("JWT_EXPIRES_DAYS", "7"))
TOTP_ISSUER           = os.environ.get("TOTP_ISSUER", "EduViewer")
CLIENT_SERVER_SECRET  = os.environ.get("CLIENT_SERVER_SECRET", "cs-internal-dev-secret-change-in-prod")
# Comma-separated list of valid invite codes; empty = accept any non-empty code (dev mode)
_raw_codes       = os.environ.get("INVITE_CODES", "")
INVITE_CODES: set = {c.strip() for c in _raw_codes.split(",") if c.strip()}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────── #

app = Flask(__name__)


@app.after_request
def _log_request(response):
    log.info("%s %s → %s", request.method, request.full_path.rstrip("?"), response.status_code)
    return response


def get_db():
    """Open a short-lived SQLite connection (row_factory = dict-like rows)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


# ── Helpers ───────────────────────────────────────────────────────────────── #

def _rows_to_list(rows):
    return [dict(r) for r in rows]


def _require(payload, *keys):
    """Abort 400 if any key is missing from the JSON payload."""
    missing = [k for k in keys if k not in payload]
    if missing:
        abort(400, description=f"Missing required field(s): {', '.join(missing)}")


def _require_service_token():
    """Validate the internal client-server JWT on data API routes.
    The Next.js server generates a short-lived (60 s) JWT signed with
    CLIENT_SERVER_SECRET for every server-side fetch of course/topic data.
    This prevents arbitrary public clients from hitting the data endpoints.
    """
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        abort(401, description="Service token required")
    try:
        payload = pyjwt.decode(token, CLIENT_SERVER_SECRET, algorithms=["HS256"])
        if payload.get("role") != "service":
            abort(403, description="Invalid service token role")
    except pyjwt.ExpiredSignatureError:
        abort(401, description="Service token expired")
    except pyjwt.PyJWTError:
        abort(401, description="Invalid service token")


# ── API 1: GET /courses ──────────────────────────────────────────────────── #

@app.route("/courses", methods=["GET"])
def get_all_courses():
    """Return all courses: id, slug, title, type.  Body: {} (no fields required)"""
    _require_service_token()
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, slug, title, type FROM courses ORDER BY id"
        ).fetchall()
        return jsonify(_rows_to_list(rows))
    finally:
        conn.close()


# ── API 2: POST /course-details ─────────────────────────────────────────── #

@app.route("/course-details", methods=["POST"])
def get_course_data():
    """Return toc_json for a course.  Body: {"course_id": <int>}"""
    _require_service_token()
    payload = request.get_json(force=True, silent=True) or {}
    _require(payload, "course_id")
    course_id = int(payload["course_id"])

    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, slug, title, type, toc_json FROM courses WHERE id = ?",
            (course_id,)
        ).fetchone()

        if not row:
            abort(404, description=f"Course id={course_id} not found")

        d = dict(row)
        d["toc"] = json.loads(d.pop("toc_json") or "[]")
        return jsonify(d)
    finally:
        conn.close()


# ── API 3: POST /topic-details ──────────────────────────────────────────── #

@app.route("/topic-details", methods=["POST"])
def get_topic_data():
    """Return all components for a topic, combined in order.
    Body: {"course_id": <int>, "topic_index": <int>}
    """
    _require_service_token()
    payload = request.get_json(force=True, silent=True) or {}
    _require(payload, "course_id", "topic_index")
    course_id   = int(payload["course_id"])
    topic_index = int(payload["topic_index"])

    conn = get_db()
    try:
        topic = conn.execute(
            """
            SELECT topic_name, topic_slug, topic_url, api_url, status
            FROM topics
            WHERE course_id = ? AND topic_index = ?
            """,
            (course_id, topic_index)
        ).fetchone()

        if not topic:
            abort(404, description=f"Topic course_id={course_id} topic_index={topic_index} not found")

        comp_rows = conn.execute(
            """
            SELECT component_index, type, content_json
            FROM components
            WHERE course_id = ? AND topic_index = ?
            ORDER BY component_index
            """,
            (course_id, topic_index)
        ).fetchall()

        components = [
            {
                "index":   row["component_index"],
                "type":    row["type"],
                "content": json.loads(row["content_json"] or "{}"),
            }
            for row in comp_rows
        ]

        return jsonify({
            "course_id":   course_id,
            "topic_index": topic_index,
            "topic_name":  topic["topic_name"],
            "topic_slug":  topic["topic_slug"],
            "topic_url":   topic["topic_url"],
            "api_url":     topic["api_url"],
            "status":      topic["status"],
            "components":  components,
        })
    finally:
        conn.close()



# ── Webhook / cache revalidation ──────────────────────────────────────────── #

def _call_revalidate(tag: str) -> bool:
    """Fire-and-forget POST to Next.js /api/revalidate with the given tag."""
    if not NEXTJS_WEBHOOK_URL:
        return False
    payload = json.dumps({"tag": tag, "secret": REVALIDATE_SECRET}).encode()
    req = urllib.request.Request(
        NEXTJS_WEBHOOK_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; edu-cache-watcher/1.0)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            log.info("Revalidated tag=%r → %s", tag, resp.status)
            return True
    except urllib.error.URLError as exc:
        log.warning("Failed to revalidate tag=%r: %s", tag, exc)
        return False


def notify_course(course_id: int):
    """Revalidate all cached data for a specific course (detail + all its topics)."""
    _call_revalidate(f"course-{course_id}")


def notify_topic(course_id: int, topic_index: int):
    """Revalidate a single topic's cached data."""
    _call_revalidate(f"topic-{course_id}-{topic_index}")


def notify_courses_list():
    """Revalidate the top-level courses list."""
    _call_revalidate("courses")


# ── POST /notify ────────────────────────────────────────────────────────── #

@app.route("/notify", methods=["POST"])
def notify():
    """
    Trigger Next.js cache revalidation.

    Body (JSON):
      { "secret": "...",          ← optional if NOTIFY_SECRET not set
        "tag": "courses"  }       ← explicit tag   OR
      { "course_id": 42   }       ← revalidate one course   OR
      { "course_id": 42,
        "topic_index": 3  }       ← revalidate one topic

    Called by the scraper (or any external process) after DB writes.
    """
    payload = request.get_json(force=True, silent=True) or {}

    # Authenticate if secret is configured
    if NOTIFY_SECRET and payload.get("secret") != NOTIFY_SECRET:
        abort(401, description="Invalid or missing notify secret")

    ok = False
    if "tag" in payload:
        ok = _call_revalidate(str(payload["tag"]))
    elif "course_id" in payload and "topic_index" in payload:
        notify_topic(int(payload["course_id"]), int(payload["topic_index"]))
        ok = True
    elif "course_id" in payload:
        notify_course(int(payload["course_id"]))
        ok = True
    else:
        abort(400, description="Provide 'tag', 'course_id', or 'course_id'+'topic_index'")

    return jsonify({"notified": ok})


# ── Background DB change watcher ──────────────────────────────────────────── #

def _row_hash(data) -> str:
    """Return an MD5 hex digest of the repr of *data* (list/tuple of row values)."""
    return hashlib.md5(repr(data).encode()).hexdigest()


def _snapshot(conn):
    """
    Read the current state of the DB into a dict we can diff against later.
    All values are content-hashes so that UPDATE operations are detected, not
    just INSERT operations (rowids do not change on UPDATE).

    Returns:
        {
          "courses":    { id: hash_of_all_fields },
          "topics":     { (course_id, topic_index): hash_of_all_fields },
          "components": { (course_id, topic_index): hash_of_all_components },
        }
    """
    snap = {"courses": {}, "topics": {}, "components": {}}

    try:
        for row in conn.execute("SELECT * FROM courses ORDER BY id"):
            snap["courses"][row[0]] = _row_hash(tuple(row))

        for row in conn.execute(
            "SELECT * FROM topics ORDER BY course_id, topic_index, rowid"
        ):
            snap["topics"][(row["course_id"], row["topic_index"])] = _row_hash(tuple(row))

        # Aggregate all component rows per (course_id, topic_index) so that
        # any insert, update, or delete inside a topic is detected.
        comp_rows: dict = {}
        for row in conn.execute(
            "SELECT * FROM components ORDER BY course_id, topic_index, rowid"
        ):
            key = (row["course_id"], row["topic_index"])
            comp_rows.setdefault(key, []).append(tuple(row))
        for key, rows in comp_rows.items():
            snap["components"][key] = _row_hash(rows)
    except sqlite3.OperationalError:
        pass  # tables may not exist yet

    return snap


def _db_watcher():
    """
    Poll the DB every WATCH_INTERVAL seconds.
    Dirty tags are accumulated in a set; the webhook is only flushed after
    DEBOUNCE_DELAY seconds of no new changes (i.e. the scraper has gone quiet).

      • New course row          → queues "courses" + "course-{id}"
      • New/changed topic row   → queues "course-{id}" + "topic-{id}-{index}"
      • New/changed component   → queues "topic-{id}-{index}"

    Enable with: WATCH_DB_CHANGES=1
    """
    log.info(
        "DB watcher started (poll=%ds, debounce=%ds, db=%s)",
        WATCH_INTERVAL, DEBOUNCE_DELAY, DB_PATH,
    )

    # Wait for the DB file to exist before taking the first snapshot
    prev = {"courses": {}, "topics": {}, "components": {}}
    while not os.path.exists(DB_PATH):
        log.info("DB watcher: waiting for DB file…")
        time.sleep(WATCH_INTERVAL)

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        prev = _snapshot(conn)
        conn.close()
        log.info(
            "DB watcher: initial snapshot — %d courses, %d topics",
            len(prev["courses"]), len(prev["topics"]),
        )
    except Exception as exc:
        log.warning("DB watcher: could not take initial snapshot: %s", exc)

    pending_tags: set = set()   # tags waiting to be flushed
    last_change_at: float = 0   # time.time() of last detected change

    while True:
        time.sleep(WATCH_INTERVAL)
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            curr = _snapshot(conn)
            conn.close()
        except Exception as exc:
            log.warning("DB watcher: error reading DB: %s", exc)
            continue

        dirty_courses: set = set()   # deduplicate course tags within this poll
        any_dirty = False

        # ── New or changed courses ────────────────────────────────────────── #
        prev_course_ids = set(prev["courses"])
        curr_course_ids = set(curr["courses"])
        new_course_ids = curr_course_ids - prev_course_ids
        changed_course_ids = {
            cid for cid in curr_course_ids & prev_course_ids
            if curr["courses"][cid] != prev["courses"][cid]
        }
        if new_course_ids:
            log.info("DB watcher: new courses %s detected", new_course_ids)
            pending_tags.add("courses")
            for cid in new_course_ids:
                pending_tags.add(f"course-{cid}")
                dirty_courses.add(cid)
                any_dirty = True
        if changed_course_ids:
            log.info("DB watcher: changed courses %s detected", changed_course_ids)
            pending_tags.add("courses")
            for cid in changed_course_ids:
                pending_tags.add(f"course-{cid}")
                dirty_courses.add(cid)
                any_dirty = True

        # ── New or changed topics ─────────────────────────────────────────── #
        for key, h in curr["topics"].items():
            course_id, topic_index = key
            if prev["topics"].get(key) != h:
                log.info(
                    "DB watcher: topic changed course_id=%d topic_index=%d",
                    course_id, topic_index,
                )
                pending_tags.add(f"topic-{course_id}-{topic_index}")
                if course_id not in dirty_courses:
                    pending_tags.add(f"course-{course_id}")
                    dirty_courses.add(course_id)
                any_dirty = True

        # ── New or changed components ─────────────────────────────────────── #
        for key, h in curr["components"].items():
            course_id, topic_index = key
            if prev["components"].get(key) != h:
                log.info(
                    "DB watcher: components changed course_id=%d topic_index=%d",
                    course_id, topic_index,
                )
                pending_tags.add(f"topic-{course_id}-{topic_index}")
                any_dirty = True

        prev = curr

        # Mark the time of last change if new tags were queued this poll
        if any_dirty or (pending_tags and last_change_at == 0):
            last_change_at = time.time()

        # ── Flush once the DB has been quiet for DEBOUNCE_DELAY seconds ───── #
        if pending_tags and last_change_at > 0 and (time.time() - last_change_at) >= DEBOUNCE_DELAY:
            log.info(
                "DB watcher: flushing %d pending tag(s): %s",
                len(pending_tags), pending_tags,
            )
            for tag in sorted(pending_tags):
                _call_revalidate(tag)
            pending_tags.clear()
            last_change_at = 0


# ── Entry point ───────────────────────────────────────────────────────────── #

# ── Auth DB ───────────────────────────────────────────────────────────────── #

def get_auth_db():
    """Open a short-lived connection to the auth (users) SQLite DB."""
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_auth_db():
    """Create users table if it doesn't exist."""
    os.makedirs(os.path.dirname(os.path.abspath(AUTH_DB_PATH)), exist_ok=True)
    conn = get_auth_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            email                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            name                 TEXT,
            username             TEXT,
            avatar               TEXT,
            role                 TEXT    NOT NULL DEFAULT 'user',
            password_hash        TEXT    NOT NULL,
            two_factor_enabled   INTEGER NOT NULL DEFAULT 0,
            two_factor_secret    TEXT,
            two_factor_confirmed INTEGER NOT NULL DEFAULT 0,
            session_id           TEXT,
            created_at           TEXT    NOT NULL
                DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
    """)
    # Migrate existing DB: add session_id column if missing
    try:
        conn.execute("ALTER TABLE users ADD COLUMN session_id TEXT")
        conn.commit()
        log.info("Auth DB: added session_id column")
    except Exception:
        pass  # column already exists
    conn.commit()
    conn.close()
    log.info("Auth DB ready at %s", AUTH_DB_PATH)


# ── JWT helpers ───────────────────────────────────────────────────────────── #

def _make_full_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "id":               user["id"],
        "email":            user["email"],
        "name":             user.get("name"),
        "username":         user.get("username"),
        "avatar":           user.get("avatar"),
        "role":             user.get("role", "user"),
        "twoFactorEnabled": bool(user.get("two_factor_enabled")),
        "createdAt":        user.get("created_at"),
        "sessionId":        user.get("session_id"),  # embedded for single-session enforcement
        "iat":              now,
        "exp":              now + JWT_EXPIRES_DAYS * 86400,
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _make_partial_token(user_id: int) -> str:
    """Short-lived token (10 min) issued when 2FA is required before full auth."""
    now = int(time.time())
    return pyjwt.encode(
        {"id": user_id, "partial": True, "iat": now, "exp": now + 600},
        JWT_SECRET,
        algorithm="HS256",
    )


def _decode_token(token: str) -> dict | None:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.PyJWTError:
        return None


def _bearer_token() -> str | None:
    """Extract the raw token from the Authorization: Bearer <token> header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _resolve_user(require_full: bool = True) -> tuple[dict | None, dict | None]:
    """
    Decode the Bearer token and fetch the matching user from the auth DB.

    If require_full=True  → returns (None, None) for partial tokens.
    If require_full=False → accepts both partial and full tokens.
    For full tokens, validates that the JWT session_id matches the DB session_id
    (single active session enforcement).

    Returns (user_dict, payload_dict) or (None, payload) on failure.
    """
    token = _bearer_token()
    if not token:
        return None, None
    payload = _decode_token(token)
    if not payload:
        return None, None
    if require_full and payload.get("partial"):
        return None, payload
    conn = get_auth_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (payload["id"],)).fetchone()
    finally:
        conn.close()
    if not row:
        return None, payload
    user = dict(row)
    # For full tokens: enforce single active session
    if not payload.get("partial") and user.get("session_id"):
        if payload.get("sessionId") != user["session_id"]:
            abort(401, description="Session superseded by a newer login. Please sign in again.")
    return user, payload


def _user_public(user: dict) -> dict:
    return {
        "id":               user["id"],
        "email":            user["email"],
        "name":             user.get("name"),
        "username":         user.get("username"),
        "avatar":           user.get("avatar"),
        "role":             user.get("role", "user"),
        "twoFactorEnabled": bool(user.get("two_factor_enabled")),
        "createdAt":        user.get("created_at"),
    }


# ── Error handler (JSON for all HTTP errors) ─────────────────────────────── #

@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(409)
@app.errorhandler(500)
def _json_error(e):
    return jsonify({"error": getattr(e, "description", str(e))}), e.code


# ── POST /auth/signup ───────────────────────────────────────────────────── #

@app.route("/auth/signup", methods=["POST"])
def auth_signup():
    data     = request.get_json(force=True, silent=True) or {}
    email    = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    invite   = str(data.get("inviteCode", "")).strip()
    name     = str(data.get("name", "")).strip() or None

    if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        abort(400, description="Invalid email address")
    if len(password) < 8 or len(password) > 72:
        abort(400, description="Password must be 8–72 characters")
    # Validate invite code: if INVITE_CODES list is configured, enforce it
    if INVITE_CODES and invite not in INVITE_CODES:
        abort(403, description="Invalid invite code")
    if not invite:
        abort(400, description="Invite code is required")

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    totp_secret = pyotp.random_base32()

    conn = get_auth_db()
    try:
        try:
            conn.execute(
                "INSERT INTO users (email, name, password_hash, two_factor_secret) "
                "VALUES (?, ?, ?, ?)",
                (email, name, pw_hash, totp_secret),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            abort(409, description="An account with that email already exists")

        user = dict(conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone())
    finally:
        conn.close()

    partial = _make_partial_token(user["id"])
    return jsonify({
        "token":            partial,
        "requiresTwoFactor": True,
        "message":          "Account created. Set up two-factor authentication to continue.",
    }), 201


# ── POST /auth/login ────────────────────────────────────────────────────── #

@app.route("/auth/login", methods=["POST"])
def auth_login():
    data     = request.get_json(force=True, silent=True) or {}
    email    = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        abort(400, description="Email and password are required")

    conn = get_auth_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
    finally:
        conn.close()

    # Use constant-time comparison even when user is missing (prevents timing attacks)
    dummy_hash = b"$2b$12$" + b"x" * 53
    stored_hash = row["password_hash"].encode() if row else dummy_hash
    password_ok = bcrypt.checkpw(password.encode(), stored_hash)

    if not row or not password_ok:
        abort(401, description="Invalid email or password")

    user = dict(row)

    if user["two_factor_enabled"] and user["two_factor_confirmed"]:
        return jsonify({
            "token":            _make_partial_token(user["id"]),
            "requiresTwoFactor": True,
        }), 200

    new_session_id = str(uuid.uuid4())
    conn2 = get_auth_db()
    try:
        conn2.execute("UPDATE users SET session_id = ? WHERE id = ?", (new_session_id, user["id"]))
        conn2.commit()
        user["session_id"] = new_session_id
    finally:
        conn2.close()

    return jsonify({
        "token": _make_full_token(user),
        "user":  _user_public(user),
    }), 200


# ── GET /auth/me ────────────────────────────────────────────────────────── #

@app.route("/auth/me", methods=["GET"])
def auth_me():
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Not authenticated")
    return jsonify(_user_public(user)), 200


# ── GET /auth/2fa/setup ─────────────────────────────────────────────────── #

@app.route("/auth/2fa/setup", methods=["GET"])
def auth_2fa_setup():
    user, _ = _resolve_user(require_full=False)
    if not user:
        abort(401, description="Not authenticated")

    totp_secret = user.get("two_factor_secret")
    if not totp_secret:
        totp_secret = pyotp.random_base32()
        conn = get_auth_db()
        try:
            conn.execute(
                "UPDATE users SET two_factor_secret = ? WHERE id = ?",
                (totp_secret, user["id"]),
            )
            conn.commit()
        finally:
            conn.close()

    uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=user["email"], issuer_name=TOTP_ISSUER
    )
    buf = io.BytesIO()
    segno.make_qr(uri).save(buf, kind="svg", scale=5, dark="#000")
    qr_data_url = "data:image/svg+xml;base64," + base64.b64encode(buf.getvalue()).decode()

    return jsonify({"qrCodeUrl": qr_data_url, "secret": totp_secret}), 200


# ── POST /auth/2fa/enable ───────────────────────────────────────────────── #

@app.route("/auth/2fa/enable", methods=["POST"])
def auth_2fa_enable():
    """Verify TOTP code and mark 2FA as active. Called after scanning QR during signup."""
    user, _ = _resolve_user(require_full=False)
    if not user:
        abort(401, description="Not authenticated")

    body = request.get_json(force=True, silent=True) or {}
    code = str(body.get("code", "")).strip()

    if not user.get("two_factor_secret"):
        abort(400, description="2FA setup not started. Call GET /auth/2fa/setup first.")

    if not pyotp.TOTP(user["two_factor_secret"]).verify(code, valid_window=1):
        abort(400, description="Invalid authenticator code")

    new_session_id = str(uuid.uuid4())
    conn = get_auth_db()
    try:
        conn.execute(
            "UPDATE users SET two_factor_enabled = 1, two_factor_confirmed = 1, session_id = ? WHERE id = ?",
            (new_session_id, user["id"]),
        )
        conn.commit()
        user = dict(conn.execute(
            "SELECT * FROM users WHERE id = ?", (user["id"],)
        ).fetchone())
    finally:
        conn.close()

    return jsonify({
        "token": _make_full_token(user),
        "user":  _user_public(user),
    }), 200


# ── POST /auth/2fa/verify ──────────────────────────────────────────────────── #

@app.route("/auth/2fa/verify", methods=["POST"])
def auth_2fa_verify():
    """Verify TOTP code during login when 2FA is already configured."""
    user, _ = _resolve_user(require_full=False)
    if not user:
        abort(401, description="Not authenticated")

    body = request.get_json(force=True, silent=True) or {}
    code = str(body.get("code", "")).strip()

    if not user.get("two_factor_secret") or not user.get("two_factor_confirmed"):
        abort(400, description="2FA is not configured for this account")

    if not pyotp.TOTP(user["two_factor_secret"]).verify(code, valid_window=1):
        abort(401, description="Invalid authenticator code")

    new_session_id = str(uuid.uuid4())
    conn2 = get_auth_db()
    try:
        conn2.execute("UPDATE users SET session_id = ? WHERE id = ?", (new_session_id, user["id"]))
        conn2.commit()
        user["session_id"] = new_session_id
    finally:
        conn2.close()

    return jsonify({
        "token": _make_full_token(user),
        "user":  _user_public(user),
    }), 200


# ── Entry point ───────────────────────────────────────────────────────────── #

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"

    init_auth_db()

    # When debug=True, Werkzeug launches two processes (monitor + worker).
    # Only start the watcher in the worker child to avoid duplicate webhooks.
    # In non-debug mode (no reloader) the check is always True.
    if WATCH_DB_CHANGES and (not debug_mode or os.environ.get("WERKZEUG_RUN_MAIN") == "true"):
        t = threading.Thread(target=_db_watcher, daemon=True)
        t.start()

    if debug_mode:
        app.run(host="0.0.0.0", port=5000, debug=True)
    else:
        
        log.info("Starting production server via waitress on 0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
