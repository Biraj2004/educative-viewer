"""
Admin – User Management
=======================
Endpoints for administrators to list and manage user accounts.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, abort

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from backend.routes.admin.helpers import require_admin, get_json_body, parse_int_field


def register_user_routes(bp: Blueprint, auth_service: AuthService, db_manager: DBManager) -> None:
    """Register user management routes into the provided admin blueprint."""

    @bp.route("/users", methods=["GET"])
    def get_all_users():
        """List all users with their roles."""
        require_admin(auth_service)
        
        # We need to access the auth backend directly for user listing
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
                "created_at": row["created_at"]
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
