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


def create_courses_blueprint(auth_service: AuthService, db_manager: DBManager) -> Blueprint:
    bp = Blueprint("courses_api", __name__, url_prefix="/api")

    @bp.route("/paths", methods=["GET"])
    def get_all_paths():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        conn = db_manager.get_course_connection()
        try:
            rows = conn.execute(
                """
                SELECT
                    p.id,
                    p.path_author_id,
                    p.path_collection_id,
                    p.path_url_slug,
                    p.path_title,
                    p.scraped_at,
                    COUNT(c.id) AS course_count
                FROM paths p
                LEFT JOIN courses c ON c.path_id = p.id
                GROUP BY
                    p.id,
                    p.path_author_id,
                    p.path_collection_id,
                    p.path_url_slug,
                    p.path_title,
                    p.scraped_at
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

        conn = db_manager.get_course_connection()
        try:
            path_row = conn.execute(
                "SELECT id, path_title FROM paths WHERE id = ?",
                (path_id,),
            ).fetchone()

            if not path_row:
                abort(404, description=f"Path id={path_id} not found")

            course_rows = conn.execute(
                """
                SELECT id, slug, title, type, path_id
                FROM courses
                WHERE path_id = ?
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

        conn = db_manager.get_course_connection()
        try:
            rows = conn.execute(
                """
                SELECT
                    p.id,
                    p.course_id,
                    p.project_author_id,
                    p.project_collection_id,
                    p.project_work_id,
                    p.project_title,
                    p.project_url_slug,
                    p.scraped_at,
                    c.slug AS course_slug,
                    c.title AS course_title,
                    c.type AS course_type
                FROM projects p
                JOIN courses c ON c.id = p.course_id
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

        conn = db_manager.get_course_connection()
        try:
            row = conn.execute(
                """
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
                JOIN courses c ON c.id = p.course_id
                WHERE p.id = ?
                """,
                (project_id,),
            ).fetchone()

            if not row:
                abort(404, description=f"Project id={project_id} not found")

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

        conn = db_manager.get_course_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, slug, title, type
                FROM courses
                WHERE COALESCE(LOWER(TRIM(type)), '') NOT IN ('path', 'project')
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

        conn = db_manager.get_course_connection(course_id)
        try:
            row = conn.execute(
                "SELECT id, slug, title, type, toc_json FROM courses WHERE id = ?",
                (course_id,),
            ).fetchone()

            if not row:
                abort(404, description=f"Course id={course_id} not found")

            data = dict(row)
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

        conn = db_manager.get_course_connection(course_id)
        try:
            topic = conn.execute(
                """
                SELECT topic_name, topic_slug, topic_url, api_url, status
                FROM topics
                WHERE course_id = ? AND topic_index = ?
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

    @bp.route("/test_components", methods=["GET"])
    def get_test_components():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        conn = db_manager.get_course_connection()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS test_components (
                    component_id INTEGER PRIMARY KEY,
                    component_type TEXT,
                    content_json TEXT,
                    topic_url TEXT
                )
                """
            )
            conn.commit()

            rows = conn.execute(
                "SELECT component_id, component_type, content_json, topic_url "
                "FROM test_components ORDER BY component_id"
            ).fetchall()
            return jsonify(_rows_to_list(rows))
        finally:
            conn.close()

    return bp
