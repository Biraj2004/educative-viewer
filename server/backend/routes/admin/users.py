"""
Admin – User Management
=======================
Endpoints for administrators to list and manage user accounts.
"""

from __future__ import annotations

import secrets
import string
import time

import bcrypt
from flask import Blueprint, jsonify, abort

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from backend.routes.admin.helpers import require_admin, get_json_body, parse_int_field

EMAIL_RE = __import__("re").compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TEMP_PW_EXPIRES_HOURS = 1


def _gen_temp_password(length: int = 12) -> str:
    """Generate a random alphanumeric temporary password."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


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
                "failed_attempts": int(row["failed_attempts"] or 0),
                "locked_until": row["locked_until"],
                "created_at": row["created_at"],
            })

        return jsonify(users)

    @bp.route("/set-user-status", methods=["PATCH"])
    def set_user_status():
        """Toggle is_active for a specific user."""
        require_admin(auth_service)

        body = get_json_body()
        user_id = parse_int_field(body, "id")
        is_active = body.get("is_active")

        if is_active is None:
            abort(400, description="is_active is required")

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

        if not email or not EMAIL_RE.match(email):
            abort(400, description="A valid email address is required")
        if role_id not in (1, 2):
            abort(400, description="role_id must be 1 (user) or 2 (admin)")

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
            "temp_password": temp_pw,
            "temp_password_expires_at": expires_at,
        }), 201

    @bp.route("/users/<int:user_id>/edit", methods=["PATCH"])
    def edit_user(user_id: int):
        """Update a user's display name and/or email."""
        require_admin(auth_service)

        body = get_json_body()
        email = str(body.get("email", "")).strip().lower()
        name = str(body.get("name", "")).strip() or None

        if not email or not EMAIL_RE.match(email):
            abort(400, description="A valid email address is required")

        try:
            success = db_manager.auth_backend.update_user_profile(user_id, name=name, email=email)
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
