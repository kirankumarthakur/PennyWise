"""Application factory and entry point for PennyWise backend."""

import logging
from flask import Flask, jsonify
from flask_cors import CORS

from backend.config import AppConfig, configure_logging

from backend.extractors.ocr import TesseractOcrEngine
from backend.extractors.document_parser import DocumentParser
from backend.extractors.date_extractor import DateExtractor
from backend.extractors.amount_extractor import AmountExtractor
from backend.extractors.vendor_extractor import VendorExtractor
from backend.services.categorization_service import CategorizationService
from backend.services.bill_processing_service import BillProcessingService
from backend.services.ai_financial_service import AIFinancialService
from backend.api.expenses_routes import expenses_bp
from backend.api.bill_routes import bill_bp
from backend.api.analytics_routes import analytics_bp
from backend.api.health_routes import health_bp
from backend.api.settings_routes import settings_bp
from backend.api.ai_routes import ai_bp

logger = logging.getLogger(__name__)


def create_app(config: type[AppConfig] = AppConfig) -> Flask:
    """Create and configure the PennyWise Flask application."""
    configure_logging(config.LOG_LEVEL)

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH
    CORS(
        app,
        origins=config.CORS_ORIGINS,
        supports_credentials=True,
        allow_headers=["Content-Type", "X-Session-ID", "X-AI-Key", "X-AI-Provider", "X-AI-Model"],
    )

    from backend.repositories.in_memory_session_store import InMemorySessionStore

    session_store = InMemorySessionStore(
        max_sessions=config.MAX_SESSIONS,
        ttl_seconds=config.SESSION_TTL_SECONDS,
        max_expenses_per_session=config.MAX_EXPENSES_PER_SESSION,
        max_receipts_per_session=config.MAX_RECEIPTS_PER_SESSION,
    )
    ai_service = AIFinancialService(session_store=session_store)

    ocr_engine = TesseractOcrEngine()
    document_parser = DocumentParser(ocr_engine)
    date_extractor = DateExtractor()
    amount_extractor = AmountExtractor()
    vendor_extractor = VendorExtractor()
    categorization_service = CategorizationService(
        model_path=config.EXPENSE_MODEL_PATH,
        tfidf_path=config.TFIDF_VECTORIZER_PATH,
        scaler_path=config.FEATURE_SCALER_PATH,
        info_path=config.MODEL_INFO_PATH,
    )

    bill_processor = BillProcessingService(
        ocr_engine=ocr_engine,
        document_parser=document_parser,
        date_extractor=date_extractor,
        amount_extractor=amount_extractor,
        vendor_extractor=vendor_extractor,
        categorization_service=categorization_service,
    )

    app.extensions["session_store"] = session_store
    app.extensions["ai_service"] = ai_service
    app.extensions["categorization_service"] = categorization_service
    app.extensions["bill_processor"] = bill_processor

    app.register_blueprint(expenses_bp)
    app.register_blueprint(bill_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(ai_bp)

    @app.errorhandler(413)
    def handle_payload_too_large(error):
        return jsonify({"error": "Upload exceeds 10 MB limit.", "success": False}), 413

    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({"error": "Resource not found", "success": False}), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        logger.error("Internal Server Error: %s", error, exc_info=True)
        return jsonify({"error": "Internal server error", "success": False}), 500

    logger.info("Initialized PennyWise Live Demo backend with ephemeral in-memory session isolation.")
    return app


# Module-level instance for WSGI compatibility
app = create_app()


def main() -> None:
    """CLI application runner."""
    logger.info("Starting PennyWise Backend on http://%s:%d", AppConfig.HOST, AppConfig.PORT)
    app.run(host=AppConfig.HOST, port=AppConfig.PORT, debug=AppConfig.DEBUG)


if __name__ == "__main__":
    main()