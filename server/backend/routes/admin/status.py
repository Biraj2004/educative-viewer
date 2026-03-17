"""
Admin – Course / Path / Project Status Routes
===============================================
Endpoint for toggling the is_active flag on courses, paths, and projects.
All routes require role == "admin".
"""

from __future__ import annotations

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from backend.routes.admin.helpers import (
    get_json_body,
    parse_int_field,
    require_admin,
)
from flask import Blueprint, abort, jsonify


# Map entity name → table name and primary-key column
_ENTITY_TABLE: dict[str, tuple[str, str]] = {
    "course":  ("courses",  "id"),
    "path":    ("paths",    "id"),
    "project": ("projects", "id"),
}


def _ensure_is_active_column(conn, table: str) -> None:
    """Add is_active column if it doesn't exist yet (idempotent)."""
    try:
        conn.execute(
            f"ALTER TABLE {table} ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"
        )
        conn.commit()
    except Exception:
        pass  # Column already exists – that's fine


def register_status_routes(
    bp: Blueprint,
    auth_service: AuthService,
    db_manager: DBManager,
) -> None:
    """Register status-management admin routes onto *bp*."""

    @bp.route("/set-course-status", methods=["PATCH"])
    def set_course_status():
        """Toggle is_active on a course, path, or project.

        Body: { "entity": "course"|"path"|"project", "id": int, "is_active": bool }
        Response 200: { "ok": true, "entity": str, "id": int, "is_active": bool }
        """
        require_admin(auth_service)

        body = get_json_body()

        entity = body.get("entity", "").strip().lower()
        if entity not in _ENTITY_TABLE:
            abort(400, description=f"entity must be one of: {', '.join(_ENTITY_TABLE)}")

        entity_id = parse_int_field(body, "id")

        is_active_raw = body.get("is_active")
        if is_active_raw is None:
            abort(400, description="is_active is required")
        is_active = bool(is_active_raw)

        table, pk = _ENTITY_TABLE[entity]

        conn = db_manager.get_course_connection()
        try:
            _ensure_is_active_column(conn, table)

            result = conn.execute(
                f"UPDATE {table} SET is_active = ? WHERE {pk} = ?",
                (int(is_active), entity_id),
            )
            conn.commit()

            if result.rowcount == 0:
                abort(404, description=f"{entity.capitalize()} id={entity_id} not found")
        finally:
            conn.close()

        return jsonify({"ok": True, "entity": entity, "id": entity_id, "is_active": is_active}), 200
