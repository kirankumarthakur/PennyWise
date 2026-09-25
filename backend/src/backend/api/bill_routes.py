"""REST API routes for bill processing and expense categorization."""

import logging
from flask import Blueprint, request, jsonify, current_app

logger = logging.getLogger(__name__)

bill_bp = Blueprint("bill", __name__, url_prefix="/api")


@bill_bp.route("/process-bill", methods=["POST"])
def process_bill():
    """Upload and process a bill image or PDF."""
    bill_processor = current_app.extensions["bill_processor"]
    ai_service = current_app.extensions.get("ai_service")

    try:
        # 1. PDF file stream
        if "pdf" in request.files:
            file = request.files["pdf"]
            if not file.filename:
                return jsonify({"error": "No PDF file selected"}), 400

            pdf_bytes = file.stream.read()
            result = bill_processor.process_pdf(pdf_bytes, filename=file.filename)
            if ai_service and ai_service._get_client() and result.text:
                ai_parsed = ai_service.parse_unstructured_expense(result.text)
                if ai_parsed.get("vendor"):
                    result.vendor = ai_parsed["vendor"]
                    result.amount = float(ai_parsed.get("amount") or result.amount)
                    result.category = ai_parsed.get("category") or result.category
                    result.tags = ai_parsed.get("tags") or result.tags
            return jsonify(result.to_dict())

        if "image" in request.files:
            file = request.files["image"]
            if not file.filename:
                return jsonify({"error": "No image file selected"}), 400

            image_bytes = file.stream.read()
            if ai_service and ai_service._get_client():
                receipt_url = bill_processor.receipt_storage.save_receipt_image(image_bytes, file.filename)
                ai_result = ai_service.analyze_receipt(image_bytes, file.content_type or "image/jpeg")
                if ai_result:
                    ai_result.receipt_url = receipt_url
                    return jsonify(ai_result.to_dict())

            result = bill_processor.process_image(image_bytes, filename=file.filename)
            return jsonify(result.to_dict())

        data = request.get_json(silent=True)
        if data and "image_data" in data:
            image_data = data["image_data"]
            result = bill_processor.process_image(image_data, filename="uploaded_image")
            return jsonify(result.to_dict())

        return jsonify({"error": "No image or PDF file provided"}), 400

    except Exception as e:
        logger.error("Failed to process bill: %s", e, exc_info=True)
        return jsonify({"error": str(e), "success": False}), 500


@bill_bp.route("/categorize-expense", methods=["POST"])
def categorize_expense():
    """Categorize an expense description and amount."""
    categorizer = current_app.extensions["categorization_service"]

    try:
        data = request.get_json(silent=True) or {}
        description = data.get("description", "")
        amount = float(data.get("amount", 0.0))

        category = categorizer.categorize(description, amount)
        return jsonify({
            "category": category,
            "success": True
        })
    except Exception as e:
        logger.error("Error categorizing expense: %s", e)
        return jsonify({"error": str(e), "success": False}), 500


@bill_bp.route("/receipts/<path:filename>", methods=["GET"])
def get_receipt(filename: str):
    """Serve a stored compressed receipt document or image."""
    from flask import send_from_directory
    from backend.config import AppConfig

    return send_from_directory(AppConfig.RECEIPTS_DIR, filename)
