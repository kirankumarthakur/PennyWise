"""REST API routes for financial analytics."""

import logging
from flask import Blueprint, jsonify, current_app

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api")


@analytics_bp.route("/analytics", methods=["GET"])
def get_analytics():
    """Retrieve category-wise and monthly expense analytics."""
    expense_service = current_app.extensions["expense_service"]
    try:
        analytics_data = expense_service.get_analytics()
        return jsonify(analytics_data)
    except Exception as e:
        logger.error("Error generating analytics: %s", e, exc_info=True)
        return jsonify({"error": str(e), "success": False}), 500
