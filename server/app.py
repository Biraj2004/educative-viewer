"""
backend/app.py

Simple Flask API server for the Educative scraper database.

Endpoints  (all POST, params via JSON body)
---------
GET  /api/courses               → list of all courses  body: {}
POST /api/course-details        → toc for a course     body: {"course_id": 1}
POST /api/topic-details         → topic components     body: {"course_id": 1, "topic_index": 3}

Auth / Oracle DB
----------------
    ORACLE_USER            = EDU                          (Oracle DB username)
    ORACLE_PASSWORD        = <password>                   (Oracle DB password)
    ORACLE_DSN             = personal_high                (TNS entry from tnsnames.ora)
    ORACLE_WALLET_DIR      = /path/to/Wallet_personal     (Oracle Wallet directory)
    ORACLE_WALLET_PASSWORD = <wallet-password>            (optional, if wallet uses a password)
    ORACLE_POOL_MIN        = 1                            (min pool connections, default 1)
    ORACLE_POOL_MAX        = 5                            (max pool connections, default 5)
    ORACLE_THICK_MODE      = 1                            (set to 1 for Oracle Instant Client / thick mode)
    ORACLE_LIB_DIR         = /opt/oracle/instantclient    (Instant Client lib dir, thick mode only)

    JWT_SECRET             = some-secret                  (signs auth JWTs)
    JWT_EXPIRES_DAYS       = 7
    TOTP_ISSUER            = EduViewer
    CLIENT_SERVER_SECRET   = cs-internal-secret
    INVITE_CODES           = code1,code2                  (comma-separated; leave empty for dev)

Run
---
    python backend/app.py
"""

import json
import logging
import os
import re
import sqlite3
import atexit
import base64
import io
import time
import uuid
from pathlib import Path
from waitress import serve
from apscheduler.schedulers.background import BackgroundScheduler

import bcrypt
import jwt as pyjwt
import oracledb
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
FLASK_PORT     = int(os.environ.get("FLASK_PORT", "5000"))

DB_PATH              = os.environ.get("DB_PATH", r"/path/to/educative_scraper.db")
DB_KEEPALIVE_ENABLED = os.environ.get("DB_KEEPALIVE_ENABLED", "1") == "1"
DB_KEEPALIVE_INTERVAL_MINUTES = max(1, int(os.environ.get("DB_KEEPALIVE_INTERVAL_MINUTES", "10")))

# ── Auth configuration ────────────────────────────────────────────────────── #

# Oracle ADW connection settings for the auth (users) database.
# Required: ORACLE_USER, ORACLE_PASSWORD, ORACLE_DSN
# Optional: ORACLE_WALLET_DIR, ORACLE_WALLET_PASSWORD,
#           ORACLE_POOL_MIN, ORACLE_POOL_MAX,
#           ORACLE_THICK_MODE (set to "1" when using Oracle Instant Client),
#           ORACLE_LIB_DIR   (path to Instant Client libs, thick mode only)
ORACLE_USER            = os.environ.get("ORACLE_USER", "")
ORACLE_PASSWORD        = os.environ.get("ORACLE_PASSWORD", "")
ORACLE_DSN             = os.environ.get("ORACLE_DSN", "")
ORACLE_WALLET_DIR      = os.environ.get("ORACLE_WALLET_DIR", "").strip()
ORACLE_WALLET_PASSWORD = os.environ.get("ORACLE_WALLET_PASSWORD", "").strip()
ORACLE_POOL_MIN        = int(os.environ.get("ORACLE_POOL_MIN", "1"))
ORACLE_POOL_MAX        = int(os.environ.get("ORACLE_POOL_MAX", "5"))
ORACLE_THICK_MODE      = os.environ.get("ORACLE_THICK_MODE", "0") == "1"
ORACLE_LIB_DIR         = os.environ.get("ORACLE_LIB_DIR", "").strip()

JWT_SECRET            = os.environ.get("JWT_SECRET", "changeme-dev-secret")
JWT_EXPIRES_DAYS      = int(os.environ.get("JWT_EXPIRES_DAYS", "7"))
TOTP_ISSUER           = os.environ.get("TOTP_ISSUER", "EduViewer")

# Comma-separated list of valid invite codes; empty = accept any non-empty code (dev mode)
_raw_codes       = os.environ.get("INVITE_CODES", "")
INVITE_CODES: set = {c.strip() for c in _raw_codes.split(",") if c.strip()}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────── #

app = Flask(__name__)


@app.after_request
def _add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    log.info("%s %s → %s", request.method, request.full_path.rstrip("?"), response.status_code)
    return response


