from __future__ import annotations

import base64
import io
import json
import re
import time
import uuid
from typing import Any

import bcrypt
import jwt as pyjwt
import pyotp
import segno
from flask import Blueprint, abort, jsonify, request

from backend.auth_service import AuthService
from backend.config import resolve_viewer_features_for_role
from backend.db.manager import DBManager
from backend.db.sql_helpers import execute, fetch_one_dict, rollback_quietly

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

MAX_BOOKMARKS_PER_COURSE = 500
MAX_HIGHLIGHTS_PER_TOPIC = 40
MAX_HIGHLIGHTS_PER_COURSE = 300
MAX_HIGHLIGHT_TEXT_LEN = 180
MAX_HIGHLIGHT_CONTEXT_LEN = 120
MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN = 80
MAX_HIGHLIGHT_NOTE_LEN = 800
MAX_TOPIC_NOTES_PER_TOPIC = 100
MAX_TOPIC_NOTES_PER_COURSE = 800
MAX_TOPIC_NOTE_TEXT_LEN = 1200
MAX_COURSE_NOTES_PER_COURSE = 300
MAX_COURSE_NOTE_TEXT_LEN = 1200
MAX_DRAWING_SCENE_JSON_LEN = 1_500_000
ALLOWED_HIGHLIGHT_COLORS: set[str] = {"yellow", "blue", "green", "pink", "orange"}
RESET_SCOPES: set[str] = {"progress", "bookmarks", "highlights", "notes", "drawing"}


def _normalize_highlight_color(value: Any) -> str:
    color = str(value or "").strip().lower()
    if color in ALLOWED_HIGHLIGHT_COLORS:
        return color
    return "yellow"


def _remove_token_from_session_queue(auth_service: AuthService, queue_raw: Any, token: str | None) -> str:
    queue = auth_service.parse_session_queue(queue_raw)
    if token:
        queue = [row for row in queue if row.get("token") != token]
    return auth_service.serialize_session_queue(queue)


def _to_int(value: Any, field: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        abort(400, description=f"{field} must be a number")


def _normalize_highlight_text_key(value: Any) -> str:
    raw = str(value or "")
    return " ".join(raw.split()).strip().lower()


def _coerce_non_negative_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        out = int(value)
    except (TypeError, ValueError):
        return None
    return out if out >= 0 else None


def _coerce_component_index(value: Any) -> int | None:
    if value is None:
        return None
    try:
        out = int(value)
    except (TypeError, ValueError):
        return None
    return out if out >= -1 else None


def _clean_topic_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    out: list[int] = []
    seen: set[int] = set()
    for item in value:
        try:
            idx = int(item)
        except (TypeError, ValueError):
            continue
        if idx in seen:
            continue
        seen.add(idx)
        out.append(idx)
    return out


def _clean_highlights_map(value: Any) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(value, dict):
        return {}
    cleaned: dict[str, list[dict[str, Any]]] = {}
    for topic_key, items in value.items():
        if not isinstance(topic_key, str):
            continue
        if not isinstance(items, list):
            continue
        rows: list[dict[str, Any]] = []
        seen_keys: set[tuple[Any, ...]] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            start_offset_raw = item.get("start_offset")
            end_offset_raw = item.get("end_offset")
            start_offset = None
            end_offset = None
            try:
                if start_offset_raw is not None and end_offset_raw is not None:
                    start_offset = int(start_offset_raw)
                    end_offset = int(end_offset_raw)
            except (TypeError, ValueError):
                start_offset = None
                end_offset = None
            if (
                start_offset is not None and end_offset is not None
                and (start_offset < 0 or end_offset <= start_offset)
            ):
                start_offset = None
                end_offset = None
            component_index = _coerce_component_index(item.get("component_index"))
            normalized_text_key = _normalize_highlight_text_key(text)
            dedupe_key: tuple[Any, ...]
            if start_offset is not None and end_offset is not None and component_index is not None:
                dedupe_key = ("offset", component_index, start_offset, end_offset)
            else:
                dedupe_key = ("text", component_index, normalized_text_key)
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)
            rows.append(
                {
                    "id": str(item.get("id", "") or uuid.uuid4().hex),
                    "text": text[:MAX_HIGHLIGHT_TEXT_LEN],
                    "context": str(item.get("context", "") or "")[:MAX_HIGHLIGHT_CONTEXT_LEN],
                    "quote_prefix": str(item.get("quote_prefix", "") or "")[:MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN],
                    "quote_suffix": str(item.get("quote_suffix", "") or "")[:MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN],
                    "note": str(item.get("note", "") or "")[:MAX_HIGHLIGHT_NOTE_LEN],
                    "color": _normalize_highlight_color(item.get("color")),
                    "created_at": str(item.get("created_at", "") or ""),
                    "start_offset": start_offset,
                    "end_offset": end_offset,
                    "component_index": component_index,
                }
            )
        if rows:
            cleaned[topic_key] = rows[-MAX_HIGHLIGHTS_PER_TOPIC:]
    return cleaned


def _clean_topic_notes_map(value: Any) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(value, dict):
        return {}
    cleaned: dict[str, list[dict[str, Any]]] = {}
    for topic_key, items in value.items():
        if not isinstance(topic_key, str):
            continue
        if not isinstance(items, list):
            continue
        rows: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        seen_texts: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            note_id = str(item.get("id", "") or uuid.uuid4().hex)
            if note_id in seen_ids:
                continue
            normalized = _normalize_highlight_text_key(text)
            if normalized in seen_texts:
                continue
            seen_ids.add(note_id)
            seen_texts.add(normalized)
            rows.append(
                {
                    "id": note_id,
                    "text": text[:MAX_TOPIC_NOTE_TEXT_LEN],
                    "created_at": str(item.get("created_at", "") or ""),
                }
            )
        if rows:
            cleaned[topic_key] = rows[-MAX_TOPIC_NOTES_PER_TOPIC:]
    return cleaned


def _clean_course_notes_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_texts: set[str] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        note_id = str(item.get("id", "") or uuid.uuid4().hex)
        if note_id in seen_ids:
            continue
        normalized = _normalize_highlight_text_key(text)
        if normalized in seen_texts:
            continue
        seen_ids.add(note_id)
        seen_texts.add(normalized)
        rows.append(
            {
                "id": note_id,
                "text": text[:MAX_COURSE_NOTE_TEXT_LEN],
                "created_at": str(item.get("created_at", "") or ""),
                "updated_at": str(item.get("updated_at", "") or ""),
            }
        )
    return rows[-MAX_COURSE_NOTES_PER_COURSE:]


