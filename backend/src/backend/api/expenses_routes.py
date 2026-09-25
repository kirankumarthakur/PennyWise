"""REST API routes for expense resource management."""

import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from backend.models.expense import ExpenseFilter

logger = logging.getLogger(__name__)

expenses_bp = Blueprint("expenses", __name__, url_prefix="/api")


@expenses_bp.route("/expenses", methods=["GET", "POST"])
def manage_expenses():
    """Handle retrieving filtered expenses or creating a new expense."""
    expense_service = current_app.extensions["expense_service"]

    if request.method == "POST":
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        expense, error = expense_service.create_expense(data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify({
            "success": True,
            "message": "Expense added successfully",
            "expense": expense.to_dict()
        }), 201

    # GET request
    filter_criteria = ExpenseFilter(
        start_date=request.args.get("start_date"),
        end_date=request.args.get("end_date"),
        category=request.args.get("category"),
        tag=request.args.get("tag"),
    )
    expenses = expense_service.list_expenses(filter_criteria)
    return jsonify({
        "success": True,
        "expenses": [e.to_dict() for e in expenses],
        "total": len(expenses)
    })


@expenses_bp.route("/tags", methods=["GET"])
def get_tags():
    """Retrieve all distinct tags across expenses."""
    expense_service = current_app.extensions["expense_service"]
    return jsonify({
        "success": True,
        "tags": expense_service.get_all_tags()
    })


@expenses_bp.route("/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id: int):
    """Delete an individual expense by ID."""
    expense_service = current_app.extensions["expense_service"]
    deleted = expense_service.delete_expense(expense_id)
    if not deleted:
        return jsonify({"error": f"Expense {expense_id} not found"}), 404

    return jsonify({
        "success": True,
        "message": "Expense deleted successfully"
    })


@expenses_bp.route("/expenses/clear", methods=["DELETE"])
def clear_all_expenses():
    """Clear all stored expenses."""
    expense_service = current_app.extensions["expense_service"]
    expense_service.clear_all()
    return jsonify({
        "success": True,
        "message": "All expenses cleared"
    })


@expenses_bp.route("/fix-dates", methods=["POST"])
def fix_expense_dates():
    """Normalize legacy dates to the current date."""
    expense_service = current_app.extensions["expense_service"]
    current_date = datetime.now().strftime("%Y-%m-%d")
    legacy_target = "2025-10-06"

    count = expense_service.fix_dates(legacy_target, current_date)
    return jsonify({
        "success": True,
        "message": f"Updated {count} expenses to current date ({current_date})",
        "updated_count": count,
        "current_date": current_date
    })
