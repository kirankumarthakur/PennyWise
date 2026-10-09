"""OCR Engine abstractions and implementations."""

import logging
from abc import ABC, abstractmethod
import numpy as np
import cv2
import pytesseract
from backend.config import AppConfig

logger = logging.getLogger(__name__)


class OcrEngine(ABC):
    """Abstract interface for text extraction from raster images."""

    @abstractmethod
    def is_available(self) -> bool:
        """Check if OCR engine executable or service is available."""
        pass

    @abstractmethod
    def extract_text(self, image: np.ndarray) -> str:
        """Extract text content from an image array."""
        pass


class TesseractOcrEngine(OcrEngine):
    """Tesseract OCR implementation with image preprocessing and multi-mode heuristics."""

    def __init__(self, tesseract_cmd: str | None = None):
        cmd = tesseract_cmd or AppConfig.resolve_tesseract_path()
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
            logger.info("Configured Tesseract binary at: %s", cmd)
        else:
            print("Tesseract OCR is not available in demo environment.", flush=True)
            logger.info("Tesseract OCR is not available in demo environment.")

    def is_available(self) -> bool:
        """Verify Tesseract accessibility."""
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image with grayscale conversion, Gaussian blur, Otsu thresholding, and morphological closing."""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = np.ones((1, 1), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        return cleaned

    def extract_text(self, image: np.ndarray) -> str:
        """Extract text from image using Tesseract across multiple PSM configurations."""
        if not self.is_available():
            logger.info("Tesseract unavailable. Generating manual entry template.")
            height, width = image.shape[:2] if len(image.shape) > 2 else image.shape
            total_pixels = height * width
            return (
                "MANUAL_ENTRY_REQUIRED\n"
                f"Image Size: {width}x{height}\n"
                f"Total Pixels: {total_pixels}\n\n"
                "Please manually enter bill details:\n"
                "- Vendor: [Enter vendor name]\n"
                "- Amount: [Enter amount]\n"
                "- Date: [Enter date]\n"
                "- Category: [Select category]\n\n"
                "Note: Tesseract OCR is not available in demo environment."
            )

        try:
            processed_image = self.preprocess_image(image)
            configs = ["--psm 6", "--psm 4", "--psm 3", "--psm 12"]
            best_text = ""
            max_length = 0

            for config in configs:
                try:
                    text = pytesseract.image_to_string(processed_image, config=config)
                    if len(text.strip()) > max_length:
                        max_length = len(text.strip())
                        best_text = text
                except Exception as ex:
                    logger.debug("PSM mode %s failed: %s", config, ex)
                    continue

            if not best_text.strip():
                best_text = pytesseract.image_to_string(image, config="--psm 6")

            logger.info("OCR extracted %d characters from image.", len(best_text))
            return best_text

        except Exception as e:
            logger.error("OCR execution failure: %s", e)
            return f"OCR Error: {str(e)}"
