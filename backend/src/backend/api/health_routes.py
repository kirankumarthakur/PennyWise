"""System health and diagnostic routes."""

from flask import Blueprint, jsonify, current_app

health_bp = Blueprint("health", __name__)


@health_bp.route("/", methods=["GET", "HEAD"])
def root():
    return jsonify({
        "status": "healthy",
        "service": "PennyWise API",
        "mode": "demo"
    })


@health_bp.route("/api/health", methods=["GET"])
def health_check():
    categorizer = current_app.extensions.get("categorization_service")
    session_store = current_app.extensions.get("session_store")

    return jsonify({
        "status": "healthy",
        "model_loaded": categorizer.is_model_loaded() if categorizer else False,
        "active_sessions": len(session_store.sessions) if session_store else 0,
    })
