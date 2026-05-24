from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import requests
from flask import Blueprint, abort, current_app, jsonify, request

from backend.auth_service import AuthService

log = logging.getLogger(__name__)


def _clean_text(value: Any, *, max_len: int) -> str:
    text = str(value or "").strip()
    return text[:max_len]


def _normalize_history(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    out: list[dict[str, str]] = []
    for row in value[:24]:
        if not isinstance(row, dict):
            continue
        role = "user" if row.get("role") == "user" else "model"
        content = _clean_text(row.get("content", ""), max_len=4000)
        if content:
            out.append({"role": role, "content": content})
    return out


def _clamp_temperature(raw_value: Any) -> float:
    try:
        temperature = float(raw_value)
    except (TypeError, ValueError):
        temperature = 0.2
    return max(0.0, min(1.5, temperature))


@dataclass
class _WindowLimiter:
    max_requests: int
    window_seconds: int
    _events: dict[str, deque[float]] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def allow(self, key: str, now_ts: float | None = None) -> tuple[bool, int]:
        now = now_ts if now_ts is not None else time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            q = self._events.setdefault(key, deque())
            while q and q[0] < cutoff:
                q.popleft()

            if len(q) >= self.max_requests:
                retry_after = max(1, int(q[0] + self.window_seconds - now))
                return False, retry_after

            q.append(now)
            return True, 0


_USER_LIMITER = _WindowLimiter(max_requests=40, window_seconds=300)
_IP_LIMITER = _WindowLimiter(max_requests=120, window_seconds=300)


def _enforce_rate_limit(*, user_id: int, ip: str | None) -> None:
    ok, retry_after = _USER_LIMITER.allow(f"user:{user_id}")
    if not ok:
        abort(429, description=f"AI rate limit exceeded. Try again in {retry_after} second(s).")

    if ip:
        ok, retry_after = _IP_LIMITER.allow(f"ip:{ip}")
        if not ok:
            abort(429, description=f"AI rate limit exceeded. Try again in {retry_after} second(s).")


def _call_gemini(data: dict[str, Any], config) -> tuple[dict[str, Any], int]:
    api_key = config.gemini_api_key
    if not api_key:
        return {"error": "Gemini API key is missing"}, 400

    system_prompt = _clean_text(data.get("systemPrompt", ""), max_len=12000)
    user_prompt = _clean_text(data.get("userPrompt", ""), max_len=8000)
    history = _normalize_history(data.get("history", []))
    model = _clean_text(data.get("model", "gemini-2.5-flash"), max_len=120)
    temperature = _clamp_temperature(data.get("temperature", 0.2))

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents = [
        {
            "role": "user" if msg["role"] == "user" else "model",
            "parts": [{"text": msg["content"]}],
        }
        for msg in history
    ]
    contents.append({"role": "user", "parts": [{"text": user_prompt}]})

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature},
    }
    if system_prompt:
        payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        resp_data = response.json()
        candidates = resp_data.get("candidates", [])
        if not candidates:
            return {"error": "No candidates returned from API"}, 502

        content_parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(str(part.get("text", "")) for part in content_parts)
        return {"result": text}, 200
    except requests.exceptions.RequestException as exc:
        log.error("Error calling Gemini API: %s", exc)
        try:
            details = response.json() if "response" in locals() else {}
            return {"error": f"Gemini API request failed", "details": details}, 502
        except Exception:
            return {"error": "Failed to call Gemini API"}, 502


def _call_groq(data: dict[str, Any], config) -> tuple[dict[str, Any], int]:
    api_key = config.groq_api_key
    if not api_key:
        return {"error": "Groq API key is missing"}, 400

    system_prompt = _clean_text(data.get("systemPrompt", ""), max_len=12000)
    user_prompt = _clean_text(data.get("userPrompt", ""), max_len=8000)
    history = _normalize_history(data.get("history", []))
    model = _clean_text(data.get("model", "llama-3.3-70b-versatile"), max_len=120)
    temperature = _clamp_temperature(data.get("temperature", 0.2))

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    for msg in history:
        messages.append(
            {
                "role": "user" if msg["role"] == "user" else "assistant",
                "content": msg["content"],
            }
        )
    messages.append({"role": "user", "content": user_prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            timeout=30,
        )
        response.raise_for_status()
        resp_data = response.json()
        choices = resp_data.get("choices", [])
        if not choices:
            return {"error": "No choices returned from API"}, 502

        text = str(choices[0].get("message", {}).get("content", ""))
        return {"result": text}, 200
    except requests.exceptions.RequestException as exc:
        log.error("Error calling Groq API: %s", exc)
        try:
            details = response.json() if "response" in locals() else {}
            return {"error": "Groq API request failed", "details": details}, 502
        except Exception:
            return {"error": "Failed to call Groq API"}, 502


def create_ai_blueprint(auth_service: AuthService) -> Blueprint:
    bp = Blueprint("ai", __name__, url_prefix="/api/ai")

    @bp.route("/generate", methods=["POST"])
    def generate_content():
        user, _ = auth_service.resolve_user(require_full=True)
        if not user:
            abort(401, description="Authentication required")

        _enforce_rate_limit(user_id=int(user["id"]), ip=auth_service.get_client_ip())

        data = request.get_json(force=True, silent=True) or {}
        if not isinstance(data, dict):
            abort(400, description="Invalid JSON")

        if not _clean_text(data.get("userPrompt", ""), max_len=8000):
            abort(400, description="userPrompt is required")

        config = current_app.extensions["app_config"]
        provider = _clean_text(data.get("provider", "gemini"), max_len=32).lower()

        if provider == "groq":
            payload, status = _call_groq(data, config)
        elif provider == "gemini":
            payload, status = _call_gemini(data, config)
        else:
            payload, status = {"error": f"Unsupported provider: {provider}"}, 400

        return jsonify(payload), status

    return bp