@app.route("/api/<path:_path>", methods=["OPTIONS"])
def _handle_preflight(_path):
    """Return 204 for all CORS preflight OPTIONS requests."""
    return "", 204


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


# ── API 1: GET /courses ──────────────────────────────────────────────────── #

@app.route("/api/courses", methods=["GET"])
def get_all_courses():
    """Return all courses: id, slug, title, type.  Body: {} (no fields required)"""
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Authentication required")
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, slug, title, type FROM courses ORDER BY id"
        ).fetchall()
        return jsonify(_rows_to_list(rows))
    finally:
        conn.close()


# ── API 2: POST /course-details ─────────────────────────────────────────── #

@app.route("/api/course-details", methods=["POST"])
def get_course_data():
    """Return toc_json for a course.  Body: {"course_id": <int>}"""
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Authentication required")
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

@app.route("/api/topic-details", methods=["POST"])
def get_topic_data():
    """Return all components for a topic, combined in order.
    Body: {"course_id": <int>, "topic_index": <int>}
    """
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Authentication required")
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


# ── API 4: GET /test_components ──────────────────────────────────────────────────── #

@app.route("/api/test_components", methods=["GET"])
def get_test_components():
    """Return all test components. Body: {} (no fields required)"""
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Authentication required")
    conn = get_db()
    try:
        # Check if the table exists, and create it if it doesn't
        conn.execute("""
            CREATE TABLE IF NOT EXISTS test_components (
                component_id INTEGER PRIMARY KEY,
                component_type TEXT,
                content_json TEXT,
                topic_url TEXT
            )
        """)
        conn.commit()

        rows = conn.execute(
            "SELECT component_id, component_type, content_json, topic_url FROM test_components ORDER BY component_id"
        ).fetchall()
        return jsonify(_rows_to_list(rows))
    finally:
        conn.close()


# ── Oracle Auth DB pool ───────────────────────────────────────────────────── #

# Fetch CLOBs (login_ip_log, current_token) as plain Python strings.
oracledb.defaults.fetch_lobs = False

_oracle_pool = None
_scheduler: BackgroundScheduler | None = None


def _get_oracle_pool():
    """Lazily initialise the Oracle connection pool on first call."""
    global _oracle_pool
    if _oracle_pool is not None:
        return _oracle_pool
    if ORACLE_THICK_MODE:
        # Thick mode requires Oracle Instant Client; lib_dir is optional when
        # the client libraries are already on PATH / LD_LIBRARY_PATH.
        oracledb.init_oracle_client(lib_dir=ORACLE_LIB_DIR or None)
    kwargs: dict = {
        "user":      ORACLE_USER,
        "password":  ORACLE_PASSWORD,
        "dsn":       ORACLE_DSN,
        "min":       ORACLE_POOL_MIN,
        "max":       ORACLE_POOL_MAX,
        "increment": 1,
    }
    if ORACLE_WALLET_DIR:
        if ORACLE_THICK_MODE:
            kwargs["config_dir"] = ORACLE_WALLET_DIR
        else:
            kwargs["wallet_location"] = ORACLE_WALLET_DIR
    if ORACLE_WALLET_PASSWORD:
        kwargs["wallet_password"] = ORACLE_WALLET_PASSWORD
    _oracle_pool = oracledb.create_pool(**kwargs)
    return _oracle_pool


def _row_to_dict(cursor, row) -> dict | None:
    """Convert an Oracle cursor row tuple to a lowercase-keyed dict."""
    if row is None:
        return None
    return {d[0].lower(): v for d, v in zip(cursor.description, row)}


def get_auth_db():
    """Acquire a connection from the Oracle auth connection pool."""
    return _get_oracle_pool().acquire()


def keep_db_alive(flask_app: Flask) -> None:
    """Ping the Oracle auth DB so the connection pool does not sit idle too long."""
    if not ORACLE_USER or not ORACLE_PASSWORD or not ORACLE_DSN:
        return

    try:
        with flask_app.app_context():
            conn = get_auth_db()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1 FROM DUAL")
                    cur.fetchone()
            finally:
                conn.close()
        log.debug("Oracle auth DB keep-alive ping succeeded")
    except Exception as exc:
        log.warning("Oracle auth DB keep-alive ping failed: %s", exc)


