from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask

# Flask converters -> regex fragments
_CONVERTER_PATTERNS: dict[str, str] = {
    "default": "[^/]+",
    "string": "[^/]+",
    "int": "[0-9]+",
    "float": "[0-9]+(?:\\.[0-9]+)?",
    "uuid": "[0-9a-fA-F-]+",
    "path": ".+",
}

_DYNAMIC_SEGMENT_RE = re.compile(r"<(?:(?P<converter>[a-zA-Z_][a-zA-Z0-9_]*)\:)?(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)>")


def _rule_to_regex(rule: str) -> str:
    escaped = re.escape(rule)

    dynamic_matches = list(_DYNAMIC_SEGMENT_RE.finditer(rule))
    if not dynamic_matches:
        return f"^{escaped}/?$"

    converted = escaped
    for dyn in dynamic_matches:
        converter = dyn.group("converter") or "default"
        pattern = _CONVERTER_PATTERNS.get(converter, _CONVERTER_PATTERNS["default"])
        converted = converted.replace(re.escape(dyn.group(0)), pattern, 1)

    return f"^{converted}/?$"


def build_backend_route_manifest(app: Flask) -> dict[str, Any]:
    backend_rules: set[str] = set()
    backend_regexes: set[str] = set()

    for rule in app.url_map.iter_rules():
        if not rule.rule.startswith("/api/"):
            continue
        if rule.endpoint == "static":
            continue

        methods = sorted(m for m in rule.methods if m not in {"HEAD", "OPTIONS"})
        if not methods:
            continue

        backend_rules.add(rule.rule)
        backend_regexes.add(_rule_to_regex(rule.rule))

    rules_sorted = sorted(backend_rules)
    regexes_sorted = sorted(backend_regexes)

    return {
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "backend_api_rules": rules_sorted,
        "backend_api_regexes": regexes_sorted,
        "count": len(regexes_sorted),
    }


def write_manifest_files(
    manifest: dict[str, Any],
    *,
    repo_root: Path,
) -> tuple[Path, Path]:
    proxy_dir = repo_root / "proxy"
    proxy_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = proxy_dir / "backend-route-manifest.json"
    nginx_map_path = proxy_dir / "backend-api-map.generated.conf"

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Auto-generated from Flask route registry.",
        "# Do not edit manually. Regenerate via server/generate_proxy_route_manifest.py",
    ]
    for regex in manifest.get("backend_api_regexes", []):
        lines.append(f"~{regex} 1;")
    nginx_map_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return manifest_path, nginx_map_path
