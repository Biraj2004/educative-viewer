from __future__ import annotations

import logging
import os
import requests
from flask import Blueprint, jsonify, request, abort

log = logging.getLogger(__name__)

def create_contact_blueprint() -> Blueprint:
    bp = Blueprint("contact_api", __name__, url_prefix="/api/contact")

    @bp.route("", methods=["POST"])
    def contact_submit():
        data = request.get_json(force=True, silent=True) or {}
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip()
        message = str(data.get("message", "")).strip()

        if not name or not email or not message:
            abort(400, description="Name, email, and message are required")

        # Telegram integration
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")   # Enter Bot Token
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")       # Enter Chat ID

        if not bot_token or not chat_id:
            log.warning("Telegram Bot Token or Chat ID not configured. Message not sent via Telegram.")
            # We still return 200 to the user to avoid leaking configuration issues, 
            # but log it internally. Or we could return a specific message.
            return jsonify({"ok": True, "message": "Message received (Telegram not configured)"}), 200

        text = (
            "📩 *New Contact Form Submission*\n\n"
            f"👤 *Name:* {name}\n"
            f"📧 *Email:* {email}\n\n"
            f"📝 *Message:*\n{message}"
        )

        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            res = requests.post(url, json=payload, timeout=10)
            res.raise_for_status()
            log.info(f"Contact message from {email} sent to Telegram.")
        except Exception as exc:
            log.error(f"Failed to send contact message to Telegram: {exc}")
            # Still returning success to avoid user frustration if backend fails telegram delivery
            return jsonify({"ok": True, "message": "Message received (Delivery issues)"}), 200

        return jsonify({"ok": True, "message": "Your message has been sent successfully!"}), 200

    return bp