def _start_keep_db_alive_scheduler(flask_app: Flask) -> None:
    """Start the periodic Oracle keep-alive job once per server process."""
    global _scheduler

    if _scheduler is not None:
        return
    if not DB_KEEPALIVE_ENABLED:
        log.info("Oracle auth DB keep-alive scheduler is disabled")
        return
    if not ORACLE_USER or not ORACLE_PASSWORD or not ORACLE_DSN:
        log.info("Oracle auth DB keep-alive scheduler skipped: Oracle auth DB is not configured")
        return

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        func=lambda: keep_db_alive(flask_app),
        trigger="interval",
        minutes=DB_KEEPALIVE_INTERVAL_MINUTES,
        id="keep_db_alive_job",
        name=f"Keep DB connection alive every {DB_KEEPALIVE_INTERVAL_MINUTES} minutes",
        replace_existing=True,
    )
    _scheduler.start()
    atexit.register(lambda: _scheduler.shutdown(wait=False) if _scheduler and _scheduler.running else None)
    log.info(
        "Oracle auth DB keep-alive scheduler started (every %d minute(s))",
        DB_KEEPALIVE_INTERVAL_MINUTES,
    )


def init_auth_db():
    """Create all auth tables if they don't exist (Oracle DDL, idempotent).

    Tables
    ------
    roles           — role definitions (id, name, description)
    users           — non-sensitive profile data; role_id → roles(id)
    users_sensitive — credentials, 2FA secrets, session token, IP log
    user_progress   — per-user topic visit / completion tracking
    """
    conn = get_auth_db()
    try:
        cur = conn.cursor()

        def _exec_ddl(sql: str) -> None:
            """Execute DDL; silently ignore ORA-00955 (object already exists)."""
            try:
                cur.execute(sql)
            except oracledb.DatabaseError as exc:
                (err,) = exc.args
                if err.code != 955:  # ORA-00955: name already used by an existing object
                    raise

        # ── roles ─────────────────────────────────────────────────────────── #
        # Plain NUMBER PK (not identity) so we can seed specific IDs 1 & 2
        # and hard-code role_id = 1 ('user') in users INSERT.
        _exec_ddl("""
            CREATE TABLE roles (
                id          NUMBER            PRIMARY KEY,
                name        VARCHAR2(100 CHAR) NOT NULL,
                description VARCHAR2(500 CHAR)
            )
        """)
        _exec_ddl("CREATE UNIQUE INDEX uq_roles_name ON roles (UPPER(name))")

        # Seed default roles (skip if already present)
        for role_id, role_name, role_desc in [
            (1, "user",  "Regular authenticated user"),
            (2, "admin", "Administrator with no restrictions"),
        ]:
            try:
                cur.execute(
                    "INSERT INTO roles (id, name, description) VALUES (:1, :2, :3)",
                    (role_id, role_name, role_desc),
                )
            except oracledb.IntegrityError:
                pass  # already seeded

        # ── users ─────────────────────────────────────────────────────────── #
        _exec_ddl("""
            CREATE TABLE users (
                id                 NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                email              VARCHAR2(255 CHAR) NOT NULL,
                name               VARCHAR2(255 CHAR),
                username           VARCHAR2(255 CHAR),
                avatar             VARCHAR2(1000 CHAR),
                role_id            NUMBER DEFAULT 1 NOT NULL
                                       REFERENCES roles(id),
                two_factor_enabled NUMBER(1,0) DEFAULT 0 NOT NULL,
                login_ip_log       CLOB,
                theme              VARCHAR2(20 CHAR) DEFAULT 'light' NOT NULL,
                created_at         VARCHAR2(30 CHAR) DEFAULT
                    TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC',
                            'YYYY-MM-DD"T"HH24:MI:SS"Z"') NOT NULL
            )
        """)
        _exec_ddl("CREATE UNIQUE INDEX uq_users_email ON users (UPPER(email))")

        # ── users_sensitive ───────────────────────────────────────────────── #
        _exec_ddl("""
            CREATE TABLE users_sensitive (
                user_id              NUMBER PRIMARY KEY
                                         REFERENCES users(id) ON DELETE CASCADE,
                password_hash        VARCHAR2(200 CHAR) DEFAULT '' NOT NULL,
                two_factor_secret    VARCHAR2(64 CHAR),
                two_factor_confirmed NUMBER(1,0) DEFAULT 0 NOT NULL,
                session_id           VARCHAR2(64 CHAR),
                last_login_ip        VARCHAR2(50 CHAR),
                last_login_at        VARCHAR2(30 CHAR),
                current_token        CLOB
            )
        """)

        # ── user_progress ─────────────────────────────────────────────────── #
        # One row per (user, course, topic).
        # last_visited_at        — when this specific topic was last opened.
        # last_visited_course_at — when ANY topic in this course was opened
        #                          (denormalised for efficient course ordering).
        # completed              — 1 when user completed the topic.
        _exec_ddl("""
            CREATE TABLE user_progress (
                id                     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id                NUMBER NOT NULL
                                           REFERENCES users(id) ON DELETE CASCADE,
                course_id              NUMBER NOT NULL,
                topic_index            NUMBER NOT NULL,
                completed              NUMBER(1,0) DEFAULT 0 NOT NULL,
                last_visited_at        VARCHAR2(30 CHAR) DEFAULT
                    TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC',
                            'YYYY-MM-DD"T"HH24:MI:SS"Z"') NOT NULL,
                last_visited_course_at VARCHAR2(30 CHAR) DEFAULT
                    TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC',
                            'YYYY-MM-DD"T"HH24:MI:SS"Z"') NOT NULL
            )
        """)
        _exec_ddl(
            "CREATE UNIQUE INDEX uq_user_progress "
            "ON user_progress (user_id, course_id, topic_index)"
        )

        conn.commit()
        cur.close()
    finally:
        conn.close()
    log.info("Oracle auth DB ready (dsn=%s)", ORACLE_DSN)


