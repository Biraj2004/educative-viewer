"""
Admin – Test Components Routes
===============================
CRUD endpoints for managing which components appear on the test page
(/dashboard/test).  All routes require role == "admin".
"""

from __future__ import annotations

from backend.auth_service import AuthService
from backend.db.manager import DBManager
from backend.routes.admin.helpers import (
    ensure_test_components_table,
    fetch_component,
    get_json_body,
    parse_int_field,
    require_admin,
    resolve_topic_url,
)
from flask import Blueprint, abort, jsonify


def register_test_component_routes(
    bp: Blueprint,
    auth_service: AuthService,
    db_manager: DBManager,
) -> None:
    """Register test-component admin routes onto *bp*."""

    @bp.route("/test-components", methods=["GET"])
    def list_test_components():
        """Return all components currently on the test page.

        Response 200 – list of component rows.
        """
        require_admin(auth_service)

        conn = db_manager.get_course_connection()
        try:
            ensure_test_components_table(conn)
            rows = conn.execute(
                "SELECT component_id, component_type, content_json, topic_url "
                "FROM test_components ORDER BY component_id"
            ).fetchall()
            return jsonify([dict(r) for r in rows]), 200
        finally:
            conn.close()

    @bp.route("/test-components", methods=["POST"])
    def add_test_component():
        """Pin a course component to the test page.

        Body: { "component_id": int, "topic_url": str (optional) }

        Idempotent – re-adding an existing component updates it in place.
        Response 201 – the upserted row.
        """
        require_admin(auth_service)

        body = get_json_body()
        component_id = parse_int_field(body, "component_id")
        topic_url = body.get("topic_url") or None

        component = fetch_component(db_manager, component_id)

        if not topic_url:
            topic_url = resolve_topic_url(db_manager, component)

        _upsert_test_component(db_manager, component_id, component["type"], component["content_json"] or "{}", topic_url)

        return (
            jsonify({
                "component_id": component_id,
                "component_type": component["type"],
                "content_json": component["content_json"] or "{}",
                "topic_url": topic_url,
            }),
            201,
        )

    @bp.route("/test-components/<int:component_id>", methods=["DELETE"])
    def remove_test_component(component_id: int):
        """Unpin a component from the test page.

        Response 200 – { "ok": true, "component_id": int }
        Response 404 – component was not on the test page.
        """
        require_admin(auth_service)

        conn = db_manager.get_course_connection()
        try:
            ensure_test_components_table(conn)
            result = conn.execute(
                "DELETE FROM test_components WHERE component_id = ?",
                (component_id,),
            )
            conn.commit()
            was_deleted = result.rowcount > 0
        finally:
            conn.close()

        if not was_deleted:
            abort(404, description=f"Component id={component_id} is not on the test page")

        return jsonify({"ok": True, "component_id": component_id}), 200


# ── Private helpers ───────────────────────────────────────────────────────────

def _upsert_test_component(
    db_manager: DBManager,
    component_id: int,
    component_type: str,
    content_json: str,
    topic_url: str | None,
) -> None:
    """Insert or update a row in test_components (idempotent)."""
    conn = db_manager.get_course_connection()
    try:
        ensure_test_components_table(conn)

        exists = conn.execute(
            "SELECT 1 FROM test_components WHERE component_id = ?",
            (component_id,),
        ).fetchone()

        if exists:
            conn.execute(
                "UPDATE test_components "
                "SET component_type = ?, content_json = ?, topic_url = ? "
                "WHERE component_id = ?",
                (component_type, content_json, topic_url, component_id),
            )
        else:
            conn.execute(
                "INSERT INTO test_components (component_id, component_type, content_json, topic_url) "
                "VALUES (?, ?, ?, ?)",
                (component_id, component_type, content_json, topic_url),
            )

        conn.commit()
    finally:
        conn.close()
