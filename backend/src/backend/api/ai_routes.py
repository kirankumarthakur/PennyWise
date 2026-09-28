"""AI API routes for smart parsing, suggestions, insights, and copilot chat with ephemeral credentials."""

import logging
from flask import Blueprint, jsonify, request, current_app

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


def _get_request_ai_params():
    payload = request.get_json(silent=True) or {}
    api_key = (
        request.headers.get("X-AI-Key")
        or payload.get("api_key", "")
    ).strip()
    provider = (
        request.headers.get("X-AI-Provider")
        or payload.get("provider", "gemini")
    ).lower().strip()
    model = (
        request.headers.get("X-AI-Model")
        or payload.get("model")
    )
    session_id = request.headers.get("X-Session-ID", "demo").strip()[:64]
    return api_key, provider, model, session_id, payload


@ai_bp.route("/parse-text", methods=["POST"])
def parse_text():
    api_key, provider, model, session_id, payload = _get_request_ai_params()
    text = payload.get("text", "").strip()
    if not text:
        return jsonify({"success": False, "error": "No text provided"}), 400

    ai_service = current_app.extensions["ai_service"]
    expense_data = ai_service.parse_unstructured_expense(
        text, api_key=api_key, provider=provider, model=model
    )
    return jsonify({"success": True, "expense": expense_data})


@ai_bp.route("/suggest", methods=["POST"])
def suggest_fields():
    api_key, provider, model, session_id, payload = _get_request_ai_params()
    vendor = payload.get("vendor", "").strip()[:100]
    try:
        amount = float(payload.get("amount", 0.0) or 0.0)
    except (ValueError, TypeError):
        amount = 0.0
    notes = payload.get("notes", "").strip()[:200]

    ai_service = current_app.extensions["ai_service"]
    suggestion = ai_service.suggest_category_and_tags(
        vendor=vendor, amount=amount, notes=notes, api_key=api_key, provider=provider, model=model
    )
    return jsonify({"success": True, "suggestion": suggestion})


@ai_bp.route("/insights", methods=["GET"])
def get_insights():
    api_key = request.headers.get("X-AI-Key", "").strip()
    provider = request.headers.get("X-AI-Provider", "gemini").lower().strip()
    model = request.headers.get("X-AI-Model")
    session_id = request.headers.get("X-Session-ID", "demo").strip()[:64]

    ai_service = current_app.extensions["ai_service"]
    insights = ai_service.get_bundled_insights(
        session_id=session_id, api_key=api_key, provider=provider, model=model
    )
    return jsonify({"success": True, "insights": insights})


@ai_bp.route("/chat", methods=["POST"])
def chat_copilot():
    api_key, provider, model, session_id, payload = _get_request_ai_params()
    message = payload.get("message", "").strip()[:1000]
    history = payload.get("history", [])

    if not message:
        return jsonify({"success": False, "error": "Message cannot be empty"}), 400

    ai_service = current_app.extensions["ai_service"]
    reply = ai_service.chat_copilot(
        history=history,
        message=message,
        session_id=session_id,
        api_key=api_key,
        provider=provider,
        model=model,
    )
    return jsonify({"success": True, "reply": reply})
