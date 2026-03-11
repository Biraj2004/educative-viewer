"""
gen_service_token.py

Generate a short-lived service JWT for manual testing of the Flask data APIs
(/courses, /course-details, /topic-details) without running the Next.js client.

Usage
-----
    python gen_service_token.py              # reads CLIENT_SERVER_SECRET from .env
    python gen_service_token.py --ttl 300    # custom TTL in seconds (default: 60)
    python gen_service_token.py --secret my-secret  # override secret inline

Then use the printed token in curl / Postman / Httpie:
    curl -H "Authorization: Bearer <token>" http://localhost:5000/courses
"""

import argparse
import os
import time
from pathlib import Path

import jwt as pyjwt

# Load .env from the same directory if present
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                _v = _v.strip().strip("'\"")
                os.environ.setdefault(_k.strip(), _v)


def make_service_token(secret: str, ttl: int = 60) -> str:
    now = int(time.time())
    payload = {
        "role": "service",
        "iat": now,
        "exp": now + ttl,
    }
    return pyjwt.encode(payload, secret, algorithm="HS256")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a service JWT for the Flask API")
    parser.add_argument(
        "--secret",
        default=os.environ.get("CLIENT_SERVER_SECRET", "cs-internal-dev-secret-change-in-prod"),
        help="Signing secret (default: CLIENT_SERVER_SECRET from .env)",
    )
    parser.add_argument(
        "--ttl",
        type=int,
        default=60,
        help="Token lifetime in seconds (default: 60)",
    )
    args = parser.parse_args()

    token = make_service_token(args.secret, args.ttl)
    print(token)
    print()
    print(f"  TTL    : {args.ttl}s")
    print(f"  Expires: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + args.ttl))}")
    print()
    print("curl example:")
    print(f'  curl -H "Authorization: Bearer {token}" http://localhost:5000/courses')
