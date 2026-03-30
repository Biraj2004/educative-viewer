from __future__ import annotations

import logging
import sqlite3

log = logging.getLogger(__name__)


class SQLiteAuthDatabase:
    engine = "sqlite"

    def __init__(self, db_path: str):
        self.db_path = db_path

    @property
    def is_configured(self) -> bool:
        return bool(self.db_path)

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def keep_alive(self) -> None:
        conn = self.get_connection()
        try:
            conn.execute("SELECT 1")
        finally:
            conn.close()

    def init_schema(self) -> None:
        conn = self.get_connection()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT
                )
                """
            )
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_name ON roles (name COLLATE NOCASE)"
            )

            conn.execute(
                "INSERT OR IGNORE INTO roles (id, name, description) VALUES (1, 'user', 'Regular authenticated user')"
            )
            conn.execute(
                "INSERT OR IGNORE INTO roles (id, name, description) VALUES (2, 'admin', 'Administrator with no restrictions')"
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    name TEXT,
                    username TEXT,
                    avatar TEXT,
                    role_id INTEGER NOT NULL DEFAULT 1 REFERENCES roles(id),
                    is_active INTEGER NOT NULL DEFAULT 1,
                    is_first_login INTEGER NOT NULL DEFAULT 0,
                    two_factor_enabled INTEGER NOT NULL DEFAULT 0,
                    login_ip_log TEXT,
                    theme TEXT NOT NULL DEFAULT 'light',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                )
                """
            )
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email COLLATE NOCASE)"
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users_sensitive (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    password_hash TEXT NOT NULL DEFAULT '',
                    two_factor_secret TEXT,
                    two_factor_confirmed INTEGER NOT NULL DEFAULT 0,
                    session_id TEXT,
                    last_login_ip TEXT,
                    last_login_at TEXT,
                    current_token TEXT,
                    failed_attempts INTEGER NOT NULL DEFAULT 0,
                    locked_until TEXT,
                    temp_password_expires_at TEXT,
                    onboarding_temp_password_hash TEXT
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    course_id INTEGER NOT NULL,
                    topic_index INTEGER NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    last_visited_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                    last_visited_course_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                )
                """
            )
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_user_progress
                ON user_progress (user_id, course_id, topic_index)
                """
            )

            conn.commit()
        finally:
            conn.close()

        log.info("SQLite auth DB ready (path=%s)", self.db_path)

    def ensure_is_active_column(self) -> None:
        """Lazily add is_active column to users table if it doesn't exist."""
        conn = self.get_connection()
        try:
            conn.execute("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Already exists
        finally:
            conn.close()

    def ensure_first_login_columns(self) -> None:
        """Lazily add first-login security columns if they don't exist yet."""
        conn = self.get_connection()
        try:
            for sql in [
                "ALTER TABLE users ADD COLUMN is_first_login INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE users_sensitive ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE users_sensitive ADD COLUMN locked_until TEXT",
                "ALTER TABLE users_sensitive ADD COLUMN temp_password_expires_at TEXT",
                "ALTER TABLE users_sensitive ADD COLUMN onboarding_temp_password_hash TEXT",
            ]:
                try:
                    conn.execute(sql)
                    conn.commit()
                except sqlite3.OperationalError:
                    pass  # Column already exists
        finally:
            conn.close()

    def get_all_users(self) -> list[sqlite3.Row]:
        self.ensure_is_active_column()
        self.ensure_first_login_columns()
        conn = self.get_connection()
        try:
            return conn.execute(
                """
                SELECT u.id, u.email, u.name, u.username, u.role_id, r.name as role_name,
                       u.is_active, u.created_at, u.two_factor_enabled,
                       COALESCE(u.is_first_login, 0) as is_first_login,
                       COALESCE(s.failed_attempts, 0) as failed_attempts,
                       s.locked_until
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN users_sensitive s ON s.user_id = u.id
                ORDER BY u.id
                """
            ).fetchall()
        finally:
            conn.close()

    def update_user_status(self, user_id: int, is_active: bool) -> bool:
        self.ensure_is_active_column()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                "UPDATE users SET is_active = ? WHERE id = ?",
                (1 if is_active else 0, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    def is_integrity_error(self, exc: Exception) -> bool:
        return isinstance(exc, sqlite3.IntegrityError)

    def create_user(
        self,
        email: str,
        name: str | None,
        role_id: int,
        password_hash: str,
        temp_password_expires_at: str,
    ) -> int:
        """Create an admin-provisioned user with a temporary password. Returns the new user id."""
        self.ensure_first_login_columns()
        conn = self.get_connection()
        try:
            cur = conn.execute(
                "INSERT INTO users (email, name, role_id, is_first_login, two_factor_enabled) VALUES (?, ?, ?, 1, 1)",
                (email, name, role_id),
            )
            user_id = cur.lastrowid
            conn.execute(
                "INSERT INTO users_sensitive (user_id, password_hash, temp_password_expires_at, onboarding_temp_password_hash) "
                "VALUES (?, ?, ?, ?)",
                (user_id, password_hash, temp_password_expires_at, password_hash),
            )
            conn.commit()
            return user_id
        finally:
            conn.close()

    def update_user_profile(self, user_id: int, name: str | None, email: str) -> bool:
        """Update a user's display name and email."""
        conn = self.get_connection()
        try:
            cur = conn.execute(
                "UPDATE users SET name = ?, email = ? WHERE id = ?",
                (name, email, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    def delete_user(self, user_id: int) -> bool:
        """Delete a user and all cascaded rows (sensitive data, progress)."""
        conn = self.get_connection()
        try:
            cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    def reset_user_password(
        self,
        user_id: int,
        password_hash: str,
        temp_password_expires_at: str,
    ) -> bool:
        """Overwrite the password, re-arm the first-login flag, and reset 2FA & lockout."""
        self.ensure_first_login_columns()
        conn = self.get_connection()
        try:
            conn.execute(
                "UPDATE users SET is_first_login = 1, two_factor_enabled = 1 WHERE id = ?",
                (user_id,),
            )
            conn.execute(
                "UPDATE users_sensitive "
                "SET password_hash = :pw_hash, temp_password_expires_at = :exp, "
                "onboarding_temp_password_hash = :pw_hash, "
                "two_factor_confirmed = 0, two_factor_secret = NULL, "
                "failed_attempts = 0, locked_until = NULL "
                "WHERE user_id = :user_id",
                {
                    "pw_hash": password_hash,
                    "exp": temp_password_expires_at,
                    "user_id": user_id,
                },
            )
            conn.commit()
            return True
        finally:
            conn.close()
