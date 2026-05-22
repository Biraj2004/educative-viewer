import re
from flask import request


def process_content_json(content_json_str: str) -> str:
    """
    Finds every /api/... URL inside the raw JSON string and ensures it is
    prefixed with the correct host derived from the current request.

    Handles all three forms that can appear in stored content:
      - Bare path:          /api/udata/...
      - Escaped-quote URL:  \"/api/udata/...\"   (HTML attr inside JSON)
      - Full URL (any host): https://anything.com/api/udata/...

    In every case any existing scheme+host before /api/ is stripped and
    replaced with the host_url of the server that served this request.
    """
    if not content_json_str:
        return content_json_str

    try:
        # Determine the correct host to prepend
        if request.headers.get("X-Forwarded-Host"):
            proto = request.headers.get("X-Forwarded-Proto", "http")
            host_url = f"{proto}://{request.headers.get('X-Forwarded-Host')}"
        elif request.headers.get("Origin"):
            host_url = request.headers.get("Origin").rstrip("/")
        elif request.headers.get("Referer"):
            from urllib.parse import urlparse
            parsed = urlparse(request.headers.get("Referer"))
            host_url = f"{parsed.scheme}://{parsed.netloc}"
        else:
            host_url = request.host_url.rstrip("/")

        # Match the URL token directly without relying on surrounding quote style.
        #
        # Pattern breakdown:
        #   (?:https?://[^\s"\\]*)?   – optionally match & discard any existing
        #                               scheme+host (stops at whitespace, " or \)
        #   (/api/[^\s"\\]*)          – capture the /api/... path
        #                               (stops at whitespace, " or \)
        #
        # This correctly handles:
        #   /api/foo                   → {host}/api/foo
        #   "/api/foo"                 → "{host}/api/foo"
        #   \"/api/foo\"               → \"{host}/api/foo\"
        #   https://old.host/api/foo   → {host}/api/foo
        #   \"https://old.host/api/foo\" → \"{host}/api/foo\"
        return re.sub(
            r'(?:https?://[^\s"\\]*)?(/api/[^\s"\\]*)',
            lambda m: f"{host_url}{m.group(1)}",
            content_json_str,
        )
    except Exception:
        return content_json_str
