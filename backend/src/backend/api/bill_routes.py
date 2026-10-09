import io
import uuid
import logging
from PIL import Image
from flask import Blueprint, request, jsonify, current_app, Response
from backend.config import AppConfig

logger = logging.getLogger(__name__)

bill_bp = Blueprint("bill", __name__, url_prefix="/api")

MAX_PDF_PAGES = 5
MAX_IMAGE_DIMENSION = 4000


def _validate_magic_bytes(header: bytes, ext: str) -> bool:
    if ext == "pdf":
        return header.startswith(b"%PDF")
    if ext in ("jpg", "jpeg"):
        return header.startswith(b"\xff\xd8\xff")
    if ext == "png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == "webp":
        return len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP"
    return False


def _check_pdf_page_count(pdf_bytes: bytes) -> bool:
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        count = doc.page_count
        doc.close()
        return count <= MAX_PDF_PAGES
    except Exception:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            return len(reader.pages) <= MAX_PDF_PAGES
        except Exception:
            return True


def _check_image_dimensions(image_bytes: bytes) -> bool:
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            return img.width <= MAX_IMAGE_DIMENSION and img.height <= MAX_IMAGE_DIMENSION
    except Exception:
        return False


@bill_bp.route("/process-bill", methods=["POST"])
def process_bill():
    bill_processor = current_app.extensions["bill_processor"]
    ai_service = current_app.extensions.get("ai_service")
    session_store = current_app.extensions.get("session_store")

    session_id = request.headers.get("X-Session-ID", "demo").strip()[:64]
    api_key = request.headers.get("X-AI-Key", "").strip()
    provider = request.headers.get("X-AI-Provider", "gemini").lower().strip()
    model = request.headers.get("X-AI-Model")

    try:
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

            if not _check_pdf_page_count(pdf_bytes):
                return jsonify({"error": f"PDF exceeds {MAX_PDF_PAGES}-page demo limit.", "success": False}), 400

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

            if not _check_image_dimensions(image_bytes):
                return jsonify({"error": f"Image exceeds {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION} dimension limit.", "success": False}), 400

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
        logger.error("Failed to process bill: %s", type(e).__name__)
        return jsonify({"error": "Bill processing failed", "success": False}), 500


@bill_bp.route("/categorize-expense", methods=["POST"])
def categorize_expense():
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
        logger.error("Error categorizing expense: %s", type(e).__name__)
        return jsonify({"error": "Categorization failed", "success": False}), 500


@bill_bp.route("/receipts/<path:filename>", methods=["GET"])
def get_receipt(filename: str):
    session_id = request.headers.get("X-Session-ID") or request.args.get("session_id")
    if not session_id and "_" in filename:
        session_id = filename.split("_", 1)[0]
    session_id = (session_id or "demo").strip()[:64]

    session_store = current_app.extensions.get("session_store")
    if not session_store:
        return jsonify({"error": "Receipt store unavailable", "success": False}), 500

    receipt_info = session_store.get_receipt(session_id, filename)
    if receipt_info:
        return Response(receipt_info["data"], mimetype=receipt_info["mime_type"])

    return jsonify({"error": "Receipt not found or session expired", "success": False}), 404
