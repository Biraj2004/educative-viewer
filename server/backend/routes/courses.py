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


def _offset_row(row: dict[str, Any], offset: int, fields: tuple[str, ...]) -> dict[str, Any]:
    for field in fields:
        if field in row and row[field] is not None:
            row[field] = int(row[field]) + offset
    return row


def _resolve_db_id(
    db_manager: DBManager,
    global_id: int,
    label: str,
) -> tuple[Any, int]:
    try:
        shard, local_id = db_manager.resolve_course_db_id(global_id)
    except ValueError:
        abort(404, description=f"{label} id={global_id} not found")
    return shard, local_id


def _has_is_active(db_manager: DBManager, conn, shard, table: str) -> bool:
    return db_manager.course_db_has_column(conn, shard, table, "is_active")


def _select_is_active(has_column: bool, column_ref: str) -> str:
    return column_ref if has_column else "1 AS is_active"


def _where_is_active(has_column: bool, admin: bool, column_ref: str) -> str:
    if admin or not has_column:
        return ""
    return f"WHERE {column_ref} = 1"


def _and_is_active(has_column: bool, admin: bool, column_ref: str) -> str:
    if admin or not has_column:
        return ""
    return f"AND {column_ref} = 1"


def _project_is_active_for_course(
    db_manager: DBManager,
    conn,
    shard,
    local_course_id: int,
    course_project_id: int | None,
) -> bool | None:
    has_projects_active = _has_is_active(db_manager, conn, shard, "projects")
    has_projects_course_id = db_manager.course_db_has_column(
        conn,
        shard,
        "projects",
        "course_id",
    )

    if course_project_id is not None:
        row = conn.execute(
            "SELECT is_active FROM projects WHERE id = ?",
            (course_project_id,),
        ).fetchone()
        if row is not None:
            return True if not has_projects_active else bool(row["is_active"])

    if has_projects_course_id:
        row = conn.execute(
            "SELECT is_active FROM projects WHERE course_id = ?",
            (local_course_id,),
        ).fetchone()
        if row is not None:
            return True if not has_projects_active else bool(row["is_active"])

    return None