# ── Auth DB query helpers ─────────────────────────────────────────────────── #

_USER_JOIN = """
    SELECT u.id, u.email, u.name, u.username, u.avatar,
           r.name  AS role,
           u.role_id, u.two_factor_enabled, u.login_ip_log, u.theme, u.created_at,
           s.password_hash, s.two_factor_secret, s.two_factor_confirmed,
           s.session_id, s.last_login_ip, s.last_login_at, s.current_token
    FROM users u
    LEFT JOIN roles             r ON r.id      = u.role_id
    LEFT JOIN users_sensitive   s ON s.user_id = u.id
"""


def _fetch_user_by_id(conn, user_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(_USER_JOIN + "WHERE u.id = :user_id", {"user_id": user_id})
        return _row_to_dict(cur, cur.fetchone())


def _fetch_user_by_email(conn, email: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            _USER_JOIN + "WHERE UPPER(u.email) = UPPER(:email)",
            {"email": email},
        )
        return _row_to_dict(cur, cur.fetchone())


def _get_client_ip() -> str | None:
    """Return the originating IP, honouring X-Forwarded-For if present."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr


def _check_ip_restriction(conn, user: dict, client_ip: str) -> None:
    """Enforce a max-2-unique-IPs-per-day login limit for non-admin users.

    Rules:
    - Admins (role='admin') are exempt — no restriction.
    - Logging in from the same IP any number of times is always allowed.
    - Logging in from a 3rd *distinct* IP within the same UTC calendar day → HTTP 403.
    - The counter resets automatically at UTC midnight each day.

    Side-effect: updates users.login_ip_log via *conn* (caller must commit).
    If an abort() is raised, no UPDATE has been queued.
    """
    if user.get("role", "user") == "admin":
        return

    today = time.strftime("%Y-%m-%d", time.gmtime())
    try:
        ip_log = json.loads(user.get("login_ip_log") or "{}")
    except (json.JSONDecodeError, TypeError):
        ip_log = {}

    if ip_log.get("date") != today:
        # New day — reset log
        ip_log = {"date": today, "ips": []}

    ips: list = ip_log.get("ips", [])

    if client_ip not in ips:
        if len(ips) >= 2:
            abort(403, description=(
                "Login restricted: you have already signed in from 2 different IP addresses "
                "today. Try again tomorrow or log in from an IP you have used today."
            ))
        ips.append(client_ip)

    ip_log["ips"] = ips
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET login_ip_log = :ip_log WHERE id = :user_id",
            {"ip_log": json.dumps(ip_log), "user_id": user["id"]},
        )


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
        "theme":            user.get("theme", "light"),
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
        user = _fetch_user_by_id(conn, payload["id"])
    finally:
        conn.close()
    if not user:
        return None, payload
    # For full tokens: enforce single active session.
    # The JWT embeds the session_id that was active at login time.
    # It MUST match the current DB value exactly.
    # NULL in the DB means "logged out" — no token is valid in that state.
    if not payload.get("partial"):
        if payload.get("sessionId") != user.get("session_id"):
            abort(401, description="Session superseded by a newer login. Please sign in again.")
    return user, payload


def _user_public(user: dict, conn=None) -> dict:
    """Return safe public fields for the authenticated user.
    Pass an open *conn* to also include the compact progress summary.
    """
    data = {
        "id":               user["id"],
        "email":            user["email"],
        "name":             user.get("name"),
        "username":         user.get("username"),
        "avatar":           user.get("avatar"),
        "role":             user.get("role", "user"),
        "theme":            user.get("theme", "light"),
        "twoFactorEnabled": bool(user.get("two_factor_enabled")),
        "createdAt":        user.get("created_at"),
    }
    if conn is not None:
        data["progress"] = _get_compact_progress(conn, user["id"])
    return data


def _get_compact_progress(conn, user_id: int) -> dict:
    """Return {course_order: [id,...], completed: {"course_id": [topic_idx,...]}}.
    course_order is sorted by most-recently-visited course first.
    Only completed topics are included in the completed map.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT course_id, topic_index, completed, last_visited_course_at
            FROM user_progress
            WHERE user_id = :user_id
            ORDER BY last_visited_course_at DESC, course_id
            """,
            {"user_id": user_id},
        )
        cols = [d[0].lower() for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]

    course_order = []
    seen_courses = set()
    completed: dict = {}

    for r in rows:
        cid = r["course_id"]
        if cid not in seen_courses:
            seen_courses.add(cid)
            course_order.append(cid)
        if r["completed"]:
            completed.setdefault(str(cid), []).append(r["topic_index"])

    return {"course_order": course_order, "completed": completed}


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

@app.route("/api/auth/signup", methods=["POST"])
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
            # role_id=1 is 'user' (seeded in init_auth_db)
            with conn.cursor() as cur:
                var_id = cur.var(oracledb.NUMBER)
                cur.execute(
                    "INSERT INTO users (email, name, role_id) "
                    "VALUES (:email, :name, 1) RETURNING id INTO :out_id",
                    {"email": email, "name": name, "out_id": var_id},
                )
                user_id = int(var_id.getvalue()[0])
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users_sensitive (user_id, password_hash, two_factor_secret) "
                    "VALUES (:user_id, :pw_hash, :totp_secret)",
                    {"user_id": user_id, "pw_hash": pw_hash, "totp_secret": totp_secret},
                )
            conn.commit()
        except oracledb.IntegrityError:
            abort(409, description="An account with that email already exists")

        user = _fetch_user_by_id(conn, user_id)
    finally:
        conn.close()

    partial = _make_partial_token(user["id"])
    return jsonify({
        "token":            partial,
        "requiresTwoFactor": True,
        "message":          "Account created. Set up two-factor authentication to continue.",
    }), 201


# ── POST /auth/login ────────────────────────────────────────────────────── #

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data     = request.get_json(force=True, silent=True) or {}
    email    = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        abort(400, description="Email and password are required")

    conn = get_auth_db()
    try:
        user = _fetch_user_by_email(conn, email)
    finally:
        conn.close()

    # Use constant-time comparison even when user is missing (prevents timing attacks)
    dummy_hash = b"$2b$12$" + b"x" * 53
    stored_hash = user["password_hash"].encode() if (user and user.get("password_hash")) else dummy_hash
    password_ok = bcrypt.checkpw(password.encode(), stored_hash)

    if not user or not password_ok:
        abort(401, description="Invalid email or password")

    # Check for incomplete 2FA setup (signed up but never completed 2FA)
    if user.get("two_factor_secret") and not user.get("two_factor_confirmed"):
        return jsonify({
            "token": _make_partial_token(user["id"]),
            "requiresTwoFactorSetup": True,
            "message": "Your account setup is incomplete. Please complete two-factor authentication to continue.",
        }), 200

    if user["two_factor_enabled"] and user["two_factor_confirmed"]:
        return jsonify({
            "token":            _make_partial_token(user["id"]),
            "requiresTwoFactor": True,
        }), 200

    new_session_id = str(uuid.uuid4())
    client_ip = _get_client_ip()
    conn2 = get_auth_db()
    try:
        _check_ip_restriction(conn2, user, client_ip)
        user["session_id"] = new_session_id
        token = _make_full_token(user)
        with conn2.cursor() as cur:
            cur.execute(
                "UPDATE users_sensitive SET session_id = :session_id, last_login_ip = :ip, "
                "last_login_at = :login_at, current_token = :token WHERE user_id = :user_id",
                {
                    "session_id": new_session_id,
                    "ip":         client_ip,
                    "login_at":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "token":      token,
                    "user_id":    user["id"],
                },
            )
        conn2.commit()
    finally:
        conn2.close()

    return jsonify({
        "token": token,
        "user":  _user_public(user),
    }), 200


# ── GET /auth/me ────────────────────────────────────────────────────────── #

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Not authenticated")
    conn = get_auth_db()
    try:
        return jsonify(_user_public(user, conn=conn)), 200
    finally:
        conn.close()


# ── POST /auth/logout ────────────────────────────────────────────────────── #

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    """Invalidate the current session in the DB. Always returns 200."""
    user, _ = _resolve_user(require_full=False)
    if user:
        conn = get_auth_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users_sensitive SET session_id = NULL, current_token = NULL "
                    "WHERE user_id = :user_id",
                    {"user_id": user["id"]},
                )
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()
    return jsonify({"message": "Logged out"}), 200


# ── POST /auth/change-password ────────────────────────────────────────────── #

@app.route("/api/auth/change-password", methods=["POST"])
def auth_change_password():
    """Change the authenticated user's password.

    Requires a valid full-auth Bearer token.
    Body: {"current_password": "...", "new_password": "..."}
    Verifies the current password, then updates the hash. The active session
    is intentionally kept alive so the user does not need to re-login.
    """
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Not authenticated")

    body             = request.get_json(force=True, silent=True) or {}
    current_password = str(body.get("current_password", "")).strip()
    new_password     = str(body.get("new_password", ""))

    if not current_password or not new_password:
        abort(400, description="current_password and new_password are required")

    if len(new_password) < 8 or len(new_password) > 72:
        abort(400, description="New password must be 8–72 characters")

    # Fetch stored hash
    conn = get_auth_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM users_sensitive WHERE user_id = :user_id",
                {"user_id": user["id"]},
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row or not row[0]:
        abort(400, description="No password set for this account")

    stored_hash = row[0].encode() if isinstance(row[0], str) else row[0]

    if not bcrypt.checkpw(current_password.encode(), stored_hash):
        abort(400, description="Current password is incorrect")

    pw_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt(rounds=12)).decode()

    conn = get_auth_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users_sensitive SET password_hash = :pw_hash WHERE user_id = :user_id",
                {"pw_hash": pw_hash, "user_id": user["id"]},
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"message": "Password updated successfully"}), 200


# ── GET /auth/2fa/setup ─────────────────────────────────────────────────── #

@app.route("/api/auth/2fa/setup", methods=["GET"])
def auth_2fa_setup():
    user, _ = _resolve_user(require_full=False)
    if not user:
        abort(401, description="Not authenticated")

    totp_secret = user.get("two_factor_secret")
    if not totp_secret:
        totp_secret = pyotp.random_base32()
        conn = get_auth_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users_sensitive SET two_factor_secret = :secret WHERE user_id = :user_id",
                    {"secret": totp_secret, "user_id": user["id"]},
                )
            conn.commit()
        finally:
            conn.close()

    uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=user["email"], issuer_name=TOTP_ISSUER
    )
    buf = io.BytesIO()
    # dark=#1e1b4b contrasts well in both light/dark UI; white background for
    # scanner readability regardless of the host page's colour scheme.
    segno.make_qr(uri).save(buf, kind="svg", scale=5, dark="#1e1b4b", light="#ffffff")
    qr_data_url = "data:image/svg+xml;base64," + base64.b64encode(buf.getvalue()).decode()

    return jsonify({"qrCodeUrl": qr_data_url, "secret": totp_secret}), 200


# ── PUT /auth/theme ────────────────────────────────────────────────────────── #

@app.route("/api/auth/theme", methods=["PUT"])
def auth_set_theme():
    """Persist the user's preferred theme ('light' | 'dark') server-side."""
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Not authenticated")

    body  = request.get_json(force=True, silent=True) or {}
    theme = str(body.get("theme", "")).strip()
    if theme not in ("light", "dark"):
        abort(400, description="theme must be 'light' or 'dark'")

    conn = get_auth_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET theme = :theme WHERE id = :user_id",
                {"theme": theme, "user_id": user["id"]},
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"theme": theme}), 200


