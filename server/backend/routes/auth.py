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
MAX_HIGHLIGHT_NOTE_LEN = 800
ALLOWED_HIGHLIGHT_COLORS: set[str] = {"yellow", "blue", "green", "pink", "orange"}


def _normalize_highlight_color(value: Any) -> str:
    color = str(value or "").strip().lower()
    if color in ALLOWED_HIGHLIGHT_COLORS:
        return color
    return "yellow"


def _to_int(value: Any, field: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        abort(400, description=f"{field} must be a number")


def _parse_viewer_settings(raw: Any) -> dict[str, Any]:
    if not raw:
        return {"courses": {}}
    try:
        parsed = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {"courses": {}}
    if not isinstance(parsed, dict):
        return {"courses": {}}
    courses = parsed.get("courses")
    if not isinstance(courses, dict):
        parsed["courses"] = {}
    return parsed


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
            rows.append(
                {
                    "id": str(item.get("id", "") or uuid.uuid4().hex),
                    "text": text[:MAX_HIGHLIGHT_TEXT_LEN],
                    "context": str(item.get("context", "") or "")[:MAX_HIGHLIGHT_CONTEXT_LEN],
                    "note": str(item.get("note", "") or "")[:MAX_HIGHLIGHT_NOTE_LEN],
                    "color": _normalize_highlight_color(item.get("color")),
                    "created_at": str(item.get("created_at", "") or ""),
                    "start_offset": start_offset,
                    "end_offset": end_offset,
                    "component_index": int(item.get("component_index")) if str(item.get("component_index", "")).strip().isdigit() else None,
                }
            )
        if rows:
            cleaned[topic_key] = rows[-MAX_HIGHLIGHTS_PER_TOPIC:]
    return cleaned


def _strip_highlights_from_settings(settings: dict[str, Any]) -> dict[str, Any]:
    courses = settings.get("courses")
    if not isinstance(courses, dict):
        return settings
    for course_state in courses.values():
        if isinstance(course_state, dict):
            course_state.pop("highlights", None)
    return settings


def _viewer_features_for_user(auth_service: AuthService, user: dict[str, Any]) -> dict[str, bool]:
    return resolve_viewer_features_for_role(
        str(user.get("role", "") or ""),
        auth_service.config.viewer_feature_flags,
        auth_service.config.viewer_feature_role_overrides,
    )


def _filter_settings_by_features(
    settings: dict[str, Any],
    features: dict[str, bool],
) -> dict[str, Any]:
    courses = settings.get("courses")
    if not isinstance(courses, dict):
        return settings

    highlights_enabled = bool(features.get("highlights_enabled", True))
    bookmarks_enabled = bool(features.get("bookmarks_enabled", True))
    notes_enabled = bool(features.get("notes_enabled", True))

    for course_state in courses.values():
        if not isinstance(course_state, dict):
            continue
        if not bookmarks_enabled:
            course_state.pop("bookmarks", None)
        if not highlights_enabled:
            course_state.pop("highlights", None)
            continue
        if notes_enabled:
            continue
        highlights = course_state.get("highlights")
        if not isinstance(highlights, dict):
            continue
        for topic_rows in highlights.values():
            if not isinstance(topic_rows, list):
                continue
            for item in topic_rows:
                if isinstance(item, dict):
                    item.pop("note", None)
    return settings


def _filter_course_state_by_features(
    course_state: dict[str, Any],
    features: dict[str, bool],
) -> dict[str, Any]:
    filtered = dict(course_state)
    highlights_enabled = bool(features.get("highlights_enabled", True))
    bookmarks_enabled = bool(features.get("bookmarks_enabled", True))
    notes_enabled = bool(features.get("notes_enabled", True))

    if not bookmarks_enabled:
        filtered.pop("bookmarks", None)
    if not highlights_enabled:
        filtered.pop("highlights", None)
        return filtered
    if notes_enabled:
        return filtered

    raw_highlights = filtered.get("highlights")
    if not isinstance(raw_highlights, dict):
        return filtered

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

        new_session_id = str(uuid.uuid4())
        client_ip = auth_service.get_client_ip()

        conn2 = db_manager.get_auth_connection()
        try:
            auth_service.check_ip_restriction(conn2, user, client_ip)
            user["session_id"] = new_session_id
            token = auth_service.make_full_token(user)
            execute(
                conn2,
                "UPDATE users_sensitive SET session_id = :session_id, last_login_ip = :ip, "
                "last_login_at = :login_at, current_token = :token WHERE user_id = :user_id",
                {
                    "session_id": new_session_id,
                    "ip": client_ip,
                    "login_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "token": token,
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
            conn = db_manager.get_auth_connection()
            try:
                execute(
                    conn,
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

    @bp.route("/viewer-settings", methods=["GET"])
    def auth_get_viewer_settings():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Not authenticated")

        features = _viewer_features_for_user(auth_service, user)
        settings = _parse_viewer_settings(user.get("viewer_settings_json"))
        settings = _filter_settings_by_features(settings, features)
        return jsonify(
            {
                "settings": settings,
                "features": features,
            }
        ), 200

    @bp.route("/viewer-settings/course", methods=["PUT"])
    def auth_update_viewer_settings_course():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Not authenticated")

        body = request.get_json(force=True, silent=True) or {}
        course_id_raw = body.get("course_id")
        if course_id_raw is None:
            abort(400, description="course_id is required")
        course_id = _to_int(course_id_raw, "course_id")
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        features = _viewer_features_for_user(auth_service, user)
        highlights_enabled = bool(features.get("highlights_enabled", True))
        bookmarks_enabled = bool(features.get("bookmarks_enabled", True))
        notes_enabled = bool(features.get("notes_enabled", True))

        conn = db_manager.get_auth_connection()
        try:
            row = fetch_one_dict(
                conn,
                "SELECT viewer_settings_json FROM users WHERE id = :user_id",
                {"user_id": user["id"]},
            ) or {}
            settings = _parse_viewer_settings(row.get("viewer_settings_json"))
            courses = settings.setdefault("courses", {})
            if not isinstance(courses, dict):
                courses = {}
                settings["courses"] = courses

            course_key = str(course_id)
            course_state = courses.get(course_key, {})
            if not isinstance(course_state, dict):
                course_state = {}

            bookmarks = _clean_topic_list(course_state.get("bookmarks"))
            highlights = _clean_highlights_map(course_state.get("highlights"))

            if "last_topic_index" in body:
                course_state["last_topic_index"] = _to_int(body.get("last_topic_index"), "last_topic_index")

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
                note = str(add_highlight.get("note", "") or "").strip() if notes_enabled else ""
                color = _normalize_highlight_color(add_highlight.get("color"))
                start_offset = add_highlight.get("start_offset")
                end_offset = add_highlight.get("end_offset")
                component_index = add_highlight.get("component_index")
                start_offset_int: int | None = None
                end_offset_int: int | None = None
                component_index_int: int | None = None
                if start_offset is not None and end_offset is not None:
                    try:
                        start_offset_int = int(start_offset)
                        end_offset_int = int(end_offset)
                    except (TypeError, ValueError):
                        abort(400, description="add_highlight offsets must be numeric")
                    if start_offset_int < 0 or end_offset_int <= start_offset_int:
                        abort(400, description="add_highlight offsets are invalid")
                if component_index is not None:
                    try:
                        component_index_int = int(component_index)
                    except (TypeError, ValueError):
                        abort(400, description="add_highlight.component_index must be numeric")
                    if component_index_int < 0:
                        abort(400, description="add_highlight.component_index must be >= 0")
                topic_key = str(topic_index)
                topic_highlights = highlights.get(topic_key, [])
                if start_offset_int is not None and end_offset_int is not None:
                    duplicate = any(
                        int(item.get("start_offset") or -1) == start_offset_int
                        and int(item.get("end_offset") or -1) == end_offset_int
                        and int(item.get("component_index") or -1) == int(component_index_int or -1)
                        for item in topic_highlights
                    )
                    if duplicate:
                        course_state["highlights"] = highlights
                        courses[course_key] = course_state
                        settings_json = json.dumps(settings, separators=(",", ":"))
                        execute(
                            conn,
                            "UPDATE users SET viewer_settings_json = :settings WHERE id = :user_id",
                            {"settings": settings_json, "user_id": user["id"]},
                        )
                        conn.commit()
                        return jsonify({"ok": True, "course": course_state}), 200
                topic_highlights.append(
                    {
                        "id": uuid.uuid4().hex,
                        "text": text[:MAX_HIGHLIGHT_TEXT_LEN],
                        "context": context[:MAX_HIGHLIGHT_CONTEXT_LEN],
                        "note": note[:MAX_HIGHLIGHT_NOTE_LEN],
                        "color": color,
                        "created_at": now_iso,
                        "start_offset": start_offset_int,
                        "end_offset": end_offset_int,
                        "component_index": component_index_int,
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

            if "bookmarks" not in course_state:
                course_state["bookmarks"] = bookmarks[-MAX_BOOKMARKS_PER_COURSE:]
            if "highlights" not in course_state:
                course_state["highlights"] = highlights

            courses[course_key] = course_state
            settings_json = json.dumps(settings, separators=(",", ":"))
            execute(
                conn,
                "UPDATE users SET viewer_settings_json = :settings WHERE id = :user_id",
                {"settings": settings_json, "user_id": user["id"]},
            )
            conn.commit()
        finally:
            conn.close()

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

        conn = db_manager.get_auth_connection()
        try:
            execute(
                conn,
                "DELETE FROM user_progress WHERE user_id = :user_id AND course_id = :course_id",
                {"user_id": user["id"], "course_id": int(course_id)},
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"ok": True, "message": "Course progress has been reset"}), 200

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

        new_session_id = str(uuid.uuid4())
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

            auth_service.check_ip_restriction(conn, user, client_ip)
            user["session_id"] = new_session_id
            token = auth_service.make_full_token(user)

            execute(
                conn,
                "UPDATE users_sensitive SET two_factor_confirmed = 1, "
                "onboarding_temp_password_hash = NULL, "
                "session_id = :session_id, last_login_ip = :ip, "
                "last_login_at = :login_at, current_token = :token "
                "WHERE user_id = :user_id",
                {
                    "session_id": new_session_id,
                    "ip": client_ip,
                    "login_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "token": token,
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

        new_session_id = str(uuid.uuid4())
        client_ip = auth_service.get_client_ip()

        conn = db_manager.get_auth_connection()
        try:
            auth_service.check_ip_restriction(conn, user, client_ip)
            user["session_id"] = new_session_id
            token = auth_service.make_full_token(user)

            execute(
                conn,
                "UPDATE users_sensitive SET session_id = :session_id, last_login_ip = :ip, "
                "last_login_at = :login_at, current_token = :token WHERE user_id = :user_id",
                {
                    "session_id": new_session_id,
                    "ip": client_ip,
                    "login_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "token": token,
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
                "SET password_hash = :pw_hash, session_id = NULL, current_token = NULL "
                "WHERE user_id = :user_id",
                {"pw_hash": pw_hash, "user_id": int(payload["id"])},
            )
            conn.commit()
        finally:
            conn.close()

        return jsonify({"message": "Password updated. Please sign in with your new password."}), 200

    return bp
