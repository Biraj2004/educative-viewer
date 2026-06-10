import json
import os
from pathlib import Path
from flask import Blueprint, jsonify, request
from backend.auth_service import AuthService
from backend.config import (
    normalize_viewer_feature_flags,
    parse_role_feature_overrides,
)
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
        viewer_feature_flags = normalize_viewer_feature_flags(auth_service.config.viewer_feature_flags)
        viewer_feature_role_overrides = auth_service.config.viewer_feature_role_overrides or {}
        return jsonify({
            "jwt_secret": get_env_variable("JWT_SECRET"),
            "jwt_expires_days": get_env_variable("JWT_EXPIRES_DAYS", "7"),
            "invite_codes": get_env_variable("INVITE_CODES"),
            "totp_issuer": get_env_variable("TOTP_ISSUER", "EduViewer"),
            "gemini_api_key": get_env_variable("GEMINI_API_KEY"),
            "groq_api_key": get_env_variable("GROQ_API_KEY"),
            "judge0_rapidapi_key": get_env_variable("JUDGE0_RAPIDAPI_KEY"),
            "course_db_engine": get_env_variable("COURSE_DB_ENGINE", "sqlite"),
            "course_sqlite_db_paths_json": get_env_variable("COURSE_SQLITE_DB_PATHS_JSON", '[]'),
            "course_sqlite_db_folder": get_env_variable("COURSE_SQLITE_DB_FOLDER", ""),
            "viewer_feature_flags_json": json.dumps(viewer_feature_flags, separators=(",", ":")),
            "viewer_feature_role_overrides_json": json.dumps(
                viewer_feature_role_overrides, separators=(",", ":")
            ),
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
            "judge0_rapidapi_key": "JUDGE0_RAPIDAPI_KEY",
            "course_db_engine": "COURSE_DB_ENGINE",
            "course_sqlite_db_paths_json": "COURSE_SQLITE_DB_PATHS_JSON",
            "course_sqlite_db_folder": "COURSE_SQLITE_DB_FOLDER",
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
        if "judge0_rapidapi_key" in data:
            cfg.judge0_rapidapi_key = str(data["judge0_rapidapi_key"])
            
        course_db_updated = False
        if "course_db_engine" in data:
            cfg.course_db_engine = str(data["course_db_engine"]).strip().lower()
            course_db_updated = True

        if "course_sqlite_db_paths_json" in data or "course_sqlite_db_folder" in data:
            try:
                raw_paths = str(data.get("course_sqlite_db_paths_json", get_env_variable("COURSE_SQLITE_DB_PATHS_JSON", '[]')))
                course_db_paths = list(_parse_sqlite_db_paths(raw_paths))
                
                db_folder = str(data.get("course_sqlite_db_folder", get_env_variable("COURSE_SQLITE_DB_FOLDER", ""))).strip()
                if db_folder:
                    from backend.config import _scan_folder_for_dbs
                    scanned_dbs = _scan_folder_for_dbs(db_folder)
                    for db in scanned_dbs:
                        if db not in course_db_paths:
                            course_db_paths.append(db)

                cfg.course_sqlite_db_paths = tuple(course_db_paths)
                course_db_updated = True
            except Exception as exc:
                return jsonify({"error": f"Invalid course sqlite paths config: {exc}"}), 400
        viewer_flags_updated = False
        if "viewer_feature_flags_json" in data:
            try:
                parsed = json.loads(str(data["viewer_feature_flags_json"]))
                cfg.viewer_feature_flags = normalize_viewer_feature_flags(parsed)
                viewer_flags_updated = True
            except Exception as exc:
                return jsonify({"error": f"Invalid viewer_feature_flags_json: {exc}"}), 400

        if "viewer_feature_role_overrides_json" in data:
            try:
                parsed = json.loads(str(data["viewer_feature_role_overrides_json"]))
                cfg.viewer_feature_role_overrides = parse_role_feature_overrides(parsed)
                viewer_flags_updated = True
            except Exception as exc:
                return jsonify({"error": f"Invalid viewer_feature_role_overrides_json: {exc}"}), 400

        # Legacy compatibility: only accept highlights_enabled when the JSON
        # feature map is not part of the same payload.
        if "highlights_enabled" in data and "viewer_feature_flags_json" not in data:
            raw = str(data["highlights_enabled"]).strip().lower()
            next_highlights = raw in ("1", "true", "yes", "on")
            current_flags = normalize_viewer_feature_flags(cfg.viewer_feature_flags)
            current_flags["highlights_enabled"] = next_highlights
            cfg.viewer_feature_flags = current_flags
            viewer_flags_updated = True

        if viewer_flags_updated:
            cfg.highlights_enabled = bool(cfg.viewer_feature_flags.get("highlights_enabled", True))

            # Keep the legacy env var in sync for deployments still reading only this key.
            set_env_variable("HIGHLIGHTS_ENABLED", "1" if cfg.highlights_enabled else "0")

            # Ensure normalized JSON is persisted back to env.
            set_env_variable(
                "VIEWER_FEATURE_FLAGS_JSON",
                json.dumps(normalize_viewer_feature_flags(cfg.viewer_feature_flags), separators=(",", ":")),
            )
            set_env_variable(
                "VIEWER_FEATURE_ROLE_OVERRIDES_JSON",
                json.dumps(cfg.viewer_feature_role_overrides or {}, separators=(",", ":")),
            )

        if course_db_updated:
            try:
                auth_service.db_manager.reload_course_backend()
                from backend.routes.courses import clear_metadata_cache, TRIGGER_ASYNC_METADATA_WARMUP
                clear_metadata_cache()
                if TRIGGER_ASYNC_METADATA_WARMUP:
                    TRIGGER_ASYNC_METADATA_WARMUP()
            except Exception as e:
                return jsonify({"error": str(e)}), 400

        return jsonify({"success": True})
