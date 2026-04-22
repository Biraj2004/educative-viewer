from __future__ import annotations

import logging

import oracledb

from backend.config import OracleAuthConfig

log = logging.getLogger(__name__)

# Fetch CLOB values as plain Python strings.
oracledb.defaults.fetch_lobs = False


class OracleAuthDatabase:
    engine = "oracle"
    _thick_client_ready = False

    def __init__(self, config: OracleAuthConfig):
        self.config = config
        self._pool = None

    @property
    def is_configured(self) -> bool:
        return self.config.is_configured

    def _get_pool(self):
        if self._pool is not None:
            return self._pool

        if not self.is_configured:
            raise RuntimeError(
                "Oracle auth DB is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_DSN."
            )

        if self.config.thick_mode and not OracleAuthDatabase._thick_client_ready:
            oracledb.init_oracle_client(lib_dir=self.config.lib_dir or None)
            OracleAuthDatabase._thick_client_ready = True

        kwargs: dict = {
            "user": self.config.user,
            "password": self.config.password,
            "dsn": self.config.dsn,
            "min": self.config.pool_min,
            "max": self.config.pool_max,
            "increment": 1,
        }

        if self.config.wallet_dir:
            if self.config.thick_mode:
                kwargs["config_dir"] = self.config.wallet_dir
            else:
                kwargs["wallet_location"] = self.config.wallet_dir
        if self.config.wallet_password:
            kwargs["wallet_password"] = self.config.wallet_password

        self._pool = oracledb.create_pool(**kwargs)
        return self._pool

    def get_connection(self):
        return self._get_pool().acquire()

    def keep_alive(self) -> None:
        if not self.is_configured:
            return

        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute("SELECT 1 FROM DUAL")
                cursor.fetchone()
            finally:
                cursor.close()
        finally:
            conn.close()

    def _exec_ddl(self, cursor, sql: str) -> None:
        try:
            cursor.execute(sql)
        except oracledb.DatabaseError as exc:
            (err,) = exc.args
            if err.code != 955:
                raise

    def init_schema(self) -> None:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                self._exec_ddl(
                    cursor,
                    """
                    CREATE TABLE roles (
                        id NUMBER PRIMARY KEY,
                        name VARCHAR2(100 CHAR) NOT NULL,
                        description VARCHAR2(500 CHAR)
                    )
                    """,
                )
                self._exec_ddl(cursor, "CREATE UNIQUE INDEX uq_roles_name ON roles (UPPER(name))")

                for role_id, role_name, role_desc in [
                    (1, "user", "Regular authenticated user"),
                    (2, "admin", "Administrator with no restrictions"),
                ]:
                    try:
                        cursor.execute(
                            "INSERT INTO roles (id, name, description) VALUES (:1, :2, :3)",
                            (role_id, role_name, role_desc),
                        )
                    except oracledb.IntegrityError:
                        pass

                self._exec_ddl(
                    cursor,
                    """
                    CREATE TABLE users (
                        id                 NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        email              VARCHAR2(255 CHAR) NOT NULL,
                        name               VARCHAR2(255 CHAR),
                        username           VARCHAR2(255 CHAR),
                        avatar             VARCHAR2(1000 CHAR),
                        role_id            NUMBER DEFAULT 1 NOT NULL REFERENCES roles(id),
                        is_active          NUMBER(1,0) DEFAULT 1 NOT NULL,
                        is_first_login     NUMBER(1,0) DEFAULT 0 NOT NULL,
                        two_factor_enabled NUMBER(1,0) DEFAULT 0 NOT NULL,
                        login_ip_log       CLOB,
                        theme              VARCHAR2(20 CHAR) DEFAULT 'light' NOT NULL,
                        created_at         VARCHAR2(30 CHAR) DEFAULT
                            TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC',
                                    'YYYY-MM-DD"T"HH24:MI:SS"Z"') NOT NULL
                    )
                    """,
                )
                self._exec_ddl(cursor, "CREATE UNIQUE INDEX uq_users_email ON users (UPPER(email))")

                self._exec_ddl(
                    cursor,
                    """
                    CREATE TABLE users_sensitive (
                        user_id                    NUMBER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                        password_hash              VARCHAR2(200 CHAR) DEFAULT '' NOT NULL,
                        two_factor_secret          VARCHAR2(64 CHAR),
                        two_factor_confirmed       NUMBER(1,0) DEFAULT 0 NOT NULL,
                        session_id                 VARCHAR2(64 CHAR),
                        last_login_ip              VARCHAR2(50 CHAR),
                        last_login_at              VARCHAR2(30 CHAR),
                        current_token              CLOB,
                        failed_attempts            NUMBER DEFAULT 0 NOT NULL,
                        locked_until               VARCHAR2(30 CHAR),
                        temp_password_expires_at   VARCHAR2(30 CHAR),
                        onboarding_temp_password_hash VARCHAR2(200 CHAR)
                    )
                    """,
                )

                self._exec_ddl(
                    cursor,
                    """
                    CREATE TABLE user_progress (
                        id                     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        user_id                NUMBER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        course_id              NUMBER NOT NULL,
                        topic_index            NUMBER NOT NULL,
                        completed              NUMBER(1,0) DEFAULT 0 NOT NULL,
                        last_visited_at        VARCHAR2(30 CHAR) DEFAULT
                            TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC',
                                    'YYYY-MM-DD"T"HH24:MI:SS"Z"') NOT NULL,
                        last_visited_course_at VARCHAR2(30 CHAR) DEFAULT
                            TO_CHAR(SYSTIMESTAMP AT TIME ZONE 'UTC',
                                    'YYYY-MM-DD"T"HH24:MI:SS"Z"') NOT NULL
                    )
                    """,
                )
                self._exec_ddl(
                    cursor,
                    "CREATE UNIQUE INDEX uq_user_progress ON user_progress (user_id, course_id, topic_index)",
                )

                conn.commit()
            finally:
                cursor.close()
        finally:
            conn.close()

        log.info("Oracle auth DB ready (dsn=%s)", self.config.dsn)

    def is_integrity_error(self, exc: Exception) -> bool:
        return isinstance(exc, oracledb.IntegrityError)

    def ensure_is_active_column(self) -> None:
        """Lazily add is_active column to users table if it doesn't exist."""
        if not self.is_configured:
            return
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute("ALTER TABLE users ADD is_active NUMBER(1,0) DEFAULT 1 NOT NULL")
                conn.commit()
            except oracledb.DatabaseError as exc:
                (err,) = exc.args
                # ORA-01430: column being added already exists in table
                if err.code != 1430:
                    raise
            finally:
                cursor.close()
        finally:
            conn.close()

    def ensure_first_login_columns(self) -> None:
        """Lazily add first-login security columns if they don't exist yet."""
        if not self.is_configured:
            return
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                for sql in [
                    "ALTER TABLE users ADD is_first_login NUMBER(1,0) DEFAULT 0 NOT NULL",
                    "ALTER TABLE users_sensitive ADD failed_attempts NUMBER DEFAULT 0 NOT NULL",
                    "ALTER TABLE users_sensitive ADD locked_until VARCHAR2(30 CHAR)",
                    "ALTER TABLE users_sensitive ADD temp_password_expires_at VARCHAR2(30 CHAR)",
                    "ALTER TABLE users_sensitive ADD onboarding_temp_password_hash VARCHAR2(200 CHAR)",
                ]:
                    try:
                        cursor.execute(sql)
                    except oracledb.DatabaseError as exc:
                        (err,) = exc.args
                        # ORA-01430: column being added already exists in table
                        if err.code != 1430:
                            raise
                conn.commit()
            finally:
                cursor.close()
        finally:
            conn.close()

    def get_all_users(self) -> list[dict]:
        self.ensure_is_active_column()
        self.ensure_first_login_columns()
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute(
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
                )
                columns = [col[0].lower() for col in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
            finally:
                cursor.close()
        finally:
            conn.close()

    def update_user_status(self, user_id: int, is_active: bool) -> bool:
        self.ensure_is_active_column()
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "UPDATE users SET is_active = :1 WHERE id = :2",
                    (1 if is_active else 0, user_id),
                )
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
        finally:
            conn.close()

    def create_user(
        self,
        email: str,
        name: str | None,
        role_id: int,
        password_hash: str,
        temp_password_expires_at: str,
    ) -> int:
        self.ensure_first_login_columns()
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                user_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    "INSERT INTO users (email, name, role_id, is_first_login, two_factor_enabled) "
                    "VALUES (:1, :2, :3, 1, 1) RETURNING id INTO :4",
                    (email, name, role_id, user_id_var),
                )
                user_id = int(user_id_var.getvalue()[0])
                cursor.execute(
                    "INSERT INTO users_sensitive (user_id, password_hash, temp_password_expires_at, onboarding_temp_password_hash) "
                    "VALUES (:1, :2, :3, :4)",
                    (user_id, password_hash, temp_password_expires_at, password_hash),
                )
                conn.commit()
                return user_id
            finally:
                cursor.close()
        finally:
            conn.close()

    def update_user_profile(self, user_id: int, name: str | None, email: str) -> bool:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "UPDATE users SET name = :1, email = :2 WHERE id = :3",
                    (name, email, user_id),
                )
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
        finally:
            conn.close()

    def delete_user(self, user_id: int) -> bool:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute("DELETE FROM users WHERE id = :1", (user_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
        finally:
            conn.close()

    def reset_user_password(
        self,
        user_id: int,
        password_hash: str,
        temp_password_expires_at: str,
    ) -> bool:
        self.ensure_first_login_columns()
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "UPDATE users SET is_first_login = 1, two_factor_enabled = 1 WHERE id = :1",
                    (user_id,),
                )
                cursor.execute(
                    "UPDATE users_sensitive "
                    "SET password_hash = :1, temp_password_expires_at = :2, "
                    "onboarding_temp_password_hash = :3, "
                    "two_factor_confirmed = 0, two_factor_secret = NULL, "
                    "failed_attempts = 0, locked_until = NULL "
                    "WHERE user_id = :4",
                    (password_hash, temp_password_expires_at, password_hash, user_id),
                )
                conn.commit()
                return True
            finally:
                cursor.close()
        finally:
            conn.close()
