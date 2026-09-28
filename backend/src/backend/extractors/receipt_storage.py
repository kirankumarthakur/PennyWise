"""Receipt document compression and in-memory storage service."""

import io
import uuid
import base64
import logging
from typing import Union, BinaryIO, Dict, Optional
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class ReceiptStorage:
    """Manages compressed in-memory storage and retrieval of receipt documents."""

    def __init__(self):
        self._in_memory_receipts: Dict[str, Dict[str, Union[bytes, str]]] = {}

    def save_compressed_image(
        self,
        image_data: Union[np.ndarray, Image.Image, bytes, str],
        filename_prefix: str = "rec",
    ) -> str:
        """Compress image to JPEG in memory and store, returning endpoint URL."""
        try:
            pil_image = self._to_pil_image(image_data)

            if pil_image.mode in ("RGBA", "P", "LA"):
                background = Image.new("RGB", pil_image.size, (255, 255, 255))
                if pil_image.mode == "P":
                    pil_image = pil_image.convert("RGBA")
                background.paste(
                    pil_image,
                    mask=pil_image.split()[-1] if pil_image.mode == "RGBA" else None,
                )
                pil_image = background
            elif pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")

            max_size = 1200
            if pil_image.width > max_size or pil_image.height > max_size:
                pil_image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

            filename = f"{filename_prefix}_{uuid.uuid4().hex[:12]}.jpg"
            buf = io.BytesIO()
            pil_image.save(buf, format="JPEG", quality=75, optimize=True)
            image_bytes = buf.getvalue()

            self._in_memory_receipts[filename] = {
                "data": image_bytes,
                "mime_type": "image/jpeg",
            }
            logger.info("Saved compressed in-memory receipt: %s (%d bytes)", filename, len(image_bytes))
            return f"/api/receipts/{filename}"

        except Exception as e:
            logger.error("Failed to compress receipt image: %s", e)
            return ""

    def save_pdf(self, pdf_stream: BinaryIO, filename_prefix: str = "rec") -> str:
        """Store uploaded PDF in memory and return endpoint URL."""
        try:
            filename = f"{filename_prefix}_{uuid.uuid4().hex[:12]}.pdf"
            if hasattr(pdf_stream, "seek"):
                pdf_stream.seek(0)
            data = pdf_stream.read()
            self._in_memory_receipts[filename] = {
                "data": data,
                "mime_type": "application/pdf",
            }
            return f"/api/receipts/{filename}"
        except Exception as e:
            logger.error("Failed to save PDF in memory: %s", e)
            return ""

    def get_receipt(self, filename: str) -> Optional[Dict[str, Union[bytes, str]]]:
        """Fetch receipt by filename from in-memory store."""
        return self._in_memory_receipts.get(filename)

    def _to_pil_image(self, image_data: Union[np.ndarray, Image.Image, bytes, str]) -> Image.Image:
        """Convert input data to PIL Image object."""
        if isinstance(image_data, Image.Image):
            return image_data
        if isinstance(image_data, np.ndarray):
            return Image.fromarray(image_data)
        if isinstance(image_data, bytes):
            return Image.open(io.BytesIO(image_data))
        if isinstance(image_data, str):
            if image_data.startswith("data:image"):
                image_data = image_data.split(",", 1)[1]
            raw_bytes = base64.b64decode(image_data)
            return Image.open(io.BytesIO(raw_bytes))
        raise ValueError(f"Cannot convert type {type(image_data)} to PIL Image")
