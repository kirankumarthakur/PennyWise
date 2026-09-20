"""Document text extraction handlers for PDF and multi-page documents."""

import logging
from io import BytesIO
from typing import BinaryIO
import numpy as np
from PIL import Image
import pdfplumber
import PyPDF2

try:
    import pymupdf as fitz
    HAVE_FITZ = True
except ImportError:
    try:
        import fitz
        HAVE_FITZ = True
    except ImportError:
        HAVE_FITZ = False

from backend.extractors.ocr import OcrEngine

logger = logging.getLogger(__name__)


class DocumentParser:
    """Extracts text from PDF documents using native streams and OCR fallbacks."""

    def __init__(self, ocr_engine: OcrEngine):
        self.ocr_engine = ocr_engine

    def extract_text_from_pdf(self, pdf_file: BinaryIO) -> str:
        """Extract text from PDF using pdfplumber, PyPDF2, or rasterized OCR."""
        text = ""

        # Strategy 1: pdfplumber for digital PDFs with layout
        try:
            pdf_file.seek(0)
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"

            if text.strip():
                logger.info("Extracted %d characters from PDF using pdfplumber.", len(text))
                return text
        except Exception as e:
            logger.debug("pdfplumber extraction failed: %s", e)

        # Strategy 2: PyPDF2 fallback
        try:
            pdf_file.seek(0)
            reader = PyPDF2.PdfReader(pdf_file)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

            if text.strip():
                logger.info("Extracted %d characters from PDF using PyPDF2.", len(text))
                return text
        except Exception as e:
            logger.debug("PyPDF2 extraction failed: %s", e)

        # Strategy 3: OCR on scanned PDF pages
        logger.info("Attempting OCR rasterization for scanned PDF.")
        return self._extract_text_from_scanned_pdf(pdf_file)

    def _extract_text_from_scanned_pdf(self, pdf_file: BinaryIO) -> str:
        """Rasterize PDF pages using PyMuPDF and run OCR."""
        if not HAVE_FITZ:
            logger.warning("PyMuPDF (fitz) not available for scanned PDF processing.")
            return (
                "PDF_EXTRACTION_FAILED\n\n"
                "Could not extract text from PDF. PyMuPDF is required for scanned PDF OCR."
            )

        try:
            pdf_file.seek(0)
            doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
            extracted_text = ""

            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                image = Image.open(BytesIO(pix.tobytes("png")))
                image_array = np.array(image)

                page_text = self.ocr_engine.extract_text(image_array)
                if page_text and page_text.strip():
                    extracted_text += page_text + "\n"

            doc.close()

            if extracted_text.strip():
                logger.info("Extracted %d characters from scanned PDF via OCR.", len(extracted_text))
                return extracted_text

            return (
                "PDF_EXTRACTION_FAILED\n\n"
                "Could not extract readable text from scanned PDF."
            )

        except Exception as e:
            logger.error("Scanned PDF OCR failed: %s", e)
            return f"PDF OCR Error: {str(e)}"