def _clean_drawing_scene(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    elements = value.get("elements")
    app_state = value.get("appState")
    files = value.get("files")
    if not isinstance(elements, list):
        return None
    if not isinstance(app_state, dict):
        app_state = {}
    if not isinstance(files, dict):
        files = {}

    scene = {
        "elements": elements,
        "appState": app_state,
        "files": files,
    }
    try:
        encoded = json.dumps(scene, separators=(",", ":"))
    except (TypeError, ValueError):
        return None
    if len(encoded) <= MAX_DRAWING_SCENE_JSON_LEN:
        return scene

    # Files are the largest payload contributor. Drop them first to retain strokes.
    compact_scene = {
        "elements": elements,
        "appState": app_state,
        "files": {},
    }
    try:
        compact_encoded = json.dumps(compact_scene, separators=(",", ":"))
    except (TypeError, ValueError):
        return None
    if len(compact_encoded) <= MAX_DRAWING_SCENE_JSON_LEN:
        return compact_scene
    return None


def _clean_drawing_note(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    scene = _clean_drawing_scene(value.get("scene"))
    if scene is None:
        return None
    return {
        "scene": scene,
        "updated_at": str(value.get("updated_at", "") or "")[:40],
    }


def _viewer_features_for_user(auth_service: AuthService, user: dict[str, Any]) -> dict[str, bool]:
    return resolve_viewer_features_for_role(
        str(user.get("role", "") or ""),
        auth_service.config.viewer_feature_flags,
        auth_service.config.viewer_feature_role_overrides,
    )


def _filter_course_state_by_features(
    course_state: dict[str, Any],
    features: dict[str, bool],
) -> dict[str, Any]:
    filtered = dict(course_state)
    highlights_enabled = bool(features.get("highlights_enabled", True))
    bookmarks_enabled = bool(features.get("bookmarks_enabled", True))
    notes_enabled = bool(features.get("notes_enabled", True))
    drawings_enabled = bool(features.get("drawings_enabled", True))

    if not bookmarks_enabled:
        filtered.pop("bookmarks", None)
    if not highlights_enabled:
        filtered.pop("highlights", None)
    if not notes_enabled:
        filtered.pop("topic_notes", None)
        filtered.pop("course_notes", None)
    else:
        filtered["topic_notes"] = _clean_topic_notes_map(filtered.get("topic_notes"))
        filtered["course_notes"] = _clean_course_notes_list(filtered.get("course_notes"))
    if not drawings_enabled:
        filtered.pop("drawing_note", None)
    else:
        drawing_note = _clean_drawing_note(filtered.get("drawing_note"))
        if drawing_note is not None:
            filtered["drawing_note"] = drawing_note
        else:
            filtered.pop("drawing_note", None)

    if not highlights_enabled:
        return filtered

    if not notes_enabled:
        raw_highlights = filtered.get("highlights")
        if isinstance(raw_highlights, dict):
            sanitized_highlights: dict[str, list[dict[str, Any]]] = {}
            for topic_key, rows in raw_highlights.items():
                if not isinstance(rows, list):
                    continue
                sanitized_rows: list[dict[str, Any]] = []
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    row_copy = dict(row)
                    row_copy.pop("note", None)
                    sanitized_rows.append(row_copy)
                if sanitized_rows:
                    sanitized_highlights[str(topic_key)] = sanitized_rows
            filtered["highlights"] = sanitized_highlights
    return filtered


def _parse_reader_state_json(raw: Any) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    return parsed


def _normalize_course_reader_state(raw_course_state: Any) -> dict[str, Any]:
    if not isinstance(raw_course_state, dict):
        raw_course_state = {}
    normalized_course_state: dict[str, Any] = {
        "bookmarks": _clean_topic_list(raw_course_state.get("bookmarks"))[-MAX_BOOKMARKS_PER_COURSE:],
        "highlights": _clean_highlights_map(raw_course_state.get("highlights")),
        "topic_notes": _clean_topic_notes_map(raw_course_state.get("topic_notes")),
        "course_notes": _clean_course_notes_list(raw_course_state.get("course_notes")),
    }
    drawing_note = _clean_drawing_note(raw_course_state.get("drawing_note"))
    if drawing_note is not None:
        normalized_course_state["drawing_note"] = drawing_note
    if "last_highlight_color" in raw_course_state:
        normalized_course_state["last_highlight_color"] = _normalize_highlight_color(
            raw_course_state.get("last_highlight_color")
        )
    return normalized_course_state


def _fetch_course_reader_state(conn: Any, user_id: int, course_id: int) -> dict[str, Any]:
    row = fetch_one_dict(
        conn,
        """
        SELECT state_json
        FROM user_course_reader_state
        WHERE user_id = :user_id AND course_id = :course_id
        """,
        {"user_id": user_id, "course_id": course_id},
    ) or {}
    return _parse_reader_state_json(row.get("state_json"))


def _upsert_course_reader_state(
    conn: Any,
    user_id: int,
    course_id: int,
    state: dict[str, Any],
    now_iso: str,
    is_integrity_error,
) -> None:
    encoded_state = json.dumps(state, separators=(",", ":"))
    updated = execute(
        conn,
        """
        UPDATE user_course_reader_state
        SET state_json = :state_json, updated_at = :updated_at
        WHERE user_id = :user_id AND course_id = :course_id
        """,
        {
            "state_json": encoded_state,
            "updated_at": now_iso,
            "user_id": user_id,
            "course_id": course_id,
        },
    )
    if updated > 0:
        return
    try:
        execute(
            conn,
            """
            INSERT INTO user_course_reader_state
            (user_id, course_id, state_json, created_at, updated_at)
            VALUES (:user_id, :course_id, :state_json, :created_at, :updated_at)
            """,
            {
                "user_id": user_id,
                "course_id": course_id,
                "state_json": encoded_state,
                "created_at": now_iso,
                "updated_at": now_iso,
            },
        )
    except Exception as exc:
        if not is_integrity_error(exc):
            raise
        execute(
            conn,
            """
            UPDATE user_course_reader_state
            SET state_json = :state_json, updated_at = :updated_at
            WHERE user_id = :user_id AND course_id = :course_id
            """,
            {
                "state_json": encoded_state,
                "updated_at": now_iso,
                "user_id": user_id,
                "course_id": course_id,
            },
        )


def create_auth_blueprint(auth_service: AuthService, db_manager: DBManager) -> Blueprint:
    bp = Blueprint("auth_api", __name__, url_prefix="/api/auth")

    @bp.route("/signup", methods=["POST"])
    def auth_signup():
        data = request.get_json(force=True, silent=True) or {}
        email = str(data.get("email", "")).strip().lower()
        password = auth_service.decrypt_password(str(data.get("password", "")))
        invite = str(data.get("inviteCode", "")).strip()
        name = str(data.get("name", "")).strip() or None

        if not email or not EMAIL_RE.match(email):
            abort(400, description="Invalid email address")
        if len(password) < 8 or len(password) > 72:
            abort(400, description="Password must be 8-72 characters")

        if auth_service.invite_codes and invite not in auth_service.invite_codes:
            abort(400, description="Invalid invite code")
        if not invite:
            abort(400, description="Invite code is required")

        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
        totp_secret = pyotp.random_base32()

        conn = db_manager.get_auth_connection()
        try:
            try:
                user_id = db_manager.insert_user(conn, email=email, name=name)
                execute(
                    conn,
                    "INSERT INTO users_sensitive (user_id, password_hash, two_factor_secret) "
                    "VALUES (:user_id, :pw_hash, :totp_secret)",
                    {
                        "user_id": user_id,
                        "pw_hash": pw_hash,
                        "totp_secret": totp_secret,
                    },
                )
                conn.commit()
            except Exception as exc:
                rollback_quietly(conn)
                if db_manager.auth_backend.is_integrity_error(exc):
                    abort(409, description="An account with that email already exists")
                raise

            user = auth_service.fetch_user_by_id(conn, user_id)
        finally:
            conn.close()

        if not user:
            abort(500, description="Failed to load account after signup")

        partial = auth_service.make_partial_token(int(user["id"]))
        return (
            jsonify(
                {
                    "token": partial,
                    "requiresTwoFactor": True,
                    "message": "Account created. Set up two-factor authentication to continue.",
                }
            ),
            201,
        )

    @bp.route("/login", methods=["POST"])
    def auth_login():
        data = request.get_json(force=True, silent=True) or {}
        email = str(data.get("email", "")).strip().lower()
        raw_pw = str(data.get("password", ""))

        if not email or not raw_pw:
            abort(400, description="Email and password are required")

        password = auth_service.decrypt_password(raw_pw)

        conn = db_manager.get_auth_connection()
        try:
            user = auth_service.fetch_user_by_email(conn, email)
        finally:
            conn.close()

        dummy_hash = b"$2b$12$" + b"x" * 53
        stored_hash = user["password_hash"].encode() if (user and user.get("password_hash")) else dummy_hash
        password_ok = bcrypt.checkpw(password.encode(), stored_hash)

        if not user:
            abort(401, description="Invalid email or password")

        # ── Brute-force lockout check ──────────────────────────────────────────
        now_ts = time.time()
        locked_until_str = user.get("locked_until")
        if locked_until_str:
            try:
                locked_until_ts = time.mktime(time.strptime(locked_until_str, "%Y-%m-%dT%H:%M:%SZ"))
                # Convert from local to UTC offset
                locked_until_ts -= time.timezone
                remaining = int(locked_until_ts - now_ts)
                if remaining > 0:
                    mins = max(1, (remaining + 59) // 60)
                    abort(429, description=f"Account temporarily locked. Try again in {mins} minute(s).")
            except (ValueError, OverflowError):
                pass

        if not password_ok:
            # Increment failed attempts and potentially lock
            conn3 = db_manager.get_auth_connection()
            try:
                new_attempts = int(user.get("failed_attempts") or 0) + 1
                locked_until_val = None
                if new_attempts >= 5:
                    locked_until_val = time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ",
                        time.gmtime(now_ts + 15 * 60),
                    )
                execute(
                    conn3,
                    "UPDATE users_sensitive SET failed_attempts = :attempts, locked_until = :locked "
                    "WHERE user_id = :user_id",
                    {"attempts": new_attempts, "locked": locked_until_val, "user_id": user["id"]},
                )
                conn3.commit()

                # ── Check for stale temp password usage ───────────────────────
                # If they used the OLD temp password after changing it, we can detect it here.
                # This only applies if they are in the transitional phase (already changed pw but not finished 2FA).
                stale_hash = user.get("onboarding_temp_password_hash")
                if stale_hash and not user.get("is_first_login"):
                    if bcrypt.checkpw(password.encode(), stale_hash.encode()):
                        abort(
                            401,
                            description=(
                                "You already changed your password. "
                                "Please use your new password."
                            ),
                        )
            finally:
                conn3.close()
            abort(401, description="Invalid email or password")

        # ── Reset lockout on successful credential check ───────────────────────
        conn_reset = db_manager.get_auth_connection()
        try:
            execute(
                conn_reset,
                "UPDATE users_sensitive SET failed_attempts = 0, locked_until = NULL WHERE user_id = :user_id",
                {"user_id": user["id"]},
            )
            conn_reset.commit()
        finally:
            conn_reset.close()

        # ── Temp password expiry check ─────────────────────────────────────────
        temp_exp_str = user.get("temp_password_expires_at")
        if temp_exp_str and user.get("is_first_login"):
            try:
                # Parse UTC string correctly using calendar.timegm
                import calendar
                st = time.strptime(temp_exp_str, "%Y-%m-%dT%H:%M:%SZ")
                temp_exp_ts = calendar.timegm(st)
                
                if now_ts > temp_exp_ts:
                    abort(
                        401,
                        description=(
                            "Your temporary password has expired. "
                            "Please contact an administrator to reset your account."
                        ),
                    )
            except (ValueError, OverflowError):
                pass

        if not user.get("is_active", True) and user.get("role") != "admin":
            abort(403, description="Account is deactivated. Please contact an administrator.")

        # ── First-login: force password change ────────────────────────────────
        if user.get("is_first_login"):
            return (
                jsonify(
                    {
                        "token": auth_service.make_partial_token(int(user["id"])),
                        "requiresFirstLogin": True,
                        "message": "You must change your password before continuing.",
                    }
                ),
                200,
            )

        if (user.get("two_factor_enabled") or user.get("two_factor_secret")) and not user.get("two_factor_confirmed"):
            return (
                jsonify(
                    {
                        "token": auth_service.make_partial_token(int(user["id"])),
                        "requiresTwoFactorSetup": True,
                        "message": (
                            "Your account setup is incomplete. Please complete "
                            "two-factor authentication to continue."
                        ),
                    }
                ),
                200,
            )

        if user.get("two_factor_enabled") and user.get("two_factor_confirmed"):
            return (
                jsonify(
                    {
                        "token": auth_service.make_partial_token(int(user["id"])),
                        "requiresTwoFactor": True,
                    }
                ),
                200,
            )

        client_ip = auth_service.get_client_ip()

        conn2 = db_manager.get_auth_connection()
        try:
            token = auth_service.make_full_token(user)
            token_queue_json = auth_service.append_session_token(
                user.get("current_token"),
                token=token,
                max_active_sessions=user.get("max_active_sessions"),
                client_ip=client_ip,
            )
            execute(
                conn2,
                "UPDATE users_sensitive SET current_token = :token WHERE user_id = :user_id",
                {
                    "token": token_queue_json,
                    "user_id": user["id"],
                },
            )
            conn2.commit()
        finally:
            conn2.close()

        return jsonify({"token": token, "user": auth_service.user_public(user)}), 200

    @bp.route("/me", methods=["GET"])
    def auth_me():
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            abort(401, description="Not authenticated")

        conn = db_manager.get_auth_connection()
        try:
            return jsonify(auth_service.user_public(user, conn=conn)), 200
        finally:
            conn.close()

    @bp.route("/logout", methods=["POST"])
    def auth_logout():
        user, _ = auth_service.resolve_user(require_full=False)
        if user:
            bearer = auth_service.bearer_token()
            conn = db_manager.get_auth_connection()
            try:
                current_row = fetch_one_dict(
                    conn,
                    "SELECT current_token FROM users_sensitive WHERE user_id = :user_id",
                    {"user_id": user["id"]},
                ) or {}
                next_queue = _remove_token_from_session_queue(auth_service, current_row.get("current_token"), bearer)
                execute(
                    conn,
                    "UPDATE users_sensitive SET current_token = :current_token "
                    "WHERE user_id = :user_id",
                    {"current_token": next_queue, "user_id": user["id"]},
                )
                conn.commit()
            except Exception:
                pass
            finally:
                conn.close()

        return jsonify({"message": "Logged out"}), 200

    @bp.route("/change-password", methods=["POST"])
    def auth_change_password():
        # Accept partial tokens so first-login users can change their temp password
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        current_password = auth_service.decrypt_password(str(body.get("current_password", "")).strip())
        new_password = auth_service.decrypt_password(str(body.get("new_password", "")))

        if not current_password or not new_password:
            abort(400, description="current_password and new_password are required")
        if len(new_password) < 8 or len(new_password) > 72:
            abort(400, description="New password must be 8-72 characters")

        conn = db_manager.get_auth_connection()
        try:
            row = fetch_one_dict(
                conn,
                "SELECT password_hash FROM users_sensitive WHERE user_id = :user_id",
                {"user_id": user["id"]},
            )
        finally:
            conn.close()

        if not row or not row.get("password_hash"):
            abort(400, description="No password set for this account")

        stored_hash_raw = row["password_hash"]
        stored_hash = stored_hash_raw.encode() if isinstance(stored_hash_raw, str) else stored_hash_raw

        if not bcrypt.checkpw(current_password.encode(), stored_hash):
            abort(400, description="Current password is incorrect")

        pw_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt(rounds=12)).decode()

        conn = db_manager.get_auth_connection()
        try:
            execute(
                conn,
                "UPDATE users_sensitive "
                "SET password_hash = :pw_hash, temp_password_expires_at = NULL "
                "WHERE user_id = :user_id",
                {"pw_hash": pw_hash, "user_id": user["id"]},
            )
            # Clear is_first_login if this was the mandatory first-login flow
            execute(
                conn,
                "UPDATE users SET is_first_login = 0 WHERE id = :user_id",
                {"user_id": user["id"]},
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"message": "Password updated successfully"}), 200

    @bp.route("/2fa/setup", methods=["GET"])
    def auth_2fa_setup():
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            abort(401, description="Not authenticated")

        totp_secret = user.get("two_factor_secret")
        if not totp_secret:
            totp_secret = pyotp.random_base32()
            conn = db_manager.get_auth_connection()
            try:
                execute(
                    conn,
                    "UPDATE users_sensitive SET two_factor_secret = :secret WHERE user_id = :user_id",
                    {"secret": totp_secret, "user_id": user["id"]},
                )
                conn.commit()
            finally:
                conn.close()

        uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
            name=user["email"],
            issuer_name=auth_service.config.totp_issuer,
        )
        buf = io.BytesIO()
        segno.make_qr(uri).save(buf, kind="svg", scale=5, dark="#1e1b4b", light="#ffffff")
        qr_data_url = "data:image/svg+xml;base64," + base64.b64encode(buf.getvalue()).decode()

        return jsonify({"qrCodeUrl": qr_data_url, "secret": totp_secret}), 200

    @bp.route("/theme", methods=["PUT"])
    def auth_set_theme():
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        theme = str(body.get("theme", "")).strip()
        if theme not in ("light", "dark"):
            abort(400, description="theme must be 'light' or 'dark'")

        conn = db_manager.get_auth_connection()
        try:
            execute(
                conn,
                "UPDATE users SET theme = :theme WHERE id = :user_id",
                {"theme": theme, "user_id": user["id"]},
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"theme": theme}), 200

    @bp.route("/reader-state/course", methods=["GET"])
    def auth_get_reader_state_course():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Not authenticated")

        course_id_raw = request.args.get("course_id")
        course_id: int | None = None
        if course_id_raw is not None and str(course_id_raw).strip() != "":
            course_id = _to_int(course_id_raw, "course_id")

        topic_index_raw = request.args.get("topic_index")
        topic_index: int | None = None
        if topic_index_raw is not None and str(topic_index_raw).strip() != "":
            topic_index = _to_int(topic_index_raw, "topic_index")

        features = _viewer_features_for_user(auth_service, user)

        filtered_course_state: dict[str, Any] = {}
        if course_id is not None:
            conn = db_manager.get_auth_connection()
            try:
                raw_course_state = _fetch_course_reader_state(conn, int(user["id"]), course_id)
            finally:
                conn.close()
            normalized_course_state = _normalize_course_reader_state(raw_course_state)
            filtered_course_state = _filter_course_state_by_features(normalized_course_state, features)

        if topic_index is not None and course_id is not None:
            topic_key = str(topic_index)

            topic_highlights: dict[str, list[dict[str, Any]]] = {}
            all_highlights = filtered_course_state.get("highlights")
            if isinstance(all_highlights, dict):
                topic_rows = all_highlights.get(topic_key)
                if isinstance(topic_rows, list) and topic_rows:
                    topic_highlights[topic_key] = topic_rows
            filtered_course_state["highlights"] = topic_highlights

            topic_notes: dict[str, list[dict[str, Any]]] = {}
            all_topic_notes = filtered_course_state.get("topic_notes")
            if isinstance(all_topic_notes, dict):
                note_rows = all_topic_notes.get(topic_key)
                if isinstance(note_rows, list) and note_rows:
                    topic_notes[topic_key] = note_rows
            filtered_course_state["topic_notes"] = topic_notes

        return jsonify(
            {
                "course": filtered_course_state,
                "features": features,
            }
        ), 200

    @bp.route("/reader-state/course", methods=["PUT"])
    def auth_update_reader_state_course():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        include_course_raw = str(request.args.get("include_course", "1") or "").strip().lower()
        include_course = include_course_raw not in ("0", "false", "no", "off")
        course_id_raw = body.get("course_id")
        if course_id_raw is None:
            abort(400, description="course_id is required")
        course_id = _to_int(course_id_raw, "course_id")
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        features = _viewer_features_for_user(auth_service, user)
        highlights_enabled = bool(features.get("highlights_enabled", True))
        bookmarks_enabled = bool(features.get("bookmarks_enabled", True))
        notes_enabled = bool(features.get("notes_enabled", True))
        drawings_enabled = bool(features.get("drawings_enabled", True))

        conn = db_manager.get_auth_connection()
        try:
            course_state = _fetch_course_reader_state(conn, int(user["id"]), course_id)
            if not isinstance(course_state, dict):
                course_state = {}

            bookmarks = _clean_topic_list(course_state.get("bookmarks"))
            highlights = _clean_highlights_map(course_state.get("highlights"))
            topic_notes = _clean_topic_notes_map(course_state.get("topic_notes"))
            course_notes = _clean_course_notes_list(course_state.get("course_notes"))
            drawing_note = _clean_drawing_note(course_state.get("drawing_note"))

            if "last_highlight_color" in body:
                course_state["last_highlight_color"] = _normalize_highlight_color(body.get("last_highlight_color"))

            if "bookmark_topic_index" in body:
                if not bookmarks_enabled:
                    abort(403, description="Bookmarks are disabled by administrator")
                bookmark_idx = _to_int(body.get("bookmark_topic_index"), "bookmark_topic_index")
                bookmarked = bool(body.get("bookmarked", True))
                if bookmarked:
                    if bookmark_idx not in bookmarks:
                        bookmarks.append(bookmark_idx)
                else:
                    bookmarks = [item for item in bookmarks if item != bookmark_idx]
                course_state["bookmarks"] = bookmarks[-MAX_BOOKMARKS_PER_COURSE:]

            if "remove_bookmark_topic_indices" in body:
                if not bookmarks_enabled:
                    abort(403, description="Bookmarks are disabled by administrator")
                remove_indices = body.get("remove_bookmark_topic_indices")
                if not isinstance(remove_indices, list):
                    abort(400, description="remove_bookmark_topic_indices must be a list")
                try:
                    remove_set = {int(idx) for idx in remove_indices}
                except (ValueError, TypeError):
                    abort(400, description="remove_bookmark_topic_indices must contain integers")
                bookmarks = [item for item in bookmarks if item not in remove_set]
                course_state["bookmarks"] = bookmarks[-MAX_BOOKMARKS_PER_COURSE:]

            add_highlight = body.get("add_highlight")
            if add_highlight is not None:
                if not highlights_enabled:
                    abort(403, description="Highlights are disabled by administrator")
                if not isinstance(add_highlight, dict):
                    abort(400, description="add_highlight must be an object")
                topic_index = _to_int(add_highlight.get("topic_index"), "add_highlight.topic_index")
                text = str(add_highlight.get("text", "")).strip()
                if not text:
                    abort(400, description="add_highlight.text is required")
                context = str(add_highlight.get("context", "") or "").strip()
                quote_prefix = str(add_highlight.get("quote_prefix", "") or "").strip()
                quote_suffix = str(add_highlight.get("quote_suffix", "") or "").strip()
                note = str(add_highlight.get("note", "") or "").strip() if notes_enabled else ""
                color = _normalize_highlight_color(add_highlight.get("color"))
                start_offset = add_highlight.get("start_offset")
                end_offset = add_highlight.get("end_offset")
                component_index = add_highlight.get("component_index")
                start_offset_int: int | None = None
                end_offset_int: int | None = None
                component_index_int: int | None = None
                if start_offset is None or end_offset is None or component_index is None:
                    abort(400, description="add_highlight requires start_offset, end_offset, and component_index")
                try:
                    start_offset_int = int(start_offset)
                    end_offset_int = int(end_offset)
                except (TypeError, ValueError):
                    abort(400, description="add_highlight offsets must be numeric")
                if start_offset_int < 0 or end_offset_int <= start_offset_int:
                    abort(400, description="add_highlight offsets are invalid")
                try:
                    component_index_int = int(component_index)
                except (TypeError, ValueError):
                    abort(400, description="add_highlight.component_index must be numeric")
                if component_index_int < -1:
                    abort(400, description="add_highlight.component_index must be >= -1")
                topic_key = str(topic_index)
                topic_highlights = [item for item in highlights.get(topic_key, []) if isinstance(item, dict)]
                normalized_text_key = _normalize_highlight_text_key(text)
                should_add = True
                add_text = text[:MAX_HIGHLIGHT_TEXT_LEN]
                add_context = context[:MAX_HIGHLIGHT_CONTEXT_LEN]
                add_quote_prefix = quote_prefix[:MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN]
                add_quote_suffix = quote_suffix[:MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN]
                add_note = note[:MAX_HIGHLIGHT_NOTE_LEN]
                add_start = start_offset_int
                add_end = end_offset_int
                add_component = component_index_int

                if (
                    start_offset_int is not None
                    and end_offset_int is not None
                    and component_index_int is not None
                ):
                    overlaps: list[dict[str, Any]] = []
                    merged_start = start_offset_int
                    merged_end = end_offset_int
                    for item in topic_highlights:
                        item_start = _coerce_non_negative_int(item.get("start_offset"))
                        item_end = _coerce_non_negative_int(item.get("end_offset"))
                        item_component = _coerce_component_index(item.get("component_index"))
                        if (
                            item_start is None
                            or item_end is None
                            or item_component is None
                            or item_end <= item_start
                            or item_component != component_index_int
                        ):
                            continue
                        if item_start <= start_offset_int and item_end >= end_offset_int:
                            # New selection is fully contained by an existing highlight; keep existing row intact.
                            should_add = False
                            break
                        if item_start == start_offset_int and item_end == end_offset_int:
                            should_add = False
                            break
                        if item_start < end_offset_int and item_end > start_offset_int:
                            overlaps.append(item)
                            merged_start = min(merged_start, item_start)
                            merged_end = max(merged_end, item_end)
                            item_text = str(item.get("text", "")).strip()
                            if len(item_text) > len(add_text):
                                add_text = item_text[:MAX_HIGHLIGHT_TEXT_LEN]
                            if not add_context:
                                add_context = str(item.get("context", "") or "")[:MAX_HIGHLIGHT_CONTEXT_LEN]
                            if not add_quote_prefix:
                                add_quote_prefix = str(item.get("quote_prefix", "") or "")[:MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN]
                            if not add_quote_suffix:
                                add_quote_suffix = str(item.get("quote_suffix", "") or "")[:MAX_HIGHLIGHT_QUOTE_CONTEXT_LEN]
                            if not add_note:
                                add_note = str(item.get("note", "") or "")[:MAX_HIGHLIGHT_NOTE_LEN]
                    if should_add:
                        if overlaps:
                            overlap_ids = {
                                str(item.get("id", "")).strip()
                                for item in overlaps
                                if str(item.get("id", "")).strip()
                            }
                            topic_highlights = [
                                item
                                for item in topic_highlights
                                if str(item.get("id", "")).strip() not in overlap_ids
                            ]
                        add_start = merged_start
                        add_end = merged_end
                else:
                    for item in topic_highlights:
                        item_component = _coerce_component_index(item.get("component_index"))
                        item_text_key = _normalize_highlight_text_key(item.get("text"))
                        if item_text_key != normalized_text_key:
                            continue
                        if component_index_int is not None and item_component != component_index_int:
                            continue
                        should_add = False
                        break

                if should_add:
                    topic_highlights.append(
                        {
                            "id": uuid.uuid4().hex,
                            "text": add_text,
                            "context": add_context,
                            "quote_prefix": add_quote_prefix,
                            "quote_suffix": add_quote_suffix,
                            "note": add_note,
                            "color": color,
                            "created_at": now_iso,
                            "start_offset": add_start,
                            "end_offset": add_end,
                            "component_index": add_component,
                        }
                    )
                highlights[topic_key] = topic_highlights[-MAX_HIGHLIGHTS_PER_TOPIC:]
                all_highlights: list[tuple[str, dict[str, Any]]] = []
                for t_key, rows in highlights.items():
                    for row in rows:
                        all_highlights.append((t_key, row))
                if len(all_highlights) > MAX_HIGHLIGHTS_PER_COURSE:
                    all_highlights.sort(key=lambda item: str(item[1].get("created_at", "")))
                    keep = all_highlights[-MAX_HIGHLIGHTS_PER_COURSE:]
                    rebuilt: dict[str, list[dict[str, Any]]] = {}
                    for t_key, row in keep:
                        rebuilt.setdefault(t_key, []).append(row)
                    highlights = rebuilt
                course_state["highlights"] = highlights

            remove_highlight = body.get("remove_highlight")
            if remove_highlight is not None:
                if not highlights_enabled:
                    abort(403, description="Highlights are disabled by administrator")
                if not isinstance(remove_highlight, dict):
                    abort(400, description="remove_highlight must be an object")
                topic_index = _to_int(remove_highlight.get("topic_index"), "remove_highlight.topic_index")
                highlight_id = str(remove_highlight.get("highlight_id", "")).strip()
                if not highlight_id:
                    abort(400, description="remove_highlight.highlight_id is required")
                topic_key = str(topic_index)
                topic_highlights = highlights.get(topic_key, [])
                topic_highlights = [
                    item
                    for item in topic_highlights
                    if str(item.get("id", "")).strip() != highlight_id
                ]
                if topic_highlights:
                    highlights[topic_key] = topic_highlights
                else:
                    highlights.pop(topic_key, None)
                course_state["highlights"] = highlights

            update_highlight_note = body.get("update_highlight_note")
            if update_highlight_note is not None:
                if not highlights_enabled:
                    abort(403, description="Highlights are disabled by administrator")
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(update_highlight_note, dict):
                    abort(400, description="update_highlight_note must be an object")
                topic_index = _to_int(update_highlight_note.get("topic_index"), "update_highlight_note.topic_index")
                highlight_id = str(update_highlight_note.get("highlight_id", "")).strip()
                if not highlight_id:
                    abort(400, description="update_highlight_note.highlight_id is required")
                note = str(update_highlight_note.get("note", "") or "")[:MAX_HIGHLIGHT_NOTE_LEN]
                topic_key = str(topic_index)
                topic_highlights = highlights.get(topic_key, [])
                updated = False
                for item in topic_highlights:
                    if str(item.get("id", "")).strip() == highlight_id:
                        item["note"] = note
                        updated = True
                        break
                if not updated:
                    abort(404, description="Highlight not found for note update")
                highlights[topic_key] = topic_highlights
                course_state["highlights"] = highlights

            update_highlight_color = body.get("update_highlight_color")
            if update_highlight_color is not None:
                if not highlights_enabled:
                    abort(403, description="Highlights are disabled by administrator")
                if not isinstance(update_highlight_color, dict):
                    abort(400, description="update_highlight_color must be an object")
                topic_index = _to_int(update_highlight_color.get("topic_index"), "update_highlight_color.topic_index")
                highlight_id = str(update_highlight_color.get("highlight_id", "")).strip()
                if not highlight_id:
                    abort(400, description="update_highlight_color.highlight_id is required")
                color = _normalize_highlight_color(update_highlight_color.get("color"))
                topic_key = str(topic_index)
                topic_highlights = highlights.get(topic_key, [])
                updated = False
                for item in topic_highlights:
                    if str(item.get("id", "")).strip() == highlight_id:
                        item["color"] = color
                        updated = True
                        break
                if not updated:
                    abort(404, description="Highlight not found for color update")
                highlights[topic_key] = topic_highlights
                course_state["highlights"] = highlights

            clear_highlights_topic_index = body.get("clear_highlights_topic_index")
            if clear_highlights_topic_index is not None:
                if not highlights_enabled:
                    abort(403, description="Highlights are disabled by administrator")
                topic_index = _to_int(clear_highlights_topic_index, "clear_highlights_topic_index")
                highlights.pop(str(topic_index), None)
                course_state["highlights"] = highlights

            add_topic_note = body.get("add_topic_note")
            if add_topic_note is not None:
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(add_topic_note, dict):
                    abort(400, description="add_topic_note must be an object")
                topic_index = _to_int(add_topic_note.get("topic_index"), "add_topic_note.topic_index")
                text = str(add_topic_note.get("text", "") or "").strip()
                if not text:
                    abort(400, description="add_topic_note.text is required")
                topic_key = str(topic_index)
                rows = [item for item in topic_notes.get(topic_key, []) if isinstance(item, dict)]
                normalized_text = _normalize_highlight_text_key(text)
                duplicate = any(_normalize_highlight_text_key(item.get("text")) == normalized_text for item in rows)
                if not duplicate:
                    rows.append(
                        {
                            "id": uuid.uuid4().hex,
                            "text": text[:MAX_TOPIC_NOTE_TEXT_LEN],
                            "created_at": now_iso,
                        }
                    )
                topic_notes[topic_key] = rows[-MAX_TOPIC_NOTES_PER_TOPIC:]

                all_notes: list[tuple[str, dict[str, Any]]] = []
                for t_key, note_rows in topic_notes.items():
                    for row in note_rows:
                        if isinstance(row, dict):
                            all_notes.append((t_key, row))
                if len(all_notes) > MAX_TOPIC_NOTES_PER_COURSE:
                    all_notes.sort(key=lambda item: str(item[1].get("created_at", "")))
                    keep = all_notes[-MAX_TOPIC_NOTES_PER_COURSE:]
                    rebuilt_notes: dict[str, list[dict[str, Any]]] = {}
                    for t_key, row in keep:
                        rebuilt_notes.setdefault(t_key, []).append(row)
                    topic_notes = rebuilt_notes
                course_state["topic_notes"] = topic_notes

            remove_topic_note = body.get("remove_topic_note")
            if remove_topic_note is not None:
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(remove_topic_note, dict):
                    abort(400, description="remove_topic_note must be an object")
                topic_index = _to_int(remove_topic_note.get("topic_index"), "remove_topic_note.topic_index")
                note_id = str(remove_topic_note.get("note_id", "")).strip()
                if not note_id:
                    abort(400, description="remove_topic_note.note_id is required")
                topic_key = str(topic_index)
                rows = [item for item in topic_notes.get(topic_key, []) if isinstance(item, dict)]
                rows = [item for item in rows if str(item.get("id", "")).strip() != note_id]
                if rows:
                    topic_notes[topic_key] = rows
                else:
                    topic_notes.pop(topic_key, None)
                course_state["topic_notes"] = topic_notes

            update_topic_note = body.get("update_topic_note")
            if update_topic_note is not None:
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(update_topic_note, dict):
                    abort(400, description="update_topic_note must be an object")
                topic_index = _to_int(update_topic_note.get("topic_index"), "update_topic_note.topic_index")
                note_id = str(update_topic_note.get("note_id", "")).strip()
                if not note_id:
                    abort(400, description="update_topic_note.note_id is required")
                text = str(update_topic_note.get("text", "") or "").strip()
                if not text:
                    abort(400, description="update_topic_note.text is required")
                topic_key = str(topic_index)
                rows = [item for item in topic_notes.get(topic_key, []) if isinstance(item, dict)]
                updated = False
                for row in rows:
                    if str(row.get("id", "")).strip() == note_id:
                        row["text"] = text[:MAX_TOPIC_NOTE_TEXT_LEN]
                        row["updated_at"] = now_iso
                        updated = True
                        break
                if not updated:
                    abort(404, description="Topic note not found for update")
                topic_notes[topic_key] = rows
                course_state["topic_notes"] = topic_notes

            add_course_note = body.get("add_course_note")
            if add_course_note is not None:
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(add_course_note, dict):
                    abort(400, description="add_course_note must be an object")
                text = str(add_course_note.get("text", "") or "").strip()
                if not text:
                    abort(400, description="add_course_note.text is required")
                normalized_text = _normalize_highlight_text_key(text)
                duplicate = any(
                    _normalize_highlight_text_key(item.get("text")) == normalized_text
                    for item in course_notes
                    if isinstance(item, dict)
                )
                if not duplicate:
                    course_notes.append(
                        {
                            "id": uuid.uuid4().hex,
                            "text": text[:MAX_COURSE_NOTE_TEXT_LEN],
                            "created_at": now_iso,
                            "updated_at": now_iso,
                        }
                    )
                course_notes = _clean_course_notes_list(course_notes)
                course_state["course_notes"] = course_notes

            update_course_note = body.get("update_course_note")
            if update_course_note is not None:
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(update_course_note, dict):
                    abort(400, description="update_course_note must be an object")
                note_id = str(update_course_note.get("note_id", "")).strip()
                if not note_id:
                    abort(400, description="update_course_note.note_id is required")
                text = str(update_course_note.get("text", "") or "").strip()
                if not text:
                    abort(400, description="update_course_note.text is required")
                updated = False
                for row in course_notes:
                    if str(row.get("id", "")).strip() == note_id:
                        row["text"] = text[:MAX_COURSE_NOTE_TEXT_LEN]
                        row["updated_at"] = now_iso
                        updated = True
                        break
                if not updated:
                    abort(404, description="Course note not found for update")
                course_notes = _clean_course_notes_list(course_notes)
                course_state["course_notes"] = course_notes

            remove_course_note = body.get("remove_course_note")
            if remove_course_note is not None:
                if not notes_enabled:
                    abort(403, description="Notes are disabled by administrator")
                if not isinstance(remove_course_note, dict):
                    abort(400, description="remove_course_note must be an object")
                note_id = str(remove_course_note.get("note_id", "")).strip()
                if not note_id:
                    abort(400, description="remove_course_note.note_id is required")
                course_notes = [
                    row for row in course_notes
                    if str(row.get("id", "")).strip() != note_id
                ]
                course_state["course_notes"] = course_notes

            upsert_course_drawing_note = body.get("upsert_course_drawing_note")
            if upsert_course_drawing_note is not None:
                if not drawings_enabled:
                    abort(403, description="Drawing notes are disabled by administrator")
                if not isinstance(upsert_course_drawing_note, dict):
                    abort(400, description="upsert_course_drawing_note must be an object")
                scene = _clean_drawing_scene(upsert_course_drawing_note.get("scene"))
                if scene is None:
                    abort(400, description="upsert_course_drawing_note.scene is invalid or too large")
                drawing_note = {
                    "scene": scene,
                    "updated_at": now_iso,
                }
                course_state["drawing_note"] = drawing_note

            remove_course_drawing_note = body.get("remove_course_drawing_note")
            if remove_course_drawing_note is not None:
                if not drawings_enabled:
                    abort(403, description="Drawing notes are disabled by administrator")
                if not isinstance(remove_course_drawing_note, dict):
                    abort(400, description="remove_course_drawing_note must be an object")
                drawing_note = None
                course_state.pop("drawing_note", None)

            if "bookmarks" not in course_state:
                course_state["bookmarks"] = bookmarks[-MAX_BOOKMARKS_PER_COURSE:]
            if "highlights" not in course_state:
                course_state["highlights"] = highlights
            if "topic_notes" not in course_state:
                course_state["topic_notes"] = topic_notes
            if "course_notes" not in course_state:
                course_state["course_notes"] = course_notes
            if "drawing_note" not in course_state and drawing_note is not None:
                course_state["drawing_note"] = drawing_note

            _upsert_course_reader_state(
                conn=conn,
                user_id=int(user["id"]),
                course_id=course_id,
                state=course_state,
                now_iso=now_iso,
                is_integrity_error=db_manager.auth_backend.is_integrity_error,
            )
            conn.commit()
        finally:
            conn.close()

        if not include_course:
            return jsonify({"ok": True}), 200

        if isinstance(course_state, dict):
            course_state = _filter_course_state_by_features(course_state, features)

        return jsonify({"ok": True, "course": course_state}), 200

    @bp.route("/progress/topic", methods=["POST"])
    def auth_progress_topic():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        course_id = body.get("course_id")
        topic_index = body.get("topic_index")
        completed = bool(body.get("completed", False))

        if course_id is None or topic_index is None:
            abort(400, description="course_id and topic_index are required")

        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        conn = db_manager.get_auth_connection()
        try:
            db_manager.upsert_user_progress(
                conn,
                user_id=int(user["id"]),
                course_id=int(course_id),
                topic_index=int(topic_index),
                completed=completed,
                now_iso=now_iso,
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"ok": True}), 200

    @bp.route("/progress/course", methods=["DELETE"])
    def auth_reset_course_progress():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Not authenticated")

        data = request.get_json(force=True, silent=True) or {}
        course_id = data.get("course_id")
        if course_id is None:
            abort(400, description="course_id is required")
        course_id_int = _to_int(course_id, "course_id")
        raw_scopes = data.get("scopes")
        if raw_scopes is None:
            scopes = {"progress"}
        else:
            if not isinstance(raw_scopes, list):
                abort(400, description="scopes must be an array")
            scopes = {
                str(scope).strip().lower()
                for scope in raw_scopes
                if str(scope).strip()
            }
            if not scopes:
                abort(400, description="At least one reset scope is required")
            invalid_scopes = [scope for scope in scopes if scope not in RESET_SCOPES]
            if invalid_scopes:
                abort(400, description=f"Unsupported reset scope(s): {', '.join(invalid_scopes)}")
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        conn = db_manager.get_auth_connection()
        try:
            user_id_int = int(user["id"])
            if "progress" in scopes:
                execute(
                    conn,
                    "DELETE FROM user_progress WHERE user_id = :user_id AND course_id = :course_id",
                    {"user_id": user_id_int, "course_id": course_id_int},
                )

            if {"bookmarks", "highlights", "notes", "drawing"} & scopes:
                course_state = _fetch_course_reader_state(conn, user_id_int, course_id_int)
                if isinstance(course_state, dict) and course_state:
                    if "bookmarks" in scopes:
                        course_state["bookmarks"] = []
                    if "highlights" in scopes:
                        course_state["highlights"] = {}
                    if "notes" in scopes:
                        course_state["topic_notes"] = {}
                        course_state["course_notes"] = []
                    if "drawing" in scopes:
                        course_state.pop("drawing_note", None)

                    _upsert_course_reader_state(
                        conn=conn,
                        user_id=user_id_int,
                        course_id=course_id_int,
                        state=course_state,
                        now_iso=now_iso,
                        is_integrity_error=db_manager.auth_backend.is_integrity_error,
                    )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"ok": True, "scopes": sorted(scopes)}), 200

    @bp.route("/signup/rollback", methods=["POST"])
    def auth_signup_rollback():
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            resp = jsonify({"message": "No partial session found"})
            resp.delete_cookie("ev_token", path="/", samesite="Lax")
            resp.delete_cookie("ev_session", path="/", samesite="Lax")
            return resp, 200

        if user.get("two_factor_confirmed"):
            abort(403, description="Account is already fully set up; rollback not allowed")

        conn = db_manager.get_auth_connection()
        try:
            execute(
                conn,
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

    @bp.route("/2fa/enable", methods=["POST"])
    def auth_2fa_enable():
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        code = str(body.get("code", "")).strip()

        if not user.get("two_factor_secret"):
            abort(400, description="2FA setup not started. Call GET /auth/2fa/setup first.")
        if not pyotp.TOTP(user["two_factor_secret"]).verify(code, valid_window=1):
            abort(400, description="Invalid authenticator code")

        client_ip = auth_service.get_client_ip()

        conn = db_manager.get_auth_connection()
        try:
            execute(
                conn,
                "UPDATE users SET two_factor_enabled = 1 WHERE id = :user_id",
                {"user_id": user["id"]},
            )

            user = auth_service.fetch_user_by_id(conn, int(user["id"]))
            if not user:
                abort(401, description="Not authenticated")

            token = auth_service.make_full_token(user)
            token_queue_json = auth_service.append_session_token(
                user.get("current_token"),
                token=token,
                max_active_sessions=user.get("max_active_sessions"),
                client_ip=client_ip,
            )

            execute(
                conn,
                "UPDATE users_sensitive SET two_factor_confirmed = 1, "
                "onboarding_temp_password_hash = NULL, "
                "current_token = :token "
                "WHERE user_id = :user_id",
                {
                    "token": token_queue_json,
                    "user_id": user["id"],
                },
            )
            conn.commit()

            user = auth_service.fetch_user_by_id(conn, int(user["id"]))
        finally:
            conn.close()

        if not user:
            abort(500, description="Failed to load account after 2FA enable")

        return jsonify({"token": token, "user": auth_service.user_public(user)}), 200

    @bp.route("/2fa/verify", methods=["POST"])
    def auth_2fa_verify():
        user, _ = auth_service.resolve_user(require_full=False)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        code = str(body.get("code", "")).strip()

        if not user.get("two_factor_secret") or not user.get("two_factor_confirmed"):
            abort(400, description="2FA is not configured for this account")
        if not pyotp.TOTP(user["two_factor_secret"]).verify(code, valid_window=1):
            abort(401, description="Invalid authenticator code")

        client_ip = auth_service.get_client_ip()

        conn = db_manager.get_auth_connection()
        try:
            token = auth_service.make_full_token(user)
            token_queue_json = auth_service.append_session_token(
                user.get("current_token"),
                token=token,
                max_active_sessions=user.get("max_active_sessions"),
                client_ip=client_ip,
            )

            execute(
                conn,
                "UPDATE users_sensitive SET current_token = :token WHERE user_id = :user_id",
                {
                    "token": token_queue_json,
                    "user_id": user["id"],
                },
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"token": token, "user": auth_service.user_public(user)}), 200

    @bp.route("/forgot-password/request", methods=["POST"])
    def auth_forgot_password_request():
        data = request.get_json(force=True, silent=True) or {}
        email = str(data.get("email", "")).strip().lower()

        if not email or not EMAIL_RE.match(email):
            abort(400, description="Invalid email address")

        conn = db_manager.get_auth_connection()
        try:
            user = auth_service.fetch_user_by_email(conn, email)
        finally:
            conn.close()

        if user and user.get("two_factor_secret") and not user.get("two_factor_confirmed"):
            abort(
                400,
                description=(
                    "This account has incomplete two-factor authentication setup. "
                    "Password reset is not available. Please create a new account or contact support."
                ),
            )

        if not user or not user.get("two_factor_confirmed") or not user.get("two_factor_secret"):
            abort(
                400,
                description=(
                    "No account with a verified authenticator was found for that email. "
                    "If you set up 2FA during sign-up, try again or contact support."
                ),
            )

        now = int(time.time())
        token = pyjwt.encode(
            {
                "id": user["id"],
                "scope": "pw_reset_pending",
                "iat": now,
                "exp": now + 600,
            },
            auth_service.config.jwt_secret,
            algorithm="HS256",
        )
        return jsonify({"token": token, "requiresTwoFactor": True}), 200

    @bp.route("/forgot-password/verify", methods=["POST"])
    def auth_forgot_password_verify():
        token_raw = auth_service.bearer_token()
        if not token_raw:
            abort(401, description="Reset session token required")

        payload = auth_service.decode_token(token_raw)
        if not payload or payload.get("scope") != "pw_reset_pending":
            abort(401, description="Invalid or expired password-reset session")

        body = request.get_json(force=True, silent=True) or {}
        code = str(body.get("code", "")).strip()

        if len(code) != 6 or not code.isdigit():
            abort(400, description="Enter the 6-digit code from your authenticator app")

        conn = db_manager.get_auth_connection()
        try:
            user = auth_service.fetch_user_by_id(conn, int(payload["id"]))
        finally:
            conn.close()

        if not user or not user.get("two_factor_secret"):
            abort(401, description="Invalid reset session")

        if not pyotp.TOTP(user["two_factor_secret"]).verify(code, valid_window=1):
            abort(400, description="Invalid authenticator code")

        now = int(time.time())
        confirmed_token = pyjwt.encode(
            {
                "id": user["id"],
                "scope": "pw_reset_confirmed",
                "iat": now,
                "exp": now + 300,
            },
            auth_service.config.jwt_secret,
            algorithm="HS256",
        )
        return jsonify({"token": confirmed_token}), 200

    @bp.route("/forgot-password/reset", methods=["POST"])
    def auth_forgot_password_reset():
        token_raw = auth_service.bearer_token()
        if not token_raw:
            abort(401, description="Reset session token required")

        payload = auth_service.decode_token(token_raw)
        if not payload or payload.get("scope") != "pw_reset_confirmed":
            abort(401, description="Invalid or expired password-reset session")

        body = request.get_json(force=True, silent=True) or {}
        password = auth_service.decrypt_password(str(body.get("password", "")))

        if len(password) < 8 or len(password) > 72:
            abort(400, description="Password must be 8-72 characters")

        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

        conn = db_manager.get_auth_connection()
        try:
            execute(
                conn,
                "UPDATE users_sensitive "
                "SET password_hash = :pw_hash, current_token = NULL "
                "WHERE user_id = :user_id",
                {"pw_hash": pw_hash, "user_id": int(payload["id"])},
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"message": "Password updated. Please sign in with your new password."}), 200

    return bp
