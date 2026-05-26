from __future__ import annotations

import base64
import io
import logging
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import requests
from flask import Blueprint, current_app, jsonify, request

log = logging.getLogger(__name__)

JUDGE0_PROVIDER_DEFAULT = "ce"
JUDGE0_CE_EXECUTE_URL = "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true"
JUDGE0_CE_LANGUAGES_URL = "https://ce.judge0.com/languages"
JUDGE0_LANGUAGES_CACHE_TTL_SECONDS = 10 * 60
RAPIDAPI_POLL_MAX_ATTEMPTS = 15
RAPIDAPI_POLL_INTERVAL_SECONDS = 0.65
REQUEST_TIMEOUT_SECONDS = 30

_languages_cache_by_provider: dict[str, dict[str, Any]] = {}
_languages_cache_lock = threading.Lock()


def _parse_provider(value: Any) -> str:
    return "rapidapi" if value == "rapidapi" else JUDGE0_PROVIDER_DEFAULT


def _json_or_dict(response: requests.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _as_language_list(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        return []
    out: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        lang_id = item.get("id")
        name = item.get("name")
        if isinstance(lang_id, int) and isinstance(name, str):
            out.append({"id": lang_id, "name": name})
    return out


def _get_rapidapi_headers(config) -> dict[str, str]:
    if not config.judge0_rapidapi_key:
        raise ValueError("RapidAPI provider is not configured. Set JUDGE0_RAPIDAPI_KEY.")
    return {
        "Content-Type": "application/json",
        "x-rapidapi-host": config.judge0_rapidapi_host,
        "x-rapidapi-key": config.judge0_rapidapi_key,
    }


def _encode_additional_files(additional_files: Any) -> str | None:
    if not additional_files:
        return None
    if isinstance(additional_files, str):
        return additional_files
    if not isinstance(additional_files, dict):
        return None

    entries: list[tuple[str, str]] = []
    for file_name, content in additional_files.items():
        if not file_name or not isinstance(content, str):
            continue
        entries.append((str(file_name), content))

    if not entries:
        return None

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for file_name, content in entries:
            zip_file.writestr(file_name, content)
    return base64.b64encode(memory_file.getvalue()).decode("utf-8")


def _build_execution_body(submission: dict[str, Any]) -> dict[str, Any]:
    return {
        "language_id": submission.get("language_id"),
        "source_code": submission.get("source_code"),
        "stdin": submission.get("stdin") if isinstance(submission.get("stdin"), str) else "",
        "additional_files": _encode_additional_files(submission.get("additional_files")),
    }


def _execute_single_ce(submission: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    response = requests.post(
        JUDGE0_CE_EXECUTE_URL,
        json=_build_execution_body(submission),
        headers={"Content-Type": "application/json"},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    payload = _json_or_dict(response)
    if not response.ok:
        log.warning("[code-test] CE execution failed: status=%s payload_keys=%s", response.status_code, list(payload.keys()))
    return response.ok, payload


def _execute_single_rapidapi(submission: dict[str, Any], config) -> tuple[bool, dict[str, Any]]:
    headers = _get_rapidapi_headers(config)
    create_response = requests.post(
        f"{config.judge0_rapidapi_base_url}/submissions?base64_encoded=false",
        json=_build_execution_body(submission),
        headers=headers,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    create_payload = _json_or_dict(create_response)
    if not create_response.ok:
        log.warning(
            "[code-test] RapidAPI submission create failed: status=%s payload_keys=%s",
            create_response.status_code,
            list(create_payload.keys()),
        )
        return False, create_payload

    token = create_payload.get("token")
    if not isinstance(token, str) or not token:
        log.warning("[code-test] RapidAPI submission create succeeded but token missing")
        return False, {
            "error": "RapidAPI Judge0 did not return a submission token.",
            "details": create_payload,
        }

    last_payload: dict[str, Any] = create_payload
    for attempt in range(RAPIDAPI_POLL_MAX_ATTEMPTS):
        result_response = requests.get(
            f"{config.judge0_rapidapi_base_url}/submissions/{requests.utils.quote(token, safe='')}?base64_encoded=false&fields=*",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        last_payload = _json_or_dict(result_response)
        if not result_response.ok:
            log.warning(
                "[code-test] RapidAPI poll failed: token_prefix=%s status=%s payload_keys=%s",
                token[:8],
                result_response.status_code,
                list(last_payload.keys()),
            )
            return False, last_payload

        status = last_payload.get("status")
        status_id = status.get("id") if isinstance(status, dict) else None
        if isinstance(status_id, int) and status_id > 2:
            log.info(
                "[code-test] RapidAPI execution completed: token_prefix=%s status_id=%s attempts=%s",
                token[:8],
                status_id,
                attempt + 1,
            )
            return True, last_payload

        if attempt < RAPIDAPI_POLL_MAX_ATTEMPTS - 1:
            time.sleep(RAPIDAPI_POLL_INTERVAL_SECONDS)

    return False, {
        "error": "Timed out while waiting for Judge0 execution result from RapidAPI.",
        "details": last_payload,
    }


def _execute_single_with_provider(
    submission: dict[str, Any],
    provider: str,
    config,
) -> tuple[bool, dict[str, Any]]:
    if provider == "rapidapi":
        return _execute_single_rapidapi(submission, config)
    return _execute_single_ce(submission)


def _get_languages(provider: str, config) -> list[dict[str, Any]]:
    now = time.time()
    with _languages_cache_lock:
        cached = _languages_cache_by_provider.get(provider)
        if cached and (now - float(cached.get("cached_at_s", 0))) < JUDGE0_LANGUAGES_CACHE_TTL_SECONDS:
            languages = cached.get("languages")
            if isinstance(languages, list):
                log.info("[code-test] languages cache hit: provider=%s count=%s", provider, len(languages))
                return languages

    if provider == "rapidapi":
        response = requests.get(
            f"{config.judge0_rapidapi_base_url}/languages",
            headers=_get_rapidapi_headers(config),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    else:
        response = requests.get(
            JUDGE0_CE_LANGUAGES_URL,
            headers={"Content-Type": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    if not response.ok:
        log.warning("[code-test] languages fetch failed: provider=%s status=%s", provider, response.status_code)
        raise RuntimeError("Failed to load language metadata from Judge0.")

    languages = _as_language_list(response.json())
    log.info("[code-test] languages fetched: provider=%s count=%s", provider, len(languages))
    with _languages_cache_lock:
        _languages_cache_by_provider[provider] = {
            "languages": languages,
            "cached_at_s": now,
        }
    return languages


def _process_submission(
    submission: dict[str, Any],
    *,
    shared_additional_files: Any,
    provider: str,
    config,
) -> dict[str, Any]:
    language_id = submission.get("language_id")
    source_code = submission.get("source_code")
    if not isinstance(language_id, int) or language_id <= 0 or not isinstance(source_code, str) or not source_code:
        return {"error": "language_id and source_code are required for each submission"}

    submission_payload = dict(submission)
    if ("additional_files" not in submission_payload) or (submission_payload.get("additional_files") is None):
        submission_payload["additional_files"] = shared_additional_files

    try:
        ok, payload = _execute_single_with_provider(submission_payload, provider, config)
        if not ok:
            return {"error": "Compiler service request failed", "details": payload}
        return payload
    except Exception as exc:
        return {"error": "Failed to reach compiler service", "details": str(exc)}


def create_code_test_blueprint() -> Blueprint:
    bp = Blueprint("code_test_api", __name__, url_prefix="/api/code-test")

    @bp.route("/execute", methods=["GET"])
    def get_languages():
        provider = _parse_provider(request.args.get("provider"))
        log.info("[code-test] GET /api/code-test/execute provider=%s", provider)
        config = current_app.extensions["app_config"]
        try:
            languages = _get_languages(provider, config)
            return jsonify({"languages": languages}), 200
        except Exception as exc:
            log.exception("[code-test] GET /api/code-test/execute failed provider=%s", provider)
            return jsonify(
                {
                    "error": "Failed to fetch supported languages",
                    "details": str(exc),
                }
            ), 502

    @bp.route("/execute", methods=["POST"])
    def execute_batch():
        body = request.get_json(force=True, silent=True)
        if body is None:
            log.warning("[code-test] POST /api/code-test/execute invalid JSON body")
            return jsonify({"error": "Invalid JSON body"}), 400
        if not isinstance(body, dict):
            log.warning("[code-test] POST /api/code-test/execute non-object JSON body")
            return jsonify({"error": "Invalid JSON body"}), 400

        submissions = body.get("submissions")
        shared_additional_files = body.get("sharedAdditionalFiles")
        provider = _parse_provider(body.get("provider"))
        config = current_app.extensions["app_config"]
        has_shared_files = isinstance(shared_additional_files, dict) and bool(shared_additional_files)

        log.info(
            "[code-test] POST /api/code-test/execute provider=%s submissions=%s shared_files=%s",
            provider,
            len(submissions) if isinstance(submissions, list) else "invalid",
            has_shared_files,
        )

        if not isinstance(submissions, list):
            log.warning("[code-test] submissions is not an array")
            return jsonify({"error": "submissions array is required"}), 400
        if not submissions:
            log.warning("[code-test] submissions array is empty")
            return jsonify({"error": "submissions cannot be empty"}), 400

        sanitized: list[dict[str, Any]] = []
        for row in submissions:
            if isinstance(row, dict):
                sanitized.append(row)
            else:
                sanitized.append({})

        worker_count = max(1, min(8, len(sanitized)))
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            results = list(
                executor.map(
                    lambda submission: _process_submission(
                        submission,
                        shared_additional_files=shared_additional_files,
                        provider=provider,
                        config=config,
                    ),
                    sanitized,
                )
            )

        success_count = sum(1 for result in results if isinstance(result, dict) and "error" not in result)
        failure_count = len(results) - success_count
        log.info(
            "[code-test] execution finished provider=%s total=%s success=%s failed=%s",
            provider,
            len(results),
            success_count,
            failure_count,
        )

        return jsonify({"submissions": results}), 200

    return bp
