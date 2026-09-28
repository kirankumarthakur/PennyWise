"""REST API routes for financial analytics."""

import logging
from flask import Blueprint, jsonify, request, current_app
from backend.services.expense_service import ExpenseService

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api")


@analytics_bp.route("/analytics", methods=["GET"])
def get_analytics():
    """Retrieve category-wise and monthly expense analytics for the visitor's session."""
    session_id = request.headers.get("X-Session-ID", "demo").strip()[:64]
    session_store = current_app.extensions["session_store"]
    session = session_store.get_or_create(session_id)
    expense_service = ExpenseService(session["repo"])
    try:
        analytics_data = expense_service.get_analytics()
        return jsonify(analytics_data)
    except Exception as e:
        logger.error("Error generating analytics: %s", e, exc_info=True)
        return jsonify({"error": str(e), "success": False}), 500
