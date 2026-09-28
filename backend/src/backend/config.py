"""Configuration module for PennyWise backend."""

import os
import shutil
import platform
import logging
from pathlib import Path


class AppConfig:
    """Application configuration and environment settings."""

    # Project directories
    BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
    MODEL_DIR = Path(os.environ.get("PENNYWISE_MODEL_DIR", BACKEND_ROOT / "Model" / "models"))
    
    # Model artifacts
    EXPENSE_MODEL_PATH = MODEL_DIR / "expense_model.pkl"
    TFIDF_VECTORIZER_PATH = MODEL_DIR / "tfidf_vectorizer.pkl"
    FEATURE_SCALER_PATH = MODEL_DIR / "feature_scaler.pkl"
    MODEL_INFO_PATH = MODEL_DIR / "model_info.json"

    # Persistence & Storage
    SQLITE_DB_PATH = Path(os.environ.get("PENNYWISE_DB_PATH", BACKEND_ROOT / "pennywise.db"))
    RECEIPTS_DIR = Path(os.environ.get("PENNYWISE_RECEIPTS_DIR", BACKEND_ROOT / "uploads" / "receipts"))

    # Server and Deployment settings
    HOST = "0.0.0.0"
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = False

    # Security, CORS, and Limits
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
    CORS_ORIGINS = [
        o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()
    ]

    # In-memory session limits for public demo
    MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS", 100))
    SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", 1800))
    MAX_EXPENSES_PER_SESSION = 80
    MAX_RECEIPTS_PER_SESSION = 15

    # Exchange rates relative to INR
    EXCHANGE_RATES = {
        "INR": 1.0,
        "USD": 83.5,
        "EUR": 91.0,
        "GBP": 106.0,
    }

    # Logging
    LOG_LEVEL = os.environ.get("PENNYWISE_LOG_LEVEL", "INFO").upper()

    @classmethod
    def resolve_tesseract_path(cls) -> str | None:
        """Resolve the Tesseract OCR executable path across platforms."""
        env_cmd = os.environ.get("TESSERACT_CMD")
        if env_cmd and os.path.exists(env_cmd):
            return env_cmd

        system = platform.system()
        if system == "Windows":
            local_appdata = os.environ.get("LOCALAPPDATA", "")
            possible_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            if local_appdata:
                possible_paths.append(
                    os.path.join(local_appdata, "Programs", "Tesseract-OCR", "tesseract.exe")
                )
            for path in possible_paths:
                if os.path.exists(path):
                    return path

        which_path = shutil.which("tesseract")
        if which_path:
            return which_path

        return None


def configure_logging(level: str = "INFO") -> None:
    """Configure standardized application logging."""
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="[%(asctime)s] %(levelname)s in %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
