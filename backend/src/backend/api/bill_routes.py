"""REST API routes for bill processing and expense categorization."""

import io
import uuid
import logging
from flask import Blueprint, request, jsonify, current_app, Response
from backend.config import AppConfig

logger = logging.getLogger(__name__)

bill_bp = Blueprint("bill", __name__, url_prefix="/api")


def _validate_magic_bytes(header: bytes, ext: str) -> bool:
    """Validate file content against magic signatures."""
    if ext == "pdf":
        return header.startswith(b"%PDF")
    if ext in ("jpg", "jpeg"):
        return header.startswith(b"\xff\xd8\xff")
    if ext == "png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == "webp":
        return len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP"
    return False


@bill_bp.route("/process-bill", methods=["POST"])
def process_bill():
    """Upload and process a bill image or PDF with ephemeral in-memory storage."""
    bill_processor = current_app.extensions["bill_processor"]
    ai_service = current_app.extensions.get("ai_service")
    session_store = current_app.extensions.get("session_store")

    session_id = request.headers.get("X-Session-ID", "demo").strip()[:64]
    api_key = request.headers.get("X-AI-Key", "").strip()
    provider = request.headers.get("X-AI-Provider", "gemini").lower().strip()
    model = request.headers.get("X-AI-Model")

    try:
        # 1. PDF file stream
        if "pdf" in request.files:
            file = request.files["pdf"]
            if not file.filename:
                return jsonify({"error": "No PDF file selected", "success": False}), 400

            ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
            if ext not in AppConfig.ALLOWED_EXTENSIONS:
                return jsonify({"error": f"Unsupported file type .{ext}", "success": False}), 400

            pdf_bytes = file.stream.read()
            if not _validate_magic_bytes(pdf_bytes[:16], ext):
                return jsonify({"error": "Corrupted or invalid PDF file format", "success": False}), 400

            filename = f"{session_id}_{uuid.uuid4().hex[:12]}.pdf"
            if session_store:
                session_store.save_receipt(session_id, filename, pdf_bytes, "application/pdf")
            receipt_url = f"/api/receipts/{filename}"

            result = bill_processor.process_pdf(io.BytesIO(pdf_bytes), filename=file.filename)
            result.receipt_url = receipt_url

            if ai_service and api_key and result.text:
                ai_parsed = ai_service.parse_unstructured_expense(
                    result.text, api_key=api_key, provider=provider, model=model
                )
                if ai_parsed.get("vendor"):
                    result.vendor = ai_parsed["vendor"]
                    result.amount = float(ai_parsed.get("amount") or result.amount)
                    result.category = ai_parsed.get("category") or result.category
                    result.tags = ai_parsed.get("tags") or result.tags

            return jsonify(result.to_dict())

        # 2. Image file stream
        if "image" in request.files:
            file = request.files["image"]
            if not file.filename:
                return jsonify({"error": "No image file selected", "success": False}), 400

            ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
            if ext not in AppConfig.ALLOWED_EXTENSIONS:
                return jsonify({"error": f"Unsupported image extension .{ext}", "success": False}), 400

            image_bytes = file.stream.read()
            if not _validate_magic_bytes(image_bytes[:16], ext):
                return jsonify({"error": "Invalid or corrupted image format", "success": False}), 400

            mime_type = file.content_type or f"image/{ext}"
            filename = f"{session_id}_{uuid.uuid4().hex[:12]}.{ext}"
            if session_store:
                session_store.save_receipt(session_id, filename, image_bytes, mime_type)
            receipt_url = f"/api/receipts/{filename}"

            if ai_service and api_key:
                ai_result = ai_service.analyze_receipt(
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    api_key=api_key,
                    provider=provider,
                    model=model,
                )
                if ai_result:
                    ai_result.receipt_url = receipt_url
                    return jsonify(ai_result.to_dict())

            result = bill_processor.process_image(image_bytes, filename=file.filename)
            result.receipt_url = receipt_url
            return jsonify(result.to_dict())

        data = request.get_json(silent=True)
        if data and "image_data" in data:
            image_data = data["image_data"]
            result = bill_processor.process_image(image_data, filename="uploaded_image")
            return jsonify(result.to_dict())

        return jsonify({"error": "No image or PDF file provided", "success": False}), 400

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
    """Serve an in-memory stored receipt document or image."""
    session_store = current_app.extensions.get("session_store")
    bill_processor = current_app.extensions.get("bill_processor")

    session_id = request.headers.get("X-Session-ID") or request.args.get("session_id")
    if not session_id and "_" in filename:
        session_id = filename.split("_", 1)[0]
    session_id = (session_id or "demo").strip()[:64]

    receipt_info = None
    if session_store:
        receipt_info = session_store.get_receipt(session_id, filename)

    if not receipt_info and bill_processor and hasattr(bill_processor, "receipt_storage"):
        receipt_info = bill_processor.receipt_storage.get_receipt(filename)

    if receipt_info:
        return Response(receipt_info["data"], mimetype=receipt_info["mime_type"])

    return jsonify({"error": "Receipt not found or session expired", "success": False}), 404
