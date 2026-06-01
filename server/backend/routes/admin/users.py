"""
Admin – User Management
=======================
Endpoints for administrators to list and manage user accounts.
"""

from __future__ import annotations

import json
import hashlib
import secrets
import string
import time
from typing import Any

import bcrypt
from flask import Blueprint, jsonify, abort

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from backend.db.sql_helpers import execute, fetch_all_dict
from backend.routes.admin.helpers import require_admin, get_json_body, parse_int_field

EMAIL_RE = __import__("re").compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TEMP_PW_EXPIRES_HOURS = 1
USER_DATA_CLEANUP_SCOPES = {"bookmarks", "highlights", "notes", "drawing", "progress", "all"}
GLOBAL_CLEANUP_SCOPES = {"bookmarks", "highlights", "notes", "drawing", "progress", "tokens", "all"}
MAX_ACTIVE_SESSIONS_LIMIT = 20
MAX_IP_ADDRESSES_LIMIT = 20


def _gen_temp_password(length: int = 12) -> str:
    """Generate a random alphanumeric temporary password."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _parse_reader_state(raw: Any) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return parsed


def _cleanup_reader_state_by_scope(state: dict[str, Any], scope: str) -> tuple[dict[str, Any], bool]:
    next_state = dict(state)
    changed = False
    if scope in {"bookmarks", "all"} and next_state.get("bookmarks"):
        next_state["bookmarks"] = []
        changed = True
    if scope in {"highlights", "all"} and next_state.get("highlights"):
        next_state["highlights"] = {}
        changed = True
    if scope in {"notes", "all"}:
        if next_state.get("topic_notes"):
            next_state["topic_notes"] = {}
            changed = True
        if next_state.get("course_notes"):
            next_state["course_notes"] = []
            changed = True
    if scope in {"drawing", "all"} and "drawing_note" in next_state:
        next_state.pop("drawing_note", None)
        changed = True
    return next_state, changed


def _trim_session_queue_json(auth_service: AuthService, queue_raw: Any, max_active_sessions: int) -> str:
    queue = auth_service.parse_session_queue(queue_raw)
    trimmed = queue[-max_active_sessions:]
    return auth_service.serialize_session_queue(trimmed)


def _session_key_from_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:24]


def register_user_routes(bp: Blueprint, auth_service: AuthService, db_manager: DBManager) -> None:
    """Register user management routes into the provided admin blueprint."""

    @bp.route("/users", methods=["GET"])
    def get_all_users():
        """List all users with their roles and security status."""
        require_admin(auth_service)

        rows = db_manager.auth_backend.get_all_users()

        users = []
        for row in rows:
            users.append({
                "id": row["id"],
                "email": row["email"],
                "name": row["name"],
                "username": row["username"],
                "role_id": row["role_id"],
                "role_name": row["role_name"],
                "is_active": bool(row["is_active"]),
                "two_factor_enabled": bool(row["two_factor_enabled"]),
                "is_first_login": bool(row["is_first_login"]),
                "max_active_sessions": int(row.get("max_active_sessions") or 1),
                "max_ip_addresses": int(row.get("max_ip_addresses") or 2),
                "failed_attempts": int(row["failed_attempts"] or 0),
                "locked_until": row["locked_until"],
                "created_at": row["created_at"],
            })

        return jsonify(users)

    @bp.route("/users/<int:user_id>/sessions", methods=["GET"])
    def get_user_sessions(user_id: int):
        """List active sessions for a user with issued time and IP info."""
        require_admin(auth_service)

        conn = db_manager.get_auth_connection()
        try:
            rows = fetch_all_dict(
                conn,
                """
                SELECT u.id, u.email, u.name, s.current_token
                FROM users u
                LEFT JOIN users_sensitive s ON s.user_id = u.id
                WHERE u.id = :user_id
                """,
                {"user_id": user_id},
            )
        finally:
            conn.close()

        if not rows:
            abort(404, description=f"User id={user_id} not found")

        row = rows[0]
        queue = auth_service.parse_session_queue(row.get("current_token"))
        sessions: list[dict[str, Any]] = []

        for idx, item in enumerate(reversed(queue)):
            token = str(item.get("token", "") or "").strip()
            if not token:
                continue
            session_ip = str(item.get("ip", "") or "").strip()
            sessions.append(
                {
                    "session_key": _session_key_from_token(token),
                    "issued_at": str(item.get("issued_at", "") or ""),
                    "ip": session_ip or None,
                    "token_hint": token[-8:],
                    "is_most_recent": idx == 0,
                }
            )

        most_recent = sessions[0] if sessions else None
        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "user_email": row.get("email"),
                "user_name": row.get("name"),
                "last_login_ip": most_recent.get("ip") if most_recent else None,
                "last_login_at": most_recent.get("issued_at") if most_recent else None,
                "session_count": len(sessions),
                "sessions": sessions,
            }
        )

    @bp.route("/users/<int:user_id>/sessions/clear", methods=["POST"])
    def clear_user_sessions(user_id: int):
        """Clear selected active sessions (or all) for a user."""
        require_admin(auth_service)
        body = get_json_body()
        clear_all = bool(body.get("clear_all"))

        selected_keys: set[str] = set()
        if not clear_all:
            raw_keys = body.get("session_keys")
            if not isinstance(raw_keys, list) or len(raw_keys) == 0:
                abort(400, description="session_keys must be a non-empty array when clear_all is false")
            for raw in raw_keys:
                key = str(raw or "").strip()
                if key:
                    selected_keys.add(key)
            if len(selected_keys) == 0:
                abort(400, description="No valid session_keys provided")

        conn = db_manager.get_auth_connection()
        try:
            rows = fetch_all_dict(
                conn,
                """
                SELECT u.id, s.current_token
                FROM users u
                LEFT JOIN users_sensitive s ON s.user_id = u.id
                WHERE u.id = :user_id
                """,
                {"user_id": user_id},
            )
            if not rows:
                abort(404, description=f"User id={user_id} not found")

            current_queue = auth_service.parse_session_queue(rows[0].get("current_token"))
            if clear_all:
                next_queue: list[dict[str, str]] = []
            else:
                next_queue = [
                    entry for entry in current_queue
                    if _session_key_from_token(str(entry.get("token", "") or "")) not in selected_keys
                ]

            removed_count = len(current_queue) - len(next_queue)
            if removed_count > 0:
                execute(
                    conn,
                    "UPDATE users_sensitive SET current_token = :current_token WHERE user_id = :user_id",
                    {
                        "current_token": auth_service.serialize_session_queue(next_queue),
                        "user_id": user_id,
                    },
                )
                conn.commit()
        finally:
            conn.close()

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "clear_all": clear_all,
                "removed_sessions": removed_count,
                "remaining_sessions": len(next_queue),
            }
        )

    @bp.route("/set-user-status", methods=["PATCH"])
    def set_user_status():
        """Toggle is_active for a specific user."""
        require_admin(auth_service)

        body = get_json_body()
        user_id = parse_int_field(body, "id")
        is_active = body.get("is_active")

        if is_active is None:
            abort(400, description="is_active is required")

        current_admin, _ = auth_service.resolve_user(require_full=True)
        if current_admin and current_admin.get("id") == user_id:
            abort(403, description="You cannot change your own active status")

        success = db_manager.auth_backend.update_user_status(user_id, bool(is_active))

        if not success:
            abort(404, description=f"User id={user_id} not found")

        return jsonify({"success": True, "user_id": user_id, "is_active": bool(is_active)})

    @bp.route("/users/create", methods=["POST"])
    def create_user():
        """Create a new user with a temporary password (admin-managed accounts)."""
        require_admin(auth_service)

        body = get_json_body()
        email = str(body.get("email", "")).strip().lower()
        name = str(body.get("name", "")).strip() or None
        role_id = int(body.get("role_id", 1))
        max_active_sessions = int(body.get("max_active_sessions", 1))
        max_ip_addresses = int(body.get("max_ip_addresses", 2))

        if not email or not EMAIL_RE.match(email):
            abort(400, description="A valid email address is required")
        if role_id not in (1, 2):
            abort(400, description="role_id must be 1 (user) or 2 (admin)")
        if max_active_sessions < 1 or max_active_sessions > MAX_ACTIVE_SESSIONS_LIMIT:
            abort(400, description=f"max_active_sessions must be between 1 and {MAX_ACTIVE_SESSIONS_LIMIT}")
        if max_ip_addresses < 1 or max_ip_addresses > MAX_IP_ADDRESSES_LIMIT:
            abort(400, description=f"max_ip_addresses must be between 1 and {MAX_IP_ADDRESSES_LIMIT}")

        temp_pw = _gen_temp_password()
        pw_hash = bcrypt.hashpw(temp_pw.encode(), bcrypt.gensalt(rounds=12)).decode()
        expires_at = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(time.time() + TEMP_PW_EXPIRES_HOURS * 3600),
        )

        try:
            user_id = db_manager.auth_backend.create_user(
                email=email,
                name=name,
                role_id=role_id,
                password_hash=pw_hash,
                temp_password_expires_at=expires_at,
                max_active_sessions=max_active_sessions,
                max_ip_addresses=max_ip_addresses,
            )
        except Exception as exc:
            if db_manager.auth_backend.is_integrity_error(exc):
                abort(409, description="An account with that email already exists")
            raise

        return jsonify({
            "success": True,
            "user_id": user_id,
            "email": email,
            "name": name,
            "role_id": role_id,
            "max_active_sessions": max_active_sessions,
            "max_ip_addresses": max_ip_addresses,
            "temp_password": temp_pw,
            "temp_password_expires_at": expires_at,
        }), 201

    @bp.route("/users/<int:user_id>/edit", methods=["PATCH"])
    def edit_user(user_id: int):
        """Update a user's display name, email, and/or role."""
        require_admin(auth_service)

        body = get_json_body()
        email = str(body.get("email", "")).strip().lower()
        name = str(body.get("name", "")).strip() or None
        
        # Don't allow an admin to change their own role
        current_admin, _ = auth_service.resolve_user(require_full=True)
        role_id = None
        max_active_sessions = None
        max_ip_addresses = None
        if "role_id" in body:
            raw_role_id = parse_int_field(body, "role_id")
            if current_admin and current_admin.get("id") == user_id:
                # Allow self-update payloads that include the same role_id, but block actual role changes.
                current_role_id = int(current_admin.get("role_id") or 0)
                if raw_role_id != current_role_id:
                    abort(403, description="Cannot change your own role")
                raw_role_id = current_role_id
            # Only allow roles 1 (user) or 2 (admin)
            if raw_role_id not in (1, 2):
                abort(400, description="Invalid role_id")
            if not (current_admin and current_admin.get("id") == user_id):
                role_id = raw_role_id
        if "max_active_sessions" in body:
            raw_max_sessions = parse_int_field(body, "max_active_sessions")
            if raw_max_sessions < 1 or raw_max_sessions > MAX_ACTIVE_SESSIONS_LIMIT:
                abort(400, description=f"max_active_sessions must be between 1 and {MAX_ACTIVE_SESSIONS_LIMIT}")
            max_active_sessions = raw_max_sessions
        if "max_ip_addresses" in body:
            raw_max_ip_addresses = parse_int_field(body, "max_ip_addresses")
            if raw_max_ip_addresses < 1 or raw_max_ip_addresses > MAX_IP_ADDRESSES_LIMIT:
                abort(400, description=f"max_ip_addresses must be between 1 and {MAX_IP_ADDRESSES_LIMIT}")
            max_ip_addresses = raw_max_ip_addresses

        if not email or not EMAIL_RE.match(email):
            abort(400, description="A valid email address is required")

        try:
            success = db_manager.auth_backend.update_user_profile(
                user_id,
                name=name,
                email=email,
                role_id=role_id,
                max_active_sessions=max_active_sessions,
                max_ip_addresses=max_ip_addresses,
            )
            if success and max_active_sessions is not None:
                conn = db_manager.get_auth_connection()
                try:
                    row = fetch_all_dict(
                        conn,
                        "SELECT current_token FROM users_sensitive WHERE user_id = :user_id",
                        {"user_id": user_id},
                    )
                    current_token_raw = row[0]["current_token"] if row else None
                    trimmed_token_queue = _trim_session_queue_json(
                        auth_service,
                        current_token_raw,
                        max_active_sessions=max_active_sessions,
                    )
                    execute(
                        conn,
                        "UPDATE users_sensitive SET current_token = :current_token WHERE user_id = :user_id",
                        {"current_token": trimmed_token_queue, "user_id": user_id},
                    )
                    conn.commit()
                finally:
                    conn.close()
        except Exception as exc:
            if db_manager.auth_backend.is_integrity_error(exc):
                abort(409, description="That email is already in use by another account")
            raise

        if not success:
            abort(404, description=f"User id={user_id} not found")

        return jsonify({"success": True, "user_id": user_id, "email": email, "name": name})

    @bp.route("/users/<int:user_id>", methods=["DELETE"])
    def delete_user(user_id: int):
        """Permanently delete a user account."""
        require_admin(auth_service)

        # Prevent admins from deleting themselves
        caller, _ = auth_service.resolve_user(require_full=True)
        if caller and int(caller["id"]) == user_id:
            abort(400, description="You cannot delete your own account")

        success = db_manager.auth_backend.delete_user(user_id)
        if not success:
            abort(404, description=f"User id={user_id} not found")

        return jsonify({"success": True, "user_id": user_id})

    @bp.route("/users/<int:user_id>/reader-state/cleanup", methods=["POST"])
    def cleanup_user_reader_state(user_id: int):
        """Cleanup user data for one user across all courses by scope."""
        require_admin(auth_service)
        body = get_json_body()
        scope = str(body.get("scope", "all") or "all").strip().lower()
        if scope not in USER_DATA_CLEANUP_SCOPES:
            abort(400, description="scope must be one of: bookmarks, highlights, notes, drawing, progress, all")

        conn = db_manager.get_auth_connection()
        try:
            affected_progress_rows = 0
            if scope == "all":
                affected_courses = execute(
                    conn,
                    "DELETE FROM user_course_reader_state WHERE user_id = :user_id",
                    {"user_id": user_id},
                )
                affected_progress_rows = execute(
                    conn,
                    "DELETE FROM user_progress WHERE user_id = :user_id",
                    {"user_id": user_id},
                )
                conn.commit()
                return jsonify(
                    {
                        "success": True,
                        "user_id": user_id,
                        "scope": scope,
                        "affected_courses": max(affected_courses, 0),
                        "affected_progress_rows": max(affected_progress_rows, 0),
                        "affected_tokens": 0,
                    }
                )

            if scope == "progress":
                affected_progress_rows = execute(
                    conn,
                    "DELETE FROM user_progress WHERE user_id = :user_id",
                    {"user_id": user_id},
                )
                conn.commit()
                return jsonify(
                    {
                        "success": True,
                        "user_id": user_id,
                        "scope": scope,
                        "affected_courses": 0,
                        "affected_progress_rows": max(affected_progress_rows, 0),
                        "affected_tokens": 0,
                    }
                )

            rows = fetch_all_dict(
                conn,
                """
                SELECT course_id, state_json
                FROM user_course_reader_state
                WHERE user_id = :user_id
                """,
                {"user_id": user_id},
            )
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            affected_courses = 0
            for row in rows:
                course_id = int(row.get("course_id"))
                state = _parse_reader_state(row.get("state_json"))
                next_state, changed = _cleanup_reader_state_by_scope(state, scope)
                if not changed:
                    continue
                execute(
                    conn,
                    """
                    UPDATE user_course_reader_state
                    SET state_json = :state_json, updated_at = :updated_at
                    WHERE user_id = :user_id AND course_id = :course_id
                    """,
                    {
                        "state_json": json.dumps(next_state, separators=(",", ":")),
                        "updated_at": now_iso,
                        "user_id": user_id,
                        "course_id": course_id,
                    },
                )
                affected_courses += 1
            conn.commit()
        finally:
            conn.close()

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "scope": scope,
                "affected_courses": affected_courses,
                "affected_progress_rows": 0,
                "affected_tokens": 0,
            }
        )

    @bp.route("/reader-state/cleanup", methods=["POST"])
    def cleanup_all_reader_state():
        """Global maintenance cleanup: reader data, progress, and/or active tokens."""
        require_admin(auth_service)
        body = get_json_body()
        scope = str(body.get("scope", "all") or "all").strip().lower()
        if scope not in GLOBAL_CLEANUP_SCOPES:
            abort(400, description="scope must be one of: bookmarks, highlights, notes, drawing, progress, tokens, all")

        conn = db_manager.get_auth_connection()
        try:
            if scope == "all":
                affected_courses = execute(conn, "DELETE FROM user_course_reader_state")
                affected_progress_rows = execute(conn, "DELETE FROM user_progress")
                affected_tokens = execute(conn, "UPDATE users_sensitive SET current_token = NULL")
                conn.commit()
                return jsonify(
                    {
                        "success": True,
                        "scope": scope,
                        "affected_courses": max(affected_courses, 0),
                        "affected_progress_rows": max(affected_progress_rows, 0),
                        "affected_tokens": max(affected_tokens, 0),
                    }
                )

            if scope == "tokens":
                affected_tokens = execute(conn, "UPDATE users_sensitive SET current_token = NULL")
                conn.commit()
                return jsonify(
                    {
                        "success": True,
                        "scope": scope,
                        "affected_courses": 0,
                        "affected_progress_rows": 0,
                        "affected_tokens": max(affected_tokens, 0),
                    }
                )

            if scope == "progress":
                affected_progress_rows = execute(conn, "DELETE FROM user_progress")
                conn.commit()
                return jsonify(
                    {
                        "success": True,
                        "scope": scope,
                        "affected_courses": 0,
                        "affected_progress_rows": max(affected_progress_rows, 0),
                        "affected_tokens": 0,
                    }
                )

            rows = fetch_all_dict(
                conn,
                "SELECT user_id, course_id, state_json FROM user_course_reader_state",
            )
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            affected_courses = 0
            for row in rows:
                user_id_row = int(row.get("user_id"))
                course_id = int(row.get("course_id"))
                state = _parse_reader_state(row.get("state_json"))
                next_state, changed = _cleanup_reader_state_by_scope(state, scope)
                if not changed:
                    continue
                execute(
                    conn,
                    """
                    UPDATE user_course_reader_state
                    SET state_json = :state_json, updated_at = :updated_at
                    WHERE user_id = :user_id AND course_id = :course_id
                    """,
                    {
                        "state_json": json.dumps(next_state, separators=(",", ":")),
                        "updated_at": now_iso,
                        "user_id": user_id_row,
                        "course_id": course_id,
                    },
                )
                affected_courses += 1
            conn.commit()
        finally:
            conn.close()

        return jsonify(
            {
                "success": True,
                "scope": scope,
                "affected_courses": affected_courses,
                "affected_progress_rows": 0,
                "affected_tokens": 0,
            }
        )

    @bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
    def reset_user_password(user_id: int):
        """Generate a new temporary password and re-arm the first-login gate."""
        require_admin(auth_service)

        temp_pw = _gen_temp_password()
        pw_hash = bcrypt.hashpw(temp_pw.encode(), bcrypt.gensalt(rounds=12)).decode()
        expires_at = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(time.time() + TEMP_PW_EXPIRES_HOURS * 3600),
        )

        success = db_manager.auth_backend.reset_user_password(
            user_id=user_id,
            password_hash=pw_hash,
            temp_password_expires_at=expires_at,
        )
        if not success:
            abort(404, description=f"User id={user_id} not found")

        return jsonify({
            "success": True,
            "user_id": user_id,
            "temp_password": temp_pw,
            "temp_password_expires_at": expires_at,
        })
