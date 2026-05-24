from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class OracleAuthConfig:
    user: str
    password: str
    dsn: str
    wallet_dir: str
    wallet_password: str
    pool_min: int
    pool_max: int
    thick_mode: bool
    lib_dir: str

    @property
    def is_configured(self) -> bool:
        return bool(self.user and self.password and self.dsn)


@dataclass
class AppConfig:
    flask_port: int
    flask_debug: bool
    waitress_threads: int
    db_keepalive_enabled: bool
    db_keepalive_interval_minutes: int

    auth_db_engine: str
    auth_sqlite_db_path: str
    oracle_auth: OracleAuthConfig

    course_db_engine: str
    course_sqlite_db_paths: tuple[str, ...]

    jwt_secret: str
    jwt_expires_days: int
    totp_issuer: str
    invite_codes: set[str]

    rsa_private_key: str
    gemini_api_key: str
    groq_api_key: str
    highlights_enabled: bool


def load_env_file(env_path: Path | None = None) -> None:
    """Load key=value pairs from server/.env if present.

    python-dotenv is optional. If unavailable, the parser below handles the
    simple key=value format used by this project.
    """
    candidate = env_path or (Path(__file__).resolve().parents[1] / ".env")
    try:
        from dotenv import load_dotenv

        load_dotenv(candidate)
        return
    except ImportError:
        pass

    if not candidate.exists():
        return

    with candidate.open("r", encoding="utf-8") as env_file:
        for line in env_file:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, _, value = raw.partition("=")
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            os.environ.setdefault(key.strip(), value)


def _parse_csv_codes(raw_codes: str) -> set[str]:
    return {code.strip() for code in raw_codes.split(",") if code.strip()}


def _parse_sqlite_db_paths(raw: str) -> tuple[str, ...]:
    """Parse multi-DB configuration from COURSE_SQLITE_DB_PATHS_JSON.

    Expected JSON format:
    [
      "/path/to/course_db_a.db",
      "/path/to/course_db_b.db"
    ]
    """
    raw = (raw or "").strip()
    if not raw:
        return ()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("COURSE_SQLITE_DB_PATHS_JSON must be valid JSON") from exc

    if not isinstance(parsed, list):
        raise ValueError("COURSE_SQLITE_DB_PATHS_JSON must be a JSON array")

    paths: list[str] = []
    for item in parsed:
        if isinstance(item, str):
            db_path = item.strip()
        elif isinstance(item, dict):
            db_path = str(item.get("db_path", "")).strip()
        else:
            raise ValueError("Each entry must be a path string or object with db_path")

        if not db_path:
            raise ValueError("Each entry must include a non-empty db_path")

        if db_path not in paths:
            paths.append(db_path)

    return tuple(paths)


def load_config() -> AppConfig:
    load_env_file()

    raw_paths = os.environ.get("COURSE_SQLITE_DB_PATHS_JSON", "")

    try:
        course_db_paths = _parse_sqlite_db_paths(raw_paths)
    except ValueError as exc:
        log.warning("Invalid course DB paths ignored: %s", exc)
        course_db_paths = ()

    oracle_auth = OracleAuthConfig(
        user=os.environ.get("ORACLE_USER", ""),
        password=os.environ.get("ORACLE_PASSWORD", ""),
        dsn=os.environ.get("ORACLE_DSN", ""),
        wallet_dir=os.environ.get("ORACLE_WALLET_DIR", "").strip(),
        wallet_password=os.environ.get("ORACLE_WALLET_PASSWORD", "").strip(),
        pool_min=int(os.environ.get("ORACLE_POOL_MIN", "1")),
        pool_max=int(os.environ.get("ORACLE_POOL_MAX", "5")),
        thick_mode=os.environ.get("ORACLE_THICK_MODE", "0") == "1",
        lib_dir=os.environ.get("ORACLE_LIB_DIR", "").strip(),
    )

    return AppConfig(
        flask_port=int(os.environ.get("FLASK_PORT", "5000")),
        flask_debug=os.environ.get("FLASK_DEBUG", "0") == "1",
        waitress_threads=max(2, int(os.environ.get("WAITRESS_THREADS", "8"))),
        db_keepalive_enabled=os.environ.get("DB_KEEPALIVE_ENABLED", "1") == "1",
        db_keepalive_interval_minutes=max(1, int(os.environ.get("DB_KEEPALIVE_INTERVAL_MINUTES", "10"))),

        auth_db_engine=os.environ.get("AUTH_DB_ENGINE", "oracle").strip().lower(),
        auth_sqlite_db_path=os.environ.get("AUTH_SQLITE_DB_PATH", str(Path(__file__).resolve().parents[1] / "auth.sqlite3")),
        oracle_auth=oracle_auth,

        course_db_engine=os.environ.get("COURSE_DB_ENGINE", "sqlite").strip().lower(),
        course_sqlite_db_paths=course_db_paths,

        jwt_secret=os.environ.get("JWT_SECRET", "changeme-dev-secret"),
        jwt_expires_days=int(os.environ.get("JWT_EXPIRES_DAYS", "7")),
        totp_issuer=os.environ.get("TOTP_ISSUER", "EduViewer"),
        invite_codes=_parse_csv_codes(os.environ.get("INVITE_CODES", "")),

        rsa_private_key=os.environ.get("RSA_PRIVATE_KEY", "").replace("\\n", "\n").strip(),
        gemini_api_key=os.environ.get("GEMINI_API_KEY", "").strip(),
        groq_api_key=os.environ.get("GROQ_API_KEY", "").strip(),
        highlights_enabled=os.environ.get("HIGHLIGHTS_ENABLED", "1") == "1",
    )
