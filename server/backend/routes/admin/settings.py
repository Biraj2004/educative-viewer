import os
from pathlib import Path
from flask import Blueprint, jsonify, request
from backend.auth_service import AuthService
from backend.routes.admin.helpers import require_admin

ENV_FILE_PATH = os.path.join(Path(__file__).resolve().parent.parent.parent.parent, ".env")

def get_env_variable(var_name, default=""):
    return os.environ.get(var_name, default)

def set_env_variable(var_name, value):
    os.environ[var_name] = value

    if not os.path.exists(ENV_FILE_PATH):
        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            pass

    with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    var_exists = False
    for i in range(len(lines)):
        if lines[i].startswith(f"{var_name}="):
            lines[i] = f"{var_name}={value}\n"
            var_exists = True
            break

    if not var_exists:
        lines.append(f"{var_name}={value}\n")

    with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)


def register_settings_routes(bp: Blueprint, auth_service: AuthService) -> None:
    @bp.route("/settings", methods=["GET"])
    def get_settings():
        require_admin(auth_service)
        return jsonify({
            "jwt_secret": get_env_variable("JWT_SECRET"),
            "jwt_expires_days": get_env_variable("JWT_EXPIRES_DAYS", "7"),
            "invite_codes": get_env_variable("INVITE_CODES"),
            "totp_issuer": get_env_variable("TOTP_ISSUER", "EduViewer"),
            "gemini_api_key": get_env_variable("GEMINI_API_KEY"),
            "groq_api_key": get_env_variable("GROQ_API_KEY"),
            "course_db_engine": get_env_variable("COURSE_DB_ENGINE", "sqlite"),
            "course_sqlite_db_paths_json": get_env_variable("COURSE_SQLITE_DB_PATHS_JSON", '[]'),
            "highlights_enabled": get_env_variable("HIGHLIGHTS_ENABLED", "1"),
        })

    @bp.route("/settings", methods=["POST"])
    def save_settings():
        require_admin(auth_service)
        data = request.json
        
        mapping = {
            "jwt_secret": "JWT_SECRET",
            "jwt_expires_days": "JWT_EXPIRES_DAYS",
            "invite_codes": "INVITE_CODES",
            "totp_issuer": "TOTP_ISSUER",
            "gemini_api_key": "GEMINI_API_KEY",
            "groq_api_key": "GROQ_API_KEY",
            "course_db_engine": "COURSE_DB_ENGINE",
            "course_sqlite_db_paths_json": "COURSE_SQLITE_DB_PATHS_JSON",
            "highlights_enabled": "HIGHLIGHTS_ENABLED",
        }

        for key, var_name in mapping.items():
            if key in data:
                set_env_variable(var_name, str(data[key]))

        # Runtime reload of global configs
        from backend.config import _parse_csv_codes, _parse_sqlite_db_paths
        import json
        
        cfg = auth_service.config
        
        if "jwt_secret" in data:
            cfg.jwt_secret = str(data["jwt_secret"])
        if "jwt_expires_days" in data:
            try:
                cfg.jwt_expires_days = int(data["jwt_expires_days"])
            except ValueError:
                pass
        if "invite_codes" in data:
            cfg.invite_codes = _parse_csv_codes(str(data["invite_codes"]))
        if "totp_issuer" in data:
            cfg.totp_issuer = str(data["totp_issuer"])
            
        if "gemini_api_key" in data:
            cfg.gemini_api_key = str(data["gemini_api_key"])
        if "groq_api_key" in data:
            cfg.groq_api_key = str(data["groq_api_key"])
            
        course_db_updated = False
        if "course_db_engine" in data:
            cfg.course_db_engine = str(data["course_db_engine"]).strip().lower()
            course_db_updated = True

        if "course_sqlite_db_paths_json" in data:
            try:
                cfg.course_sqlite_db_paths = _parse_sqlite_db_paths(str(data["course_sqlite_db_paths_json"]))
                course_db_updated = True
            except Exception:
                pass
        if "highlights_enabled" in data:
            raw = str(data["highlights_enabled"]).strip().lower()
            cfg.highlights_enabled = raw in ("1", "true", "yes", "on")

        if course_db_updated:
            try:
                auth_service.db_manager.reload_course_backend()
            except Exception as e:
                return jsonify({"error": str(e)}), 400

        return jsonify({"success": True})