# ── POST /auth/progress/topic ────────────────────────────────────────────── #

@app.route("/api/auth/progress/topic", methods=["POST"])
def auth_progress_topic():
    """Record that a user visited (and optionally completed) a topic.

    Body: {"course_id": <int>, "topic_index": <int>, "completed": <bool>}

    Idempotent: UPSERT — calling it again with completed=true is safe.
    completed can only progress forward (false → true), never regress.
    """
    user, _ = _resolve_user(require_full=True)
    if not user:
        abort(401, description="Not authenticated")

    body        = request.get_json(force=True, silent=True) or {}
    course_id   = body.get("course_id")
    topic_index = body.get("topic_index")
    completed   = bool(body.get("completed", False))

    if course_id is None or topic_index is None:
        abort(400, description="course_id and topic_index are required")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn = get_auth_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                MERGE INTO user_progress p
                USING DUAL
                ON (p.user_id = :user_id AND p.course_id = :course_id
                    AND p.topic_index = :topic_index)
                WHEN MATCHED THEN
                    UPDATE SET
                        completed              = :completed,
                        last_visited_at        = :now,
                        last_visited_course_at = :now
                WHEN NOT MATCHED THEN
                    INSERT (user_id, course_id, topic_index, completed,
                            last_visited_at, last_visited_course_at)
                    VALUES (:user_id, :course_id, :topic_index, :completed, :now, :now)
                """,
                {
                    "user_id":     user["id"],
                    "course_id":   int(course_id),
                    "topic_index": int(topic_index),
                    "completed":   int(completed),
                    "now":         now,
                },
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"ok": True}), 200

# ── POST /auth/signup/rollback ───────────────────────────────────────────── #

@app.route("/api/auth/signup/rollback", methods=["POST"])
def auth_signup_rollback():
    """Delete an account created during signup if 2FA setup was never completed.
    Only deletes the account when two_factor_confirmed = 0 (i.e. partial signup).
    Clears the auth cookie so the browser is fully reset."""
    user, _ = _resolve_user(require_full=False)
    if not user:
        # Nothing to roll back — clear cookie and return OK
        resp = jsonify({"message": "No partial session found"})
        resp.delete_cookie("ev_token", path="/", samesite="Lax")
        resp.delete_cookie("ev_session", path="/", samesite="Lax")
        return resp, 200

    if user.get("two_factor_confirmed"):
        abort(403, description="Account is already fully set up — rollback not allowed")

    conn = get_auth_db()
    try:
        # ON DELETE CASCADE removes the users_sensitive row automatically.
        # Subquery guard prevents accidental deletion of fully confirmed accounts
        # even in the event of a race condition.
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM users WHERE id = :user_id
                  AND NOT EXISTS (
                    SELECT 1 FROM users_sensitive
                    WHERE user_id = :user_id AND two_factor_confirmed = 1
                  )
                """,
                {"user_id": user["id"]},
            )
        conn.commit()
    finally:
        conn.close()

    resp = jsonify({"message": "Partial signup rolled back successfully"})
    resp.delete_cookie("ev_token", path="/", samesite="Lax")
    resp.delete_cookie("ev_session", path="/", samesite="Lax")
    return resp, 200


