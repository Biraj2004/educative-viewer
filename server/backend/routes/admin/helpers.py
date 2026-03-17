"""
Admin – Shared Helpers
======================
Reusable guards and utilities for all admin route modules.
"""

from __future__ import annotations

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from flask import abort, request


# ── Auth ──────────────────────────────────────────────────────────────────────

def require_admin(auth_service: AuthService) -> dict:
    """Resolve the calling user; abort 401/403 if not an admin.

    Returns the full user dict on success.
    """
    user, _ = auth_service.resolve_user(require_full=True)
    if not user:
        abort(401, description="Authentication required")
    if user.get("role") != "admin":
        abort(403, description="Admin access required")
    return user


# ── Request parsing ───────────────────────────────────────────────────────────

def parse_int_field(body: dict, field: str) -> int:
    """Extract *field* from *body* as a positive int; abort 400 on failure."""
    raw = body.get(field)
    if raw is None:
        abort(400, description=f"{field} is required")
    try:
        return int(raw)
    except (TypeError, ValueError):
        abort(400, description=f"{field} must be an integer")


def get_json_body() -> dict:
    """Return the parsed JSON request body (never None)."""
    return request.get_json(force=True, silent=True) or {}


# ── Database ──────────────────────────────────────────────────────────────────

def ensure_test_components_table(conn) -> None:
    """Create the test_components table if it does not already exist."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS test_components (
            component_id   INTEGER PRIMARY KEY,
            component_type TEXT    NOT NULL,
            content_json   TEXT    NOT NULL DEFAULT '{}',
            topic_url      TEXT
        )
        """
    )
    conn.commit()


def fetch_component(db_manager: DBManager, component_id: int) -> dict:
    """Fetch a single component row from the course DB.

    Aborts 404 if the component does not exist.
    Returns a plain dict with keys: id, type, content_json, topic_index, course_id.
    """
    conn = db_manager.get_course_connection()
    try:
        row = conn.execute(
            "SELECT id, type, content_json, topic_index, course_id "
            "FROM components WHERE id = ?",
            (component_id,),
        ).fetchone()
    finally:
        conn.close()

    if not row:
        abort(404, description=f"Component id={component_id} not found in course database")

    return dict(row)


def resolve_topic_url(db_manager: DBManager, component: dict) -> str | None:
    """Look up the topic_url for the topic that owns *component*.

    Returns None silently if the lookup fails (non-fatal).
    """
    try:
        conn = db_manager.get_course_connection(int(component["course_id"]))
        try:
            row = conn.execute(
                "SELECT topic_url FROM topics WHERE course_id = ? AND topic_index = ?",
                (component["course_id"], component["topic_index"]),
            ).fetchone()
            return row["topic_url"] if row else None
        finally:
            conn.close()
    except Exception:
        return None
