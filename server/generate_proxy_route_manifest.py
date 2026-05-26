from __future__ import annotations

from pathlib import Path

from flask import Flask

from backend.route_manifest import build_backend_route_manifest, write_manifest_files
from backend.routes.admin import create_admin_blueprint
from backend.routes.ai import create_ai_blueprint
from backend.routes.auth import create_auth_blueprint
from backend.routes.code_test import create_code_test_blueprint
from backend.routes.contact import create_contact_blueprint
from backend.routes.courses import create_courses_blueprint


def main() -> int:
    # Route generation only needs URL rules, not live DB/auth objects.
    auth_service_stub = object()
    db_manager_stub = object()

    app = Flask(__name__)
    app.register_blueprint(create_courses_blueprint(auth_service_stub, db_manager_stub))
    app.register_blueprint(create_auth_blueprint(auth_service_stub, db_manager_stub))
    app.register_blueprint(create_admin_blueprint(auth_service_stub, db_manager_stub))
    app.register_blueprint(create_contact_blueprint())
    app.register_blueprint(create_ai_blueprint(auth_service_stub))
    app.register_blueprint(create_code_test_blueprint())

    manifest = build_backend_route_manifest(app)

    repo_root = Path(__file__).resolve().parents[1]
    manifest_path, nginx_map_path = write_manifest_files(manifest, repo_root=repo_root)

    print(
        f"[manifest] Generated {manifest.get('count', 0)} backend API patterns\n"
        f"  - {manifest_path}\n"
        f"  - {nginx_map_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