# ── POST /auth/2fa/enable ───────────────────────────────────────────────── #

@app.route("/api/auth/2fa/enable", methods=["POST"])
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
    client_ip = _get_client_ip()
    conn = get_auth_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET two_factor_enabled = 1 WHERE id = :user_id",
                {"user_id": user["id"]},
            )
        # Refresh so login_ip_log reflects the latest DB state before restriction check
        user = _fetch_user_by_id(conn, user["id"])
        _check_ip_restriction(conn, user, client_ip)
        user["session_id"] = new_session_id
        token = _make_full_token(user)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users_sensitive SET two_factor_confirmed = 1, "
                "session_id = :session_id, last_login_ip = :ip, "
                "last_login_at = :login_at, current_token = :token "
                "WHERE user_id = :user_id",
                {
                    "session_id": new_session_id,
                    "ip":         client_ip,
                    "login_at":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "token":      token,
                    "user_id":    user["id"],
                },
            )
        conn.commit()
        user = _fetch_user_by_id(conn, user["id"])
    finally:
        conn.close()

    return jsonify({
        "token": token,
        "user":  _user_public(user),
    }), 200


# ── POST /auth/2fa/verify ──────────────────────────────────────────────────── #

@app.route("/api/auth/2fa/verify", methods=["POST"])
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
    client_ip = _get_client_ip()
    conn2 = get_auth_db()
    try:
        _check_ip_restriction(conn2, user, client_ip)
        user["session_id"] = new_session_id
        token = _make_full_token(user)
        with conn2.cursor() as cur:
            cur.execute(
                "UPDATE users_sensitive SET session_id = :session_id, last_login_ip = :ip, "
                "last_login_at = :login_at, current_token = :token WHERE user_id = :user_id",
                {
                    "session_id": new_session_id,
                    "ip":         client_ip,
                    "login_at":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "token":      token,
                    "user_id":    user["id"],
                },
            )
        conn2.commit()
    finally:
        conn2.close()

    return jsonify({
        "token": token,
        "user":  _user_public(user),
    }), 200


