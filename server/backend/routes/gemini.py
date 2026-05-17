from flask import Blueprint, request, jsonify, current_app
import requests
import logging

log = logging.getLogger(__name__)

gemini_bp = Blueprint("gemini", __name__)

@gemini_bp.route("/generate", methods=["POST"])
def generate_content():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    config = current_app.extensions["app_config"]
    api_key = config.gemini_api_key

    if not api_key:
        return jsonify({"error": "API key is missing"}), 400

    system_prompt = data.get("systemPrompt", "")
    user_prompt = data.get("userPrompt", "")
    history = data.get("history", [])
    selected_model = data.get("model", "gemini-1.5-flash")
    temperature = data.get("temperature", 0.2)

    actual_model = selected_model

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{actual_model}:generateContent?key={api_key}"

    # Build contents for Gemini API
    contents = []
    
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.get("content", "")}]
        })

    contents.append({
        "role": "user",
        "parts": [{"text": user_prompt}]
    })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature
        }
    }
    
    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}]
        }

    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        resp_data = response.json()
        
        candidates = resp_data.get("candidates", [])
        if not candidates:
            return jsonify({"error": "No candidates returned from API"}), 500
            
        content_parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in content_parts)
        
        return jsonify({"result": text})
    except requests.exceptions.RequestException as e:
        log.error(f"Error calling Gemini API: {e}")
        try:
            err_details = response.json()
            return jsonify({"error": f"API Error: {err_details}"}), 500
        except Exception:
            return jsonify({"error": "Failed to call Gemini API"}), 500
