"""System health and diagnostic routes."""

from flask import Blueprint, jsonify, current_app

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Verify application health and ML status."""
    categorizer = current_app.extensions["categorization_service"]
    expense_service = current_app.extensions["expense_service"]

    return jsonify({
        "status": "healthy",
        "model_loaded": categorizer.is_model_loaded(),
        "expenses_count": expense_service.count(),
    })
