from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any

import jwt as pyjwt
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from flask import abort, request

from backend.config import AppConfig
from backend.db.manager import DBManager
from backend.db.sql_helpers import execute, fetch_all_dict, fetch_one_dict

log = logging.getLogger(__name__)
MAX_ACTIVE_SESSIONS_LIMIT = 20
MAX_IP_ADDRESSES_LIMIT = 20


_USER_JOIN = """
    SELECT u.id, u.email, u.name, u.username, u.avatar,
           r.name AS role, u.is_active,
           u.role_id, u.two_factor_enabled, u.theme, u.created_at,
           COALESCE(u.is_first_login, 0) AS is_first_login,
           s.password_hash, s.two_factor_secret, s.two_factor_confirmed,
           COALESCE(s.max_active_sessions, 1) AS max_active_sessions,
           COALESCE(s.max_ip_addresses, 2) AS max_ip_addresses,
           COALESCE(s.daily_token_issue_count, 0) AS daily_token_issue_count,
           s.daily_token_issue_date,
           s.current_token,
           COALESCE(s.failed_attempts, 0) AS failed_attempts, s.locked_until,
           s.temp_password_expires_at, s.onboarding_temp_password_hash
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN users_sensitive s ON s.user_id = u.id
"""


class AuthService:
    def __init__(self, config: AppConfig, db_manager: DBManager):
        self.config = config
        self.db_manager = db_manager

        self._rsa_private_key = None
        self._rsa_public_key = None
        self._rsa_public_pem = ""
        self._rsa_private_pem_export = ""

        self._init_rsa_keys()

    @property
    def invite_codes(self) -> set[str]:
        return self.config.invite_codes

    def _init_rsa_keys(self) -> None:
        if self.config.rsa_private_key:
            self._rsa_private_key = serialization.load_pem_private_key(
                self.config.rsa_private_key.encode(),
                password=None,
            )
            log.info("RSA private key loaded from RSA_PRIVATE_KEY env var")
        else:
            self._rsa_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            generated_pem = self._rsa_private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode().replace("\n", "\\n")
            log.warning(
                "RSA_PRIVATE_KEY not set; generated ephemeral key. Add this to server/.env:\n"
                "RSA_PRIVATE_KEY=%s",
                generated_pem,
            )

        self._rsa_public_key = self._rsa_private_key.public_key()
        self._rsa_public_pem = self._rsa_public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()
        self._rsa_private_pem_export = self._rsa_private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()

        pub_oneliner = self._rsa_public_pem.replace("\n", "\\n")
        priv_oneliner = self._rsa_private_pem_export.replace("\n", "\\n")

        print("\n" + "=" * 70)
        print("  RSA KEY PAIR; copy both lines into your .env files")
        print("=" * 70)
        print("  [server/.env]")
        print("  RSA_PRIVATE_KEY=" + priv_oneliner)
        print()
        print("  [client/.env.local]")
        print("  NEXT_PUBLIC_RSA_PUBLIC_KEY=" + pub_oneliner)
        print("=" * 70 + "\n")

    def decrypt_password(self, ciphertext_b64: str) -> str:
        if not ciphertext_b64:
            abort(400, description="Password field is required")

        try:
            ciphertext = base64.b64decode(ciphertext_b64)
            plaintext = self._rsa_private_key.decrypt(
                ciphertext,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return plaintext.decode("utf-8")
        except Exception:
            abort(400, description="Invalid or malformed password encryption")

    def make_full_token(self, user: dict[str, Any]) -> str:
        now = int(time.time())
        payload = {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "username": user.get("username"),
            "avatar": user.get("avatar"),
            "role": user.get("role", "user"),
            "theme": user.get("theme", "light"),
            "twoFactorEnabled": bool(user.get("two_factor_enabled")),
            "isFirstLogin": bool(user.get("is_first_login")),
            "createdAt": user.get("created_at"),
            "iat": now,
            "exp": now + self.config.jwt_expires_days * 86400,
        }
        return pyjwt.encode(payload, self.config.jwt_secret, algorithm="HS256")

    def make_partial_token(self, user_id: int) -> str:
        now = int(time.time())
        payload = {
            "id": user_id,
            "partial": True,
            "iat": now,
            "exp": now + 600,
        }
        return pyjwt.encode(payload, self.config.jwt_secret, algorithm="HS256")

    def decode_token(self, token: str) -> dict[str, Any] | None:
        try:
            return pyjwt.decode(token, self.config.jwt_secret, algorithms=["HS256"])
        except pyjwt.PyJWTError:
            return None

    @staticmethod
    def clamp_max_active_sessions(value: Any) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return 1
        if parsed < 1:
            return 1
        if parsed > MAX_ACTIVE_SESSIONS_LIMIT:
            return MAX_ACTIVE_SESSIONS_LIMIT
        return parsed

    @staticmethod
    def clamp_max_ip_addresses(value: Any) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return 2
        if parsed < 1:
            return 1
        if parsed > MAX_IP_ADDRESSES_LIMIT:
            return MAX_IP_ADDRESSES_LIMIT
        return parsed

    def get_client_fingerprint(self) -> str:
        """
        Generate a stable, unique hash representing the user's browser/device.
        """
        import hashlib
        # Check custom device fingerprint header first
        custom_fp = request.headers.get("X-Device-Fingerprint", "").strip()
        if custom_fp:
            try:
                ciphertext = base64.b64decode(custom_fp)
                plaintext = self._rsa_private_key.decrypt(
                    ciphertext,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None,
                    ),
                )
                decrypted_fp = plaintext.decode("utf-8")
                return hashlib.sha256(decrypted_fp.encode("utf-8")).hexdigest()
            except Exception as exc:
                log.warning("Failed to decrypt X-Device-Fingerprint header: %s", exc)
                # Fallback: if it's a short string, it's likely plaintext. Hash it directly.
                # An RSA-2048 ciphertext base64 string is 344 characters long.
                if len(custom_fp) < 128:
                    return hashlib.sha256(custom_fp.encode("utf-8")).hexdigest()
                # If it's long, it's likely an encrypted fingerprint that failed to decrypt.
                # Hashing the random OAEP ciphertext directly would change every request and cause
                # immediate session termination. Fall back to User-Agent for stability.
                ua = request.headers.get("User-Agent", "").strip()
                return hashlib.sha256(ua.encode("utf-8")).hexdigest()
        
        # Fallback to User-Agent
        ua = request.headers.get("User-Agent", "").strip()
        return hashlib.sha256(ua.encode("utf-8")).hexdigest()

    @staticmethod
    def parse_session_queue(raw: Any) -> list[dict[str, Any]]:
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
        if not isinstance(parsed, dict):
            return []
        tokens = parsed.get("tokens")
        if not isinstance(tokens, list):
            return []
        cleaned: list[dict[str, Any]] = []
        seen_tokens: set[str] = set()
        for item in tokens:
            if not isinstance(item, dict):
                continue
            token = str(item.get("token", "") or "").strip()
            if not token or token in seen_tokens:
                continue
            seen_tokens.add(token)
            cleaned.append(
                {
                    "token": token,
                    "issued_at": str(item.get("issued_at", "") or ""),
                    "ip": str(item.get("ip", "") or ""),
                    "ip_updates": 0,
                    "fingerprint": str(item.get("fingerprint", "") or "").strip(),
                }
            )
        return cleaned

    @staticmethod
    def serialize_session_queue(tokens: list[dict[str, Any]]) -> str:
        return json.dumps({"tokens": tokens}, separators=(",", ":"))

    def append_session_token(
        self,
        existing_raw: Any,
        *,
        token: str,
        max_active_sessions: Any,
        client_ip: str | None = None,
    ) -> str:
        queue = self.parse_session_queue(existing_raw)
        queue = [row for row in queue if row.get("token") != token]
        normalized_ip = str(client_ip or "").strip()
        fingerprint = self.get_client_fingerprint()

        queue.append(
            {
                "token": token,
                "issued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "ip": normalized_ip,
                "ip_updates": 0,
                "fingerprint": fingerprint,
            }
        )
        limit = self.clamp_max_active_sessions(max_active_sessions)
        queue = queue[-limit:]
        return self.serialize_session_queue(queue)

    def token_in_session_queue(self, token: str, queue_raw: Any) -> bool:
        if not token:
            return False
        queue = self.parse_session_queue(queue_raw)
        return any(row.get("token") == token for row in queue)

    @staticmethod
    def utc_day_key() -> str:
        return time.strftime("%Y-%m-%d", time.gmtime())

    def reserve_daily_token_issue(self, conn: Any, user: dict[str, Any]) -> tuple[bool, int, int, str]:
        """
        Reserve one full-token issuance for the current UTC day.
        Returns (allowed, next_count_or_current_count, limit, day_key).
        Admin users are always allowed and are not counted.
        """
        role = str(user.get("role", "user") or "user").strip().lower()
        day_key = self.utc_day_key()
        limit = self.clamp_max_active_sessions(user.get("max_active_sessions"))
        if role == "admin":
            return True, 0, limit, day_key

        raw_date = str(user.get("daily_token_issue_date", "") or "").strip()
        raw_count = user.get("daily_token_issue_count")
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            count = 0
        if count < 0:
            count = 0

        if raw_date != day_key:
            count = 0

        if count >= limit:
            return False, count, limit, day_key

        next_count = count + 1
        execute(
            conn,
            "UPDATE users_sensitive "
            "SET daily_token_issue_date = :day_key, daily_token_issue_count = :next_count "
            "WHERE user_id = :user_id",
            {"day_key": day_key, "next_count": next_count, "user_id": user["id"]},
        )
        user["daily_token_issue_date"] = day_key
        user["daily_token_issue_count"] = next_count
        return True, next_count, limit, day_key

    def refresh_session_token_ip(
        self,
        queue_raw: Any,
        *,
        token: str,
        client_ip: str | None,
        is_admin: bool,
        max_ip_addresses: Any,
    ) -> tuple[bool, str, bool, str | None]:
        """
        Return (found, serialized_queue, changed, block_reason).
        Validates token based on config security mode (off, ip_rollover, fingerprint).
        All users (including admins) are validated according to the configured mode.
        """
        queue = self.parse_session_queue(queue_raw)
        normalized_ip = str(client_ip or "").strip()
        touched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        current_fingerprint = self.get_client_fingerprint()
        
        found = False
        changed = False
        block_reason = None
        mode = self.config.security_token_sharing_mode

        for idx, row in enumerate(queue):
            if row.get("token") != token:
                continue
            found = True
            
            # Perform validation checks for all users (including admins) when enabled
            if mode != "off":
                if mode == "fingerprint":
                    bound_fingerprint = str(row.get("fingerprint", "") or "").strip()
                    if not bound_fingerprint:
                        row["fingerprint"] = current_fingerprint
                        changed = True
                    elif bound_fingerprint != current_fingerprint:
                        block_reason = "fingerprint_mismatch"
                        break
                elif mode == "ip_rollover":
                    existing_ip = str(row.get("ip", "") or "").strip()
                    if normalized_ip and existing_ip and existing_ip != normalized_ip:
                        current_updates = int(row.get("ip_updates") or 0)
                        max_allowed = self.clamp_max_ip_addresses(max_ip_addresses)
                        if current_updates >= max_allowed:
                            block_reason = "ip_limit_exceeded"
                            break
                        else:
                            row["ip_updates"] = current_updates + 1
                            row["ip"] = normalized_ip
                            changed = True
                    elif normalized_ip and not existing_ip:
                        row["ip"] = normalized_ip
                        row["ip_updates"] = 0
                        changed = True

            # If not blocked, update display fields and timestamp
            row["issued_at"] = touched_at
            changed = True

            if idx != len(queue) - 1:
                queue.pop(idx)
                queue.append(row)
            break

        return found, self.serialize_session_queue(queue), changed, block_reason

    @staticmethod
    def bearer_token() -> str | None:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:]
        return None

    def fetch_user_by_id(self, conn: Any, user_id: int) -> dict[str, Any] | None:
        return fetch_one_dict(conn, _USER_JOIN + "WHERE u.id = :user_id", {"user_id": user_id})

    def fetch_user_by_email(self, conn: Any, email: str) -> dict[str, Any] | None:
        return fetch_one_dict(
            conn,
            _USER_JOIN + "WHERE UPPER(u.email) = UPPER(:email)",
            {"email": email},
        )

    @staticmethod
    def get_client_ip() -> str | None:
        # Preferred headers when behind Cloudflare Worker + gateway.
        for header_name in ("X-Client-IP", "CF-Connecting-IP"):
            value = (request.headers.get(header_name) or "").strip()
            if value:
                return value

        # Fallback to first client entry in XFF chain.
        forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first

        # Last resort.
        real_ip = (request.headers.get("X-Real-IP") or "").strip()
        if real_ip:
            return real_ip
        return request.remote_addr

    def resolve_user(self, require_full: bool = True) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        token = self.bearer_token()
        if not token:
            return None, None

        payload = self.decode_token(token)
        if not payload:
            return None, None

        if require_full and payload.get("partial"):
            return None, payload

        conn = self.db_manager.get_auth_connection()
        try:
            user = self.fetch_user_by_id(conn, int(payload["id"]))
            if not user:
                return None, payload

            if not user.get("is_active", True):
                abort(403, description="Account is deactivated. Please contact an administrator.")

            if not payload.get("partial"):
                client_ip = self.get_client_ip()
                found, next_queue_raw, changed, block_reason = self.refresh_session_token_ip(
                    user.get("current_token"),
                    token=token,
                    client_ip=client_ip,
                    is_admin=(user.get("role", "user") == "admin"),
                    max_ip_addresses=user.get("max_ip_addresses"),
                )
                if not found:
                    abort(401, description="Session superseded by a newer login. Please sign in again.")
                if block_reason:
                    queue = self.parse_session_queue(user.get("current_token"))
                    next_queue = [row for row in queue if str(row.get("token", "") or "") != token]
                    execute(
                        conn,
                        "UPDATE users_sensitive SET current_token = :current_token WHERE user_id = :user_id",
                        {"current_token": self.serialize_session_queue(next_queue), "user_id": user["id"]},
                    )
                    conn.commit()
                    if block_reason == "fingerprint_mismatch":
                        abort(401, description="Device fingerprint mismatch. Please sign in again.")
                    else:
                        abort(401, description="Max IP change exceeded for this token. Please sign in again.")

                if changed:
                    execute(
                        conn,
                        "UPDATE users_sensitive SET current_token = :current_token WHERE user_id = :user_id",
                        {"current_token": next_queue_raw, "user_id": user["id"]},
                    )
                    conn.commit()
                    user["current_token"] = next_queue_raw

            return user, payload
        finally:
            conn.close()

    def get_compact_progress(self, conn: Any, user_id: int) -> dict[str, Any]:
        rows = fetch_all_dict(
            conn,
            """
            SELECT course_id, topic_index, completed, last_visited_course_at
            FROM user_progress
            WHERE user_id = :user_id
            ORDER BY last_visited_course_at DESC, course_id
            """,
            {"user_id": user_id},
        )

        course_order: list[int] = []
        seen_courses: set[int] = set()
        completed: dict[str, list[int]] = {}

        for row in rows:
            course_id = int(row["course_id"])
            if course_id not in seen_courses:
                seen_courses.add(course_id)
                course_order.append(course_id)

            if row.get("completed"):
                completed.setdefault(str(course_id), []).append(int(row["topic_index"]))

        return {"course_order": course_order, "completed": completed}

    def user_public(self, user: dict[str, Any], conn: Any | None = None) -> dict[str, Any]:
        data = {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "username": user.get("username"),
            "avatar": user.get("avatar"),
            "role": user.get("role", "user"),
            "theme": user.get("theme", "light"),
            "twoFactorEnabled": bool(user.get("two_factor_enabled")),
            "isFirstLogin": bool(user.get("is_first_login")),
            "createdAt": user.get("created_at"),
        }
        if conn is not None:
            data["progress"] = self.get_compact_progress(conn, int(user["id"]))
        return data
