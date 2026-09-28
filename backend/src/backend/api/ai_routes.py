"""AI API routes for smart parsing, suggestions, insights, and copilot chat."""

import logging
from flask import Blueprint, jsonify, request, current_app

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


@ai_bp.route("/parse-text", methods=["POST"])
def parse_text():
    """Parse unstructured SMS, note, or raw bill text into a structured expense."""
    payload = request.get_json() or {}
    text = payload.get("text", "").strip()
    if not text:
        return jsonify({"success": False, "error": "No text provided"}), 400

    ai_service = current_app.extensions["ai_service"]
    expense_data = ai_service.parse_unstructured_expense(text)
    return jsonify({"success": True, "expense": expense_data})


@ai_bp.route("/suggest", methods=["POST"])
def suggest_fields():
    """Suggest appropriate category and tags based on vendor and amount."""
    payload = request.get_json() or {}
    vendor = payload.get("vendor", "").strip()
    amount = float(payload.get("amount", 0.0) or 0.0)
    notes = payload.get("notes", "").strip()

    ai_service = current_app.extensions["ai_service"]
    suggestion = ai_service.suggest_category_and_tags(vendor=vendor, amount=amount, notes=notes)
    return jsonify({"success": True, "suggestion": suggestion})


@ai_bp.route("/insights", methods=["GET"])
def get_insights():
    """Return bundled visual financial intelligence (velocity, anomalies, subscriptions, digest, tips)."""
    ai_service = current_app.extensions["ai_service"]
    insights = ai_service.get_bundled_insights()
    return jsonify({"success": True, "insights": insights})


@ai_bp.route("/chat", methods=["POST"])
def chat_copilot():
    """Engage in conversation with the PennyWise financial copilot."""
    payload = request.get_json() or {}
    message = payload.get("message", "").strip()
    history = payload.get("history", [])

    if not message:
        return jsonify({"success": False, "error": "Message cannot be empty"}), 400

    ai_service = current_app.extensions["ai_service"]
    reply = ai_service.chat_copilot(history=history, message=message)
    return jsonify({"success": True, "reply": reply})
