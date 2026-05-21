import re
from flask import request

def process_content_json(content_json_str: str) -> str:
    """
    Checks if there is any /api/ url present in the json string and 
    attaches the current browser domain as a prefix.
    Useful for iframes which are not accessible and default to the iframe domain otherwise.
    """
    if not content_json_str:
        return content_json_str

    try:
        # Determine the current browser domain
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
        
        # Replace occurrences of "/api/..." within JSON strings
        return re.sub(r'"(/api/[^"]*)"', f'"{host_url}\\1"', content_json_str)
    except Exception:
        return content_json_str