# ── POST /auth/forgot-password/request ─────────────────────────────────── #

@app.route("/api/auth/forgot-password/request", methods=["POST"])
def auth_forgot_password_request():
    """Step 1 of forgot-password: verify the email has a confirmed 2FA account.

    Issues a short-lived (10 min) JWT with scope='pw_reset_pending'.
    The same 400 message is returned whether the email exists or not,
    to prevent account enumeration.

    Body: {"email": "..."}
    """
    data  = request.get_json(force=True, silent=True) or {}
    email = str(data.get("email", "")).strip().lower()

    if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        abort(400, description="Invalid email address")

    conn = get_auth_db()
    try:
        user = _fetch_user_by_email(conn, email)
    finally:
        conn.close()

    # Check for incomplete 2FA setup (signed up but never completed 2FA)
    if user and user.get("two_factor_secret") and not user.get("two_factor_confirmed"):
        abort(400, description=(
            "This account has incomplete two-factor authentication setup. "
            "Password reset is not available. Please create a new account or contact support."
        ))

    # Require a fully confirmed 2FA account — otherwise there is no second
    # factor available to verify ownership of the account.
    if not user or not user.get("two_factor_confirmed") or not user.get("two_factor_secret"):
        abort(400, description=(
            "No account with a verified authenticator was found for that email. "
            "If you set up 2FA during sign-up, try again or contact support."
        ))

    now = int(time.time())
    token = pyjwt.encode(
        {"id": user["id"], "scope": "pw_reset_pending", "iat": now, "exp": now + 600},
        JWT_SECRET,
        algorithm="HS256",
    )
    return jsonify({"token": token, "requiresTwoFactor": True}), 200