def create_courses_blueprint(auth_service: AuthService, db_manager: DBManager) -> Blueprint:
    bp = Blueprint("courses_api", __name__, url_prefix="/api")

    @bp.route("/paths", methods=["GET"])
    def get_all_paths():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)

        rows: list[dict[str, Any]] = []
        for shard in db_manager.iter_course_shards():
            conn = db_manager.open_course_connection(shard)
            try:
                has_paths_active = _has_is_active(db_manager, conn, shard, "paths")
                is_active_select = _select_is_active(has_paths_active, "p.is_active")
                active_filter = _where_is_active(has_paths_active, admin, "p.is_active")

                group_by_fields = [
                    "p.id",
                    "p.path_author_id",
                    "p.path_collection_id",
                    "p.path_url_slug",
                    "p.path_title",
                    "p.scraped_at",
                ]
                if has_paths_active:
                    group_by_fields.append("p.is_active")
                group_by_sql = ",\n                    ".join(group_by_fields)

                shard_rows = conn.execute(
                    f"""
                    SELECT
                        p.id,
                        p.path_author_id,
                        p.path_collection_id,
                        p.path_url_slug,
                        p.path_title,
                        p.scraped_at,
                        {is_active_select},
                        COUNT(c.id) AS course_count
                    FROM paths p
                    LEFT JOIN courses c ON c.path_id = p.id
                    {active_filter}
                    GROUP BY
                        {group_by_sql}
                    ORDER BY p.id
                    """
                ).fetchall()
                shard_rows_list = _rows_to_list(shard_rows)
                for row in shard_rows_list:
                    _offset_row(row, shard.offset, ("id",))
                rows.extend(shard_rows_list)
            finally:
                conn.close()

        rows.sort(key=lambda row: row["id"])
        return jsonify(rows)

    @bp.route("/paths/<int:path_id>/courses", methods=["GET"])
    def get_courses_by_path(path_id: int):
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)
        shard, local_path_id = _resolve_db_id(db_manager, path_id, "Path")

        conn = db_manager.open_course_connection(shard)
        try:
            has_paths_active = _has_is_active(db_manager, conn, shard, "paths")
            has_courses_active = _has_is_active(db_manager, conn, shard, "courses")

            is_active_select = _select_is_active(has_paths_active, "is_active")
            path_row = conn.execute(
                f"SELECT id, path_title, {is_active_select} FROM paths WHERE id = ?",
                (local_path_id,),
            ).fetchone()

            if not path_row:
                abort(404, description=f"Path id={path_id} not found")

            if not admin and has_paths_active and not path_row["is_active"]:
                abort(404, description=f"Path id={path_id} not found or inactive")

            active_filter = _and_is_active(has_courses_active, admin, "c.is_active")
            course_is_active_select = _select_is_active(has_courses_active, "c.is_active")
            course_rows = conn.execute(
                f"""
                SELECT id, slug, title, type, path_id, {course_is_active_select}
                FROM courses c
                WHERE path_id = ? {active_filter}
                ORDER BY id
                """,
                (local_path_id,),
            ).fetchall()

            courses = _rows_to_list(course_rows)
            for row in courses:
                _offset_row(row, shard.offset, ("id", "path_id"))

            return jsonify(
                {
                    "path": {
                        "id": db_manager.course_global_id(shard, path_row["id"]),
                        "path_title": path_row["path_title"],
                    },
                    "courses": courses,
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

        rows: list[dict[str, Any]] = []
        for shard in db_manager.iter_course_shards():
            conn = db_manager.open_course_connection(shard)
            try:
                has_projects_active = _has_is_active(db_manager, conn, shard, "projects")
                has_courses_active = _has_is_active(db_manager, conn, shard, "courses")
                has_project_course_id = db_manager.course_db_has_column(
                    conn,
                    shard,
                    "projects",
                    "course_id",
                )
                has_course_project_id = db_manager.course_db_has_column(
                    conn,
                    shard,
                    "courses",
                    "project_id",
                )

                if has_project_course_id:
                    join_clause = "LEFT JOIN courses c ON c.id = p.course_id"
                    course_id_select = "COALESCE(c.id, p.course_id) AS course_id"
                    allow_course_active = has_courses_active
                elif has_course_project_id:
                    join_clause = "LEFT JOIN courses c ON c.project_id = p.id"
                    course_id_select = "c.id AS course_id"
                    allow_course_active = has_courses_active
                else:
                    join_clause = "LEFT JOIN courses c ON 1=0"
                    course_id_select = "NULL AS course_id"
                    allow_course_active = False

                active_filters: list[str] = []
                if not admin and has_projects_active:
                    active_filters.append("p.is_active = 1")
                if not admin and allow_course_active:
                    active_filters.append("c.is_active = 1")
                active_filter = f"AND {' AND '.join(active_filters)}" if active_filters else ""

                project_is_active_select = _select_is_active(has_projects_active, "p.is_active")
                shard_rows = conn.execute(
                    f"""
                    SELECT
                        p.id,
                        {course_id_select},
                        p.project_author_id,
                        p.project_collection_id,
                        p.project_work_id,
                        p.project_title,
                        p.project_url_slug,
                        p.scraped_at,
                        {project_is_active_select},
                        c.slug AS course_slug,
                        c.title AS course_title,
                        c.type AS course_type
                    FROM projects p
                    {join_clause}
                    WHERE 1=1 {active_filter}
                    ORDER BY p.id
                    """
                ).fetchall()

                shard_rows_list = _rows_to_list(shard_rows)
                for row in shard_rows_list:
                    _offset_row(row, shard.offset, ("id", "course_id"))
                rows.extend(shard_rows_list)
            finally:
                conn.close()

        rows.sort(key=lambda row: row["id"])
        return jsonify(rows)

    @bp.route("/projects/<int:project_id>/course", methods=["GET"])
    def get_course_by_project(project_id: int):
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        admin = _is_admin(user)
        shard, local_project_id = _resolve_db_id(db_manager, project_id, "Project")

        conn = db_manager.open_course_connection(shard)
        try:
            has_projects_active = _has_is_active(db_manager, conn, shard, "projects")
            has_courses_active = _has_is_active(db_manager, conn, shard, "courses")
            has_project_course_id = db_manager.course_db_has_column(
                conn,
                shard,
                "projects",
                "course_id",
            )
            has_course_project_id = db_manager.course_db_has_column(
                conn,
                shard,
                "courses",
                "project_id",
            )

            if has_project_course_id:
                join_clause = "JOIN courses c ON c.id = p.course_id"
                allow_course_active = has_courses_active
            elif has_course_project_id:
                join_clause = "JOIN courses c ON c.project_id = p.id"
                allow_course_active = has_courses_active
            else:
                abort(404, description=f"Project id={project_id} not found or inactive")

            active_filters: list[str] = []
            if not admin and has_projects_active:
                active_filters.append("p.is_active = 1")
            if not admin and allow_course_active:
                active_filters.append("c.is_active = 1")
            active_filter = f"AND {' AND '.join(active_filters)}" if active_filters else ""

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
                {join_clause}
                WHERE p.id = ? {active_filter}
                """,
                (local_project_id,),
            ).fetchone()

            if not row:
                abort(404, description=f"Project id={project_id} not found or inactive")

            return jsonify(
                {
                    "project": {
                        "id": db_manager.course_global_id(shard, row["id"]),
                        "project_author_id": row["project_author_id"],
                        "project_collection_id": row["project_collection_id"],
                        "project_work_id": row["project_work_id"],
                        "project_title": row["project_title"],
                        "project_url_slug": row["project_url_slug"],
                        "scraped_at": row["scraped_at"],
                    },
                    "course": {
                        "id": db_manager.course_global_id(shard, row["course_id"]),
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

        rows: list[dict[str, Any]] = []
        for shard in db_manager.iter_course_shards():
            conn = db_manager.open_course_connection(shard)
            try:
                has_courses_active = _has_is_active(db_manager, conn, shard, "courses")
                active_filter = _and_is_active(has_courses_active, admin, "is_active")
                course_is_active_select = _select_is_active(has_courses_active, "is_active")

                shard_rows = conn.execute(
                    f"""
                    SELECT id, slug, title, type, {course_is_active_select}
                    FROM courses
                    WHERE COALESCE(LOWER(TRIM(type)), '') NOT IN ('path', 'project')
                    {active_filter}
                    ORDER BY id
                    """
                ).fetchall()

                shard_rows_list = _rows_to_list(shard_rows)
                for row in shard_rows_list:
                    _offset_row(row, shard.offset, ("id",))
                rows.extend(shard_rows_list)
            finally:
                conn.close()

        rows.sort(key=lambda row: row["id"])
        return jsonify(rows)

    @bp.route("/course-details", methods=["POST"])
    def get_course_data():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        payload = request.get_json(force=True, silent=True) or {}
        _require(payload, "course_id")
        course_id = int(payload["course_id"])
        admin = _is_admin(user)

        shard, local_course_id = _resolve_db_id(db_manager, course_id, "Course")
        conn = db_manager.open_course_connection(shard)
        try:
            has_courses_active = _has_is_active(db_manager, conn, shard, "courses")
            has_course_project_id = db_manager.course_db_has_column(
                conn,
                shard,
                "courses",
                "project_id",
            )
            active_filter = _and_is_active(has_courses_active, admin, "c.is_active")

            project_id_select = "c.project_id AS project_id" if has_course_project_id else "NULL AS project_id"

            row = conn.execute(
                f"SELECT c.id, c.slug, c.title, c.type, c.toc_json, c.path_id, {project_id_select} "
                f"FROM courses c WHERE c.id = ? {active_filter}",
                (local_course_id,),
            ).fetchone()

            if not row:
                abort(404, description=f"Course id={course_id} not found or inactive")

            if not admin and row["path_id"] is not None:
                has_paths_active = _has_is_active(db_manager, conn, shard, "paths")
                if has_paths_active:
                    path_row = conn.execute(
                        "SELECT is_active FROM paths WHERE id = ?",
                        (row["path_id"],),
                    ).fetchone()
                    if path_row and not path_row["is_active"]:
                        abort(404, description=f"Course id={course_id} not found or inactive")

            if not admin:
                project_active = _project_is_active_for_course(
                    db_manager,
                    conn,
                    shard,
                    local_course_id,
                    row["project_id"],
                )
                if project_active is False:
                    abort(404, description=f"Course id={course_id} not found or inactive")

            data = dict(row)
            data["id"] = course_id
            data.pop("path_id", None)
            data.pop("project_id", None)
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

        shard, local_course_id = _resolve_db_id(db_manager, course_id, "Course")
        conn = db_manager.open_course_connection(shard)
        try:
            has_courses_active = _has_is_active(db_manager, conn, shard, "courses")
            has_course_project_id = db_manager.course_db_has_column(
                conn,
                shard,
                "courses",
                "project_id",
            )
            project_id_select = "project_id" if has_course_project_id else "NULL AS project_id"

            if not admin:
                if has_courses_active:
                    course_row = conn.execute(
                        f"SELECT id, path_id, {project_id_select} FROM courses WHERE id = ? AND is_active = 1",
                        (local_course_id,),
                    ).fetchone()
                else:
                    course_row = conn.execute(
                        f"SELECT id, path_id, {project_id_select} FROM courses WHERE id = ?",
                        (local_course_id,),
                    ).fetchone()

                if not course_row:
                    abort(404, description=f"Course id={course_id} not found or inactive")

                if course_row["path_id"] is not None:
                    has_paths_active = _has_is_active(db_manager, conn, shard, "paths")
                    if has_paths_active:
                        path_row = conn.execute(
                            "SELECT is_active FROM paths WHERE id = ?",
                            (course_row["path_id"],),
                        ).fetchone()
                        if path_row and not path_row["is_active"]:
                            abort(404, description=f"Course id={course_id} not found or inactive")

                project_active = _project_is_active_for_course(
                    db_manager,
                    conn,
                    shard,
                    local_course_id,
                    course_row["project_id"],
                )
                if project_active is False:
                    abort(404, description=f"Course id={course_id} not found or inactive")

            topic = conn.execute(
                """
                SELECT t.topic_name, t.topic_slug, t.topic_url, t.api_url, t.status
                FROM topics t
                WHERE t.course_id = ? AND t.topic_index = ?
                """,
                (local_course_id, topic_index),
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
                (local_course_id, topic_index),
            ).fetchall()

            from ..utils import process_content_json
            components = [
                {
                    "index": row["component_index"],
                    "type": row["type"],
                    "content": json.loads(process_content_json(row["content_json"]) or "{}"),
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
