from flask import Blueprint, request, jsonify, current_app
import requests
import logging

log = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__)

def handle_gemini(data, config):
    api_key = config.gemini_api_key
    if not api_key:
        return jsonify({"error": "Gemini API key is missing"}), 400

    system_prompt = data.get("systemPrompt", "")
    user_prompt = data.get("userPrompt", "")
    history = data.get("history", [])
    model = data.get("model", "gemini-1.5-flash")
    temperature = data.get("temperature", 0.2)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

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

def handle_groq(data, config):
    api_key = config.groq_api_key
    if not api_key:
        return jsonify({"error": "Groq API key is missing"}), 400

    system_prompt = data.get("systemPrompt", "")
    user_prompt = data.get("userPrompt", "")
    history = data.get("history", [])
    model = data.get("model", "llama-3.3-70b-versatile")
    temperature = data.get("temperature", 0.2)

    url = "https://api.groq.com/openai/v1/chat/completions"

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
        
    for msg in history:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": user_prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }

    try:
        response = requests.post(
            url, 
            json=payload, 
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        )
        response.raise_for_status()
        resp_data = response.json()
        
        choices = resp_data.get("choices", [])
        if not choices:
            return jsonify({"error": "No choices returned from API"}), 500
            
        text = choices[0].get("message", {}).get("content", "")
        return jsonify({"result": text})
    except requests.exceptions.RequestException as e:
        log.error(f"Error calling Groq API: {e}")
        try:
            err_details = response.json()
            return jsonify({"error": f"API Error: {err_details}"}), 500
        except Exception:
            return jsonify({"error": "Failed to call Groq API"}), 500

@ai_bp.route("/generate", methods=["POST"])
def generate_content():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    config = current_app.extensions["app_config"]
    provider = data.get("provider", "gemini").lower()
    
    if provider == "groq":
        return handle_groq(data, config)
    elif provider == "gemini":
        return handle_gemini(data, config)
    else:
        return jsonify({"error": f"Unsupported provider: {provider}"}), 400