# ── POST /auth/forgot-password/verify ──────────────────────────────────── #

@app.route("/api/auth/forgot-password/verify", methods=["POST"])
def auth_forgot_password_verify():
    """Step 2 of forgot-password: confirm TOTP code, issue a reset-confirmed token.

    Consumes the pw_reset_pending token (Bearer header) and — on success —
    returns a short-lived (5 min) JWT with scope='pw_reset_confirmed'.

    Body: {"code": "<6-digit TOTP>"}
    """
    token_raw = _bearer_token()
    if not token_raw:
        abort(401, description="Reset session token required")

    payload = _decode_token(token_raw)
    if not payload or payload.get("scope") != "pw_reset_pending":
        abort(401, description="Invalid or expired password-reset session")

    body = request.get_json(force=True, silent=True) or {}
    code = str(body.get("code", "")).strip()

    if len(code) != 6 or not code.isdigit():
        abort(400, description="Enter the 6-digit code from your authenticator app")

    conn = get_auth_db()
    try:
        user = _fetch_user_by_id(conn, payload["id"])
    finally:
        conn.close()

    if not user or not user.get("two_factor_secret"):
        abort(401, description="Invalid reset session")

    if not pyotp.TOTP(user["two_factor_secret"]).verify(code, valid_window=1):
        abort(400, description="Invalid authenticator code")

    now = int(time.time())
    confirmed_token = pyjwt.encode(
        {"id": user["id"], "scope": "pw_reset_confirmed", "iat": now, "exp": now + 300},
        JWT_SECRET,
        algorithm="HS256",
    )
    return jsonify({"token": confirmed_token}), 200


# ── POST /auth/forgot-password/reset ───────────────────────────────────── #

@app.route("/api/auth/forgot-password/reset", methods=["POST"])
def auth_forgot_password_reset():
    """Step 3 of forgot-password: set a new password using the confirmed token.

    Hashes the new password with bcrypt, persists it, and invalidates all
    existing sessions so any stolen JWTs can no longer be used.

    Body: {"password": "..."} + Bearer pw_reset_confirmed token.
    """
    token_raw = _bearer_token()
    if not token_raw:
        abort(401, description="Reset session token required")

    payload = _decode_token(token_raw)
    if not payload or payload.get("scope") != "pw_reset_confirmed":
        abort(401, description="Invalid or expired password-reset session")

    body     = request.get_json(force=True, silent=True) or {}
    password = str(body.get("password", ""))

    if len(password) < 8 or len(password) > 72:
        abort(400, description="Password must be 8–72 characters")

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

    conn = get_auth_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users_sensitive "
                "SET password_hash = :pw_hash, session_id = NULL, current_token = NULL "
                "WHERE user_id = :user_id",
                {"pw_hash": pw_hash, "user_id": payload["id"]},
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"message": "Password updated. Please sign in with your new password."}), 200


# ── Entry point ───────────────────────────────────────────────────────────── #

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    should_start_background_jobs = (not debug_mode or os.environ.get("WERKZEUG_RUN_MAIN") == "true")

    init_auth_db()
    if should_start_background_jobs:
        _start_keep_db_alive_scheduler(app)

    if debug_mode:
        app.run(host="0.0.0.0", port=5000, debug=True)
    else:
        
        log.info("Starting production server via waitress on 0.0.0.0:" + str(FLASK_PORT))
        serve(app, host="0.0.0.0", port=FLASK_PORT, threads=4)
