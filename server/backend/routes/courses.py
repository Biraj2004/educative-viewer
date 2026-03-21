from __future__ import annotations

import json
from typing import Any

from flask import Blueprint, abort, jsonify, request

from backend.auth_service import AuthService
from backend.db.manager import DBManager


def _rows_to_list(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def _require(payload: dict[str, Any], *keys: str) -> None:
    missing = [key for key in keys if key not in payload]
    if missing:
        abort(400, description=f"Missing required field(s): {', '.join(missing)}")


def _is_admin(user: dict[str, Any]) -> bool:
    return user.get("role") == "admin"


# Tables that have already had is_active added in this process lifetime.
# Avoids the ALTER TABLE overhead on every single request.
_migrated_tables: set[str] = set()


def _ensure_is_active_column(conn, table: str) -> None:
    """Lazily add is_active column with default 1 (idempotent, cached)."""
    global _migrated_tables
    if table in _migrated_tables:
        return
    try:
        conn.execute(
            f"ALTER TABLE {table} ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"
        )
        conn.commit()
    except Exception:
        pass  # Column already exists
    _migrated_tables.add(table)




def create_courses_blueprint(auth_service: AuthService, db_manager: DBManager) -> Blueprint:
    bp = Blueprint("courses_api", __name__, url_prefix="/api")

    @bp.route("/paths", methods=["GET"])
    def get_all_paths():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)

        conn = db_manager.get_course_connection()
        try:
            _ensure_is_active_column(conn, "paths")
            active_filter = "" if admin else "WHERE p.is_active = 1"
            rows = conn.execute(
                f"""
                SELECT
                    p.id,
                    p.path_author_id,
                    p.path_collection_id,
                    p.path_url_slug,
                    p.path_title,
                    p.scraped_at,
                    p.is_active,
                    COUNT(c.id) AS course_count
                FROM paths p
                LEFT JOIN courses c ON c.path_id = p.id
                {active_filter}
                GROUP BY
                    p.id,
                    p.path_author_id,
                    p.path_collection_id,
                    p.path_url_slug,
                    p.path_title,
                    p.scraped_at,
                    p.is_active
                ORDER BY p.id
                """
            ).fetchall()
            return jsonify(_rows_to_list(rows))
        finally:
            conn.close()

    @bp.route("/paths/<int:path_id>/courses", methods=["GET"])
    def get_courses_by_path(path_id: int):
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)

        conn = db_manager.get_course_connection()
        try:
            _ensure_is_active_column(conn, "paths")
            _ensure_is_active_column(conn, "courses")

            # Fetch path with its active status so we can gate non-admins
            path_row = conn.execute(
                "SELECT id, path_title, is_active FROM paths WHERE id = ?",
                (path_id,),
            ).fetchone()

            if not path_row:
                abort(404, description=f"Path id={path_id} not found")

            # Non-admins cannot access a hidden path or its courses
            if not admin and not path_row["is_active"]:
                abort(404, description=f"Path id={path_id} not found or inactive")

            active_filter = "" if admin else "AND c.is_active = 1"
            course_rows = conn.execute(
                f"""
                SELECT id, slug, title, type, path_id, is_active
                FROM courses c
                WHERE path_id = ? {active_filter}
                ORDER BY id
                """,
                (path_id,),
            ).fetchall()

            return jsonify(
                {
                    "path": {
                        "id": path_row["id"],
                        "path_title": path_row["path_title"],
                    },
                    "courses": _rows_to_list(course_rows),
                }
            )
        finally:
            conn.close()

    @bp.route("/projects", methods=["GET"])
    def get_all_projects():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)

        conn = db_manager.get_course_connection()
        try:
            _ensure_is_active_column(conn, "projects")
            _ensure_is_active_column(conn, "courses")
            # Non-admins: hide projects that are hidden themselves OR whose
            # parent course is hidden (parent-cascade rule)
            active_filter = "" if admin else "AND p.is_active = 1 AND c.is_active = 1"
            rows = conn.execute(
                f"""
                SELECT
                    p.id,
                    c.id AS course_id,
                    p.project_author_id,
                    p.project_collection_id,
                    p.project_work_id,
                    p.project_title,
                    p.project_url_slug,
                    p.scraped_at,
                    p.is_active,
                    c.slug AS course_slug,
                    c.title AS course_title,
                    c.type AS course_type
                FROM projects p
                LEFT JOIN courses c ON c.project_id = p.id
                WHERE 1=1 {active_filter}
                ORDER BY p.id
                """
            ).fetchall()
            return jsonify(_rows_to_list(rows))
        finally:
            conn.close()

    @bp.route("/projects/<int:project_id>/course", methods=["GET"])
    def get_course_by_project(project_id: int):
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)

        conn = db_manager.get_course_connection()
        try:
            _ensure_is_active_column(conn, "projects")
            _ensure_is_active_column(conn, "courses")

            # Non-admins: both project AND its parent course must be active
            active_filter = "" if admin else "AND p.is_active = 1 AND c.is_active = 1"

            row = conn.execute(
                f"""
                SELECT
                    p.id,
                    p.project_author_id,
                    p.project_collection_id,
                    p.project_work_id,
                    p.project_title,
                    p.project_url_slug,
                    p.scraped_at,
                    c.id AS course_id,
                    c.slug AS course_slug,
                    c.title AS course_title,
                    c.type AS course_type
                FROM projects p
                JOIN courses c ON c.project_id = p.id
                WHERE p.id = ? {active_filter}
                """,
                (project_id,),
            ).fetchone()

            if not row:
                abort(404, description=f"Project id={project_id} not found or inactive")

            return jsonify(
                {
                    "project": {
                        "id": row["id"],
                        "project_author_id": row["project_author_id"],
                        "project_collection_id": row["project_collection_id"],
                        "project_work_id": row["project_work_id"],
                        "project_title": row["project_title"],
                        "project_url_slug": row["project_url_slug"],
                        "scraped_at": row["scraped_at"],
                    },
                    "course": {
                        "id": row["course_id"],
                        "slug": row["course_slug"],
                        "title": row["course_title"],
                        "type": row["course_type"],
                    },
                }
            )
        finally:
            conn.close()

    @bp.route("/courses", methods=["GET"])
    def get_all_courses():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)

        conn = db_manager.get_course_connection()
        try:
            _ensure_is_active_column(conn, "courses")
            active_filter = "" if admin else "AND is_active = 1"
            rows = conn.execute(
                f"""
                SELECT id, slug, title, type, is_active
                FROM courses
                WHERE COALESCE(LOWER(TRIM(type)), '') NOT IN ('path', 'project')
                {active_filter}
                ORDER BY id
                """
            ).fetchall()
            return jsonify(_rows_to_list(rows))
        finally:
            conn.close()

    @bp.route("/course-details", methods=["POST"])
    def get_course_data():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        payload = request.get_json(force=True, silent=True) or {}
        _require(payload, "course_id")
        course_id = int(payload["course_id"])
        admin = _is_admin(user)

        conn = db_manager.get_course_connection(course_id)
        try:
            _ensure_is_active_column(conn, "courses")
            active_filter = "" if admin else "AND c.is_active = 1"

            row = conn.execute(
                f"SELECT c.id, c.slug, c.title, c.type, c.toc_json, c.path_id FROM courses c WHERE c.id = ? {active_filter}",
                (course_id,),
            ).fetchone()

            if not row:
                abort(404, description=f"Course id={course_id} not found or inactive")

            # Parent-cascade: if this course belongs to a path, non-admins
            # cannot access it when the parent path is hidden
            if not admin and row["path_id"] is not None:
                _ensure_is_active_column(conn, "paths")
                path_row = conn.execute(
                    "SELECT is_active FROM paths WHERE id = ?",
                    (row["path_id"],),
                ).fetchone()
                if path_row and not path_row["is_active"]:
                    abort(404, description=f"Course id={course_id} not found or inactive")

            data = dict(row)
            data.pop("path_id", None)  # don't expose internal FK
            data["toc"] = json.loads(data.pop("toc_json") or "[]")
            return jsonify(data)
        finally:
            conn.close()

    @bp.route("/topic-details", methods=["POST"])
    def get_topic_data():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        payload = request.get_json(force=True, silent=True) or {}
        _require(payload, "course_id", "topic_index")

        course_id = int(payload["course_id"])
        topic_index = int(payload["topic_index"])
        admin = _is_admin(user)

        conn = db_manager.get_course_connection(course_id)
        try:
            _ensure_is_active_column(conn, "courses")

            # Non-admins cannot access topics of a hidden course, or a course
            # whose parent path is hidden (parent-cascade rule)
            if not admin:
                course_row = conn.execute(
                    "SELECT id, path_id FROM courses WHERE id = ? AND is_active = 1",
                    (course_id,),
                ).fetchone()
                if not course_row:
                    abort(404, description=f"Course id={course_id} not found or inactive")
                # Also block if the parent path is hidden
                if course_row["path_id"] is not None:
                    _ensure_is_active_column(conn, "paths")
                    path_row = conn.execute(
                        "SELECT is_active FROM paths WHERE id = ?",
                        (course_row["path_id"],),
                    ).fetchone()
                    if path_row and not path_row["is_active"]:
                        abort(404, description=f"Course id={course_id} not found or inactive")

            topic = conn.execute(
                """
                SELECT t.topic_name, t.topic_slug, t.topic_url, t.api_url, t.status
                FROM topics t
                WHERE t.course_id = ? AND t.topic_index = ?
                """,
                (course_id, topic_index),
            ).fetchone()

            if not topic:
                abort(
                    404,
                    description=(
                        f"Topic course_id={course_id} topic_index={topic_index} not found"
                    ),
                )

            component_rows = conn.execute(
                """
                SELECT component_index, type, content_json
                FROM components
                WHERE course_id = ? AND topic_index = ?
                ORDER BY component_index
                """,
                (course_id, topic_index),
            ).fetchall()

            components = [
                {
                    "index": row["component_index"],
                    "type": row["type"],
                    "content": json.loads(row["content_json"] or "{}"),
                }
                for row in component_rows
            ]

            return jsonify(
                {
                    "course_id": course_id,
                    "topic_index": topic_index,
                    "topic_name": topic["topic_name"],
                    "topic_slug": topic["topic_slug"],
                    "topic_url": topic["topic_url"],
                    "api_url": topic["api_url"],
                    "status": topic["status"],
                    "components": components,
                }
            )
        finally:
            conn.close()

    return bp
