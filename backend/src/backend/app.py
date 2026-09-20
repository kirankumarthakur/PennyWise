"""Application factory and entry point for PennyWise backend."""

import logging
from flask import Flask, jsonify
from flask_cors import CORS

from backend.config import AppConfig, configure_logging
from backend.repositories.sqlite import SqliteExpenseRepository
from backend.extractors.ocr import TesseractOcrEngine
from backend.extractors.document_parser import DocumentParser
from backend.extractors.date_extractor import DateExtractor
from backend.extractors.amount_extractor import AmountExtractor
from backend.extractors.vendor_extractor import VendorExtractor
from backend.services.categorization_service import CategorizationService
from backend.services.bill_processing_service import BillProcessingService
from backend.services.expense_service import ExpenseService
from backend.services.settings_service import SettingsService
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
    CORS(app)

    # Instantiate infrastructure and persistence layer (SQLite default)
    repo = SqliteExpenseRepository(db_path=config.SQLITE_DB_PATH)
    expense_service = ExpenseService(repo)
    settings_service = SettingsService(repo)
    ai_service = AIFinancialService(settings_service=settings_service, expense_repo=repo)

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

    # Register services on application extensions
    app.extensions["expense_repo"] = repo
    app.extensions["expense_service"] = expense_service
    app.extensions["settings_service"] = settings_service
    app.extensions["ai_service"] = ai_service
    app.extensions["categorization_service"] = categorization_service
    app.extensions["bill_processor"] = bill_processor

    # Register API blueprints
    app.register_blueprint(expenses_bp)
    app.register_blueprint(bill_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(ai_bp)

    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({"error": "Resource not found", "success": False}), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        logger.error("Internal Server Error: %s", error, exc_info=True)
        return jsonify({"error": "Internal server error", "success": False}), 500

    logger.info("Initialized PennyWise backend application with Multi-Provider AI.")
    return app


# Module-level instance for WSGI compatibility
app = create_app()


def main() -> None:
    """CLI application runner."""
    logger.info("Starting PennyWise Backend on http://%s:%d", AppConfig.HOST, AppConfig.PORT)
    app.run(host=AppConfig.HOST, port=AppConfig.PORT, debug=AppConfig.DEBUG)


if __name__ == "__main__":
    main()