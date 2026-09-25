"""Orchestration service for processing uploaded bill images and PDF documents."""

import io
import re
import base64
import logging
from typing import BinaryIO, Union, Optional
import numpy as np
from PIL import Image

from backend.models.bill import BillExtractionResult
from backend.extractors.ocr import OcrEngine
from backend.extractors.document_parser import DocumentParser
from backend.extractors.date_extractor import DateExtractor
from backend.extractors.amount_extractor import AmountExtractor
from backend.extractors.vendor_extractor import VendorExtractor
from backend.extractors.receipt_storage import ReceiptStorage
from backend.services.categorization_service import CategorizationService

logger = logging.getLogger(__name__)


class BillProcessingService:
    """Coordinates parsing, OCR text extraction, entity recognition, and expense categorization."""

    def __init__(
        self,
        ocr_engine: OcrEngine,
        document_parser: DocumentParser,
        date_extractor: DateExtractor,
        amount_extractor: AmountExtractor,
        vendor_extractor: VendorExtractor,
        categorization_service: CategorizationService,
        receipt_storage: Optional[ReceiptStorage] = None,
    ):
        self.ocr_engine = ocr_engine
        self.document_parser = document_parser
        self.date_extractor = date_extractor
        self.amount_extractor = amount_extractor
        self.vendor_extractor = vendor_extractor
        self.categorization_service = categorization_service
        self.receipt_storage = receipt_storage or ReceiptStorage()

    def process_pdf(self, pdf_stream: BinaryIO, filename: str) -> BillExtractionResult:
        """Process an uploaded PDF invoice, save a copy, and extract details."""
        logger.info("Processing PDF document: %s", filename)
        receipt_url = self.receipt_storage.save_pdf(pdf_stream)
        extracted_text = self.document_parser.extract_text_from_pdf(pdf_stream)
        return self._process_text_pipeline(
            extracted_text,
            filename=filename,
            file_type="pdf",
            source="pdf_text",
            receipt_url=receipt_url,
        )

    def process_image(self, image_data: Union[np.ndarray, str, bytes, Image.Image], filename: str) -> BillExtractionResult:
        """Process an uploaded receipt image, compress and store it, and extract text."""
        logger.info("Processing image document: %s", filename)
        image_array = self._to_numpy_image(image_data)
        receipt_url = self.receipt_storage.save_compressed_image(image_array)
        extracted_text = self.ocr_engine.extract_text(image_array)
        return self._process_text_pipeline(
            extracted_text,
            filename=filename,
            file_type="image",
            source="image_ocr",
            receipt_url=receipt_url,
        )

    def _to_numpy_image(self, image_data: Union[np.ndarray, str, bytes, Image.Image]) -> np.ndarray:
        """Convert varied image inputs (base64, bytes, PIL) into standard numpy array."""
        if isinstance(image_data, np.ndarray):
            return image_data

        if isinstance(image_data, str):
            if image_data.startswith("data:image"):
                image_data = image_data.split(",", 1)[1]
            raw_bytes = base64.b64decode(image_data)
            pil_image = Image.open(io.BytesIO(raw_bytes))
            return np.array(pil_image)

        if isinstance(image_data, bytes):
            pil_image = Image.open(io.BytesIO(image_data))
            return np.array(pil_image)

        if isinstance(image_data, Image.Image):
            return np.array(image_data)

        raise ValueError(f"Unsupported image input type: {type(image_data)}")

    def _process_text_pipeline(
        self,
        extracted_text: str,
        filename: str,
        file_type: str,
        source: str,
        receipt_url: str = "",
    ) -> BillExtractionResult:
        """Execute unified entity extraction and categorization pipeline on raw document text."""
        if not extracted_text or extracted_text.startswith("OCR Error"):
            return BillExtractionResult(
                success=False,
                error=f"Text extraction failed: {extracted_text}",
                extracted_text=extracted_text,
                file_type=file_type,
                filename=filename,
                source=source,
                receipt_url=receipt_url,
            )

        if "MANUAL_ENTRY_REQUIRED" in extracted_text or "PDF_EXTRACTION_FAILED" in extracted_text:
            return BillExtractionResult(
                success=True,
                manual_entry_required=True,
                vendor="Unknown Vendor",
                amount=0.0,
                total_amount=0.0,
                currency="INR",
                date=self.date_extractor.extract_date(""),
                items=[],
                category="Other",
                confidence=0.1,
                extracted_text=extracted_text,
                message="Text extraction unavailable. Please enter details manually.",
                file_type=file_type,
                filename=filename,
                source=source,
                receipt_url=receipt_url,
                tags=["receipt"],
            )

        # Entity extraction
        amounts, currency = self.amount_extractor.extract_amounts(extracted_text)
        bill_date = self.date_extractor.extract_date(extracted_text)
        vendor = self.vendor_extractor.extract_vendor(extracted_text)
        items = self.vendor_extractor.extract_items(extracted_text)

        total_amount = amounts[0] if amounts else 0.0

        if total_amount == 0.0:
            fallback_matches = re.findall(r"([0-9]{1,6}\.[0-9]{2})|([0-9]{2,6})", extracted_text)
            fallback_candidates = []
            for m in fallback_matches:
                val = m[0] or m[1]
                try:
                    num = float(val)
                    if 10 <= num <= 100000:
                        fallback_candidates.append(num)
                except ValueError:
                    continue
            if fallback_candidates:
                total_amount = max(fallback_candidates)

        if total_amount == 0.0:
            return BillExtractionResult(
                success=True,
                manual_entry_required=True,
                vendor=vendor or "Unknown Vendor",
                amount=0.0,
                total_amount=0.0,
                currency=currency,
                date=bill_date,
                items=items,
                category="Other",
                confidence=0.2,
                extracted_text=extracted_text,
                message="Could not reliably detect amount. Please enter manually.",
                file_type=file_type,
                filename=filename,
                source=source,
                receipt_url=receipt_url,
                tags=["receipt"],
            )

        # Build categorization context
        desc_parts = []
        if vendor and not vendor.startswith("Bill No"):
            desc_parts.append(vendor)
        if items:
            desc_parts.extend(items)
        desc_parts.append(extracted_text[:300])

        categorization_text = " ".join(desc_parts)
        category = self.categorization_service.categorize(categorization_text, total_amount)

        # Generate intelligent initial tags
        tags = ["receipt"]
        if category and category != "Miscellaneous":
            tags.append(category.lower().replace(" & ", "-").replace(" ", "-"))

        return BillExtractionResult(
            success=True,
            vendor=vendor,
            amount=total_amount,
            total_amount=total_amount,
            currency=currency,
            date=bill_date,
            items=items,
            category=category,
            confidence=0.8,
            extracted_text=extracted_text,
            file_type=file_type,
            filename=filename,
            source=source,
            receipt_url=receipt_url,
            tags=tags,
        )
