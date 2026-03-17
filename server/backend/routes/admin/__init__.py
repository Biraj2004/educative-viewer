"""
Admin Routes Package
====================
All admin-only API endpoints live in this package.
Each sub-module registers its routes on the shared Blueprint exported below.

Blueprint prefix : /api/admin
Access control   : role == "admin" enforced per-route via helpers.require_admin
"""

from __future__ import annotations

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from backend.routes.admin.components import register_test_component_routes
from flask import Blueprint


def create_admin_blueprint(auth_service: AuthService, db_manager: DBManager) -> Blueprint:
    """Return a Flask Blueprint with all admin sub-routes registered."""
    bp = Blueprint("admin_api", __name__, url_prefix="/api/admin")

    # ── Sub-modules ───────────────────────────────────────────────────────────
    register_test_component_routes(bp, auth_service, db_manager)
    # Add future admin modules here: register_user_routes(bp, ...), etc.

    return bp
