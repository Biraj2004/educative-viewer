"""
Admin – Test Components Routes
===============================
CRUD endpoints for managing which components appear on the test page
(/dashboard/test).  All routes require role == "admin".
"""

from __future__ import annotations

import random

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

        pinned_rows = _fetch_pinned_components(db_manager)
        random_rows = _fetch_random_components(db_manager, per_type_limit=5)
        pinned_ids = {row.get("component_id") for row in pinned_rows}
        combined = pinned_rows + [row for row in random_rows if row.get("component_id") not in pinned_ids]
        return jsonify(combined), 200

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

        from backend.utils import process_content_json
        return (
            jsonify({
                "component_id": component_id,
                "component_type": component["type"],
                "content_json": process_content_json(component["content_json"] or "{}"),
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


def _fetch_pinned_components(db_manager: DBManager) -> list[dict]:
        # test_components, components, topics, and courses all live in the same
        # SQLite file (shard 0), so a single JOIN is correct and efficient.
        # The component_id stored in test_components is the local ID for shard 0.
        shard0 = db_manager.iter_course_shards()[0]
        conn = db_manager.open_course_connection(shard0)
        try:
                ensure_test_components_table(conn)
                rows = conn.execute(
                        """
                        SELECT
                            tc.component_id,
                            tc.component_type,
                            tc.content_json,
                            tc.topic_url,
                            c.course_id,
                            c.topic_index,
                            t.topic_slug,
                            co.slug AS course_slug
                        FROM test_components AS tc
                        LEFT JOIN components AS c
                            ON tc.component_id = c.id
                        LEFT JOIN topics AS t
                            ON c.course_id = t.course_id
                           AND c.topic_index = t.topic_index
                        LEFT JOIN courses AS co
                            ON c.course_id = co.id
                        ORDER BY tc.component_id
                        """
                ).fetchall()
                results = []
                from backend.utils import process_content_json
                for r in rows:
                        item = dict(r)
                        if "content_json" in item:
                            item["content_json"] = process_content_json(item["content_json"])
                        # Apply the shard-0 global ID offset to course_id for
                        # consistency with _fetch_random_components output.
                        if item.get("course_id") is not None:
                                item["course_id"] = db_manager.course_global_id(
                                        shard0, int(item["course_id"])
                                )
                        results.append(item)
                return results
        finally:
                conn.close()




def _fetch_random_components(db_manager: DBManager, per_type_limit: int) -> list[dict]:
        if per_type_limit <= 0:
                return []

        rows: list[dict] = []
        query = """
        WITH ranked_topics AS (
            SELECT
                topics.course_id AS course_id,
                topics.topic_index AS topic_index,
                topics.topic_url AS topic_url,
                topics.topic_slug AS topic_slug,
                ROW_NUMBER() OVER (
                    PARTITION BY topics.course_id, topics.topic_index
                    ORDER BY topics.id
                ) AS row_number_within_course_topic
            FROM topics AS topics
        ),
        ranked_components AS (
            SELECT
                components.id AS component_id,
                components.course_id AS course_id,
                components.component_index AS component_index,
                components.topic_index AS topic_index,
                components.type AS component_type,
                components.content_json AS content_json,
                ROW_NUMBER() OVER (
                    PARTITION BY components.type
                    ORDER BY RANDOM()
                ) AS row_number_within_type
            FROM components AS components
        )
        SELECT
            ranked_components.component_id,
            ranked_components.course_id,
            ranked_components.topic_index,
            ranked_components.component_index,
            ranked_components.component_type,
            ranked_components.content_json,
            ranked_topics.topic_url AS topic_url,
            ranked_topics.topic_slug AS topic_slug,
            courses.slug AS course_slug
        FROM ranked_components AS ranked_components
        JOIN ranked_topics AS ranked_topics
            ON ranked_components.course_id = ranked_topics.course_id
         AND ranked_components.topic_index = ranked_topics.topic_index
        LEFT JOIN courses AS courses
            ON ranked_components.course_id = courses.id
        WHERE ranked_components.row_number_within_type <= ?
            AND ranked_topics.row_number_within_course_topic = 1
        ORDER BY ranked_components.component_type, ranked_components.row_number_within_type
        """

        for shard in db_manager.iter_course_shards():
                conn = db_manager.open_course_connection(shard)
                try:
                        shard_rows = conn.execute(query, (per_type_limit,)).fetchall()
                        from backend.utils import process_content_json
                        for row in shard_rows:
                                item = dict(row)
                                if "content_json" in item:
                                    item["content_json"] = process_content_json(item["content_json"])
                                item["component_id"] = db_manager.course_global_id(shard, int(item["component_id"]))
                                item["course_id"] = db_manager.course_global_id(shard, int(item["course_id"]))
                                rows.append(item)
                finally:
                        conn.close()

        grouped: dict[str, list[dict]] = {}
        for row in rows:
                grouped.setdefault(row.get("component_type") or "unknown", []).append(row)

        results: list[dict] = []
        for items in grouped.values():
                random.shuffle(items)
                results.extend(items[:per_type_limit])

        return results
