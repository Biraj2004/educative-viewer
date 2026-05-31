from __future__ import annotations

import atexit
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask

from backend.config import AppConfig
from backend.db.oracle_auth import OracleAuthDatabase
from backend.db.sqlite_auth import SQLiteAuthDatabase
from backend.db.sqlite_courses import CourseDbShard, SQLiteCourseDatabase
from backend.db.sql_helpers import execute, fetch_one_dict

log = logging.getLogger(__name__)


class DBManager:
    """Centralized database manager with pluggable backends.

    Current support:
    - Auth DB: oracle, sqlite
    - Course DB: sqlite
    """

    def __init__(self, config: AppConfig):
        self.config = config
        self._scheduler: BackgroundScheduler | None = None

        self.auth_backend = self._build_auth_backend()
        self.course_backend = self._build_course_backend()

    def _build_auth_backend(self):
        engine = self.config.auth_db_engine
        if engine == "oracle":
            return OracleAuthDatabase(self.config.oracle_auth)
        if engine == "sqlite":
            return SQLiteAuthDatabase(self.config.auth_sqlite_db_path)
        raise ValueError(f"Unsupported AUTH_DB_ENGINE '{engine}'. Supported: oracle, sqlite")

    def _build_course_backend(self):
        engine = self.config.course_db_engine
        if engine == "sqlite":
            return SQLiteCourseDatabase(self.config.course_sqlite_db_paths)
        raise ValueError(f"Unsupported COURSE_DB_ENGINE '{engine}'. Supported: sqlite")

    def reload_course_backend(self) -> None:
        self.course_backend = self._build_course_backend()

    def get_auth_connection(self):
        return self.auth_backend.get_connection()

    def get_course_connection(self):
        """Return a connection to the first configured course DB."""
        shard = self.course_backend.iter_shards()[0]
        return self.course_backend.get_connection(shard)

    def iter_course_shards(self) -> tuple[CourseDbShard, ...]:
        return self.course_backend.iter_shards()

    def resolve_course_db_id(self, global_id: int) -> tuple[CourseDbShard, int]:
        return self.course_backend.resolve_global_id(global_id)

    def open_course_connection(self, shard: CourseDbShard):
        return self.course_backend.get_connection(shard)

    def course_global_id(self, shard: CourseDbShard, local_id: int) -> int:
        return self.course_backend.to_global_id(shard, local_id)

    def course_db_has_column(self, conn, shard: CourseDbShard, table: str, column: str) -> bool:
        return self.course_backend.has_column(conn, shard, table, column)

    def course_db_invalidate_columns(self, shard: CourseDbShard, table: str | None = None) -> None:
        self.course_backend.invalidate_table_columns(shard, table)

    def insert_user(self, conn, *, email: str, name: str | None) -> int:
        """Insert a user using SQL compatible with both Oracle and SQLite."""
        execute(
            conn,
            "INSERT INTO users (email, name, role_id) VALUES (:email, :name, 1)",
            {"email": email, "name": name},
        )
        row = fetch_one_dict(
            conn,
            "SELECT id FROM users WHERE UPPER(email) = UPPER(:email)",
            {"email": email},
        )
        if not row or row.get("id") is None:
            raise RuntimeError("Failed to load inserted user id")
        return int(row["id"])

    def upsert_user_progress(
        self,
        conn,
        *,
        user_id: int,
        course_id: int,
        topic_index: int,
        completed: bool,
        now_iso: str,
    ) -> None:
        """Cross-DB upsert implemented as UPDATE then INSERT with retry.

        This avoids database-specific MERGE/ON CONFLICT syntax while preserving
        idempotent behavior.
        """
        params = {
            "user_id": user_id,
            "course_id": course_id,
            "topic_index": topic_index,
            "completed": int(completed),
            "now": now_iso,
        }
        update_sql = (
            "UPDATE user_progress "
            "SET completed = :completed, last_visited_at = :now, last_visited_course_at = :now "
            "WHERE user_id = :user_id AND course_id = :course_id AND topic_index = :topic_index"
        )
        updated = execute(conn, update_sql, params)
        if updated > 0:
            return

        try:
            execute(
                conn,
                "INSERT INTO user_progress "
                "(user_id, course_id, topic_index, completed, last_visited_at, last_visited_course_at) "
                "VALUES (:user_id, :course_id, :topic_index, :completed, :now, :now)",
                params,
            )
        except Exception as exc:
            if not self.auth_backend.is_integrity_error(exc):
                raise
            # Concurrent insert race: ensure final values are applied.
            execute(conn, update_sql, params)

    def init_auth_db(self) -> None:
        self.auth_backend.init_schema()
        self.auth_backend.ensure_is_active_column()
        self.auth_backend.ensure_first_login_columns()
        self.auth_backend.ensure_max_active_sessions_column()
        self.auth_backend.ensure_max_ip_addresses_column()
        self.auth_backend.ensure_course_reader_state_table()

    def keep_auth_db_alive(self) -> None:
        self.auth_backend.keep_alive()
        log.debug("Auth DB keep-alive ping succeeded")

    def start_keepalive_scheduler(self, flask_app: Flask) -> None:
        if self._scheduler is not None:
            return

        if not self.config.db_keepalive_enabled:
            log.info("Auth DB keep-alive scheduler is disabled")
            return

        if not self.auth_backend.is_configured:
            log.info("Auth DB keep-alive scheduler skipped: auth DB is not configured")
            return

        self._scheduler = BackgroundScheduler(daemon=True)
        self._scheduler.add_job(
            func=lambda: self._run_keepalive_in_app_context(flask_app),
            trigger="interval",
            minutes=self.config.db_keepalive_interval_minutes,
            id="keep_db_alive_job",
            name=(
                "Keep DB connection alive every "
                f"{self.config.db_keepalive_interval_minutes} minute(s)"
            ),
            replace_existing=True,
        )
        self._scheduler.start()
        atexit.register(self.stop_keepalive_scheduler)
        log.info(
            "Auth DB keep-alive scheduler started (every %d minute(s))",
            self.config.db_keepalive_interval_minutes,
        )

    def _run_keepalive_in_app_context(self, flask_app: Flask) -> None:
        try:
            with flask_app.app_context():
                self.keep_auth_db_alive()
        except Exception as exc:
            log.warning("Auth DB keep-alive ping failed: %s", exc)

    def stop_keepalive_scheduler(self) -> None:
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)
