"""Receipt document compression and storage service."""

import io
import uuid
import base64
import logging
from pathlib import Path
from typing import Union, BinaryIO
import numpy as np
from PIL import Image

from backend.config import AppConfig

logger = logging.getLogger(__name__)


class ReceiptStorage:
    """Manages compressed on-disk storage and retrieval of receipt documents."""

    def __init__(self, storage_dir: Path | None = None):
        self.storage_dir = storage_dir or AppConfig.RECEIPTS_DIR
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save_compressed_image(self, image_data: Union[np.ndarray, Image.Image, bytes, str]) -> str:
        """Compress and persist an image file, returning its public URL endpoint."""
        try:
            pil_image = self._to_pil_image(image_data)

            # Convert RGBA / Palette modes to RGB
            if pil_image.mode in ("RGBA", "P", "LA"):
                background = Image.new("RGB", pil_image.size, (255, 255, 255))
                if pil_image.mode == "P":
                    pil_image = pil_image.convert("RGBA")
                background.paste(pil_image, mask=pil_image.split()[-1] if pil_image.mode == "RGBA" else None)
                pil_image = background
            elif pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")

            # Proportional downsizing if image exceeds 1200px on any side
            max_size = 1200
            if pil_image.width > max_size or pil_image.height > max_size:
                pil_image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

            filename = f"rec_{uuid.uuid4().hex[:12]}.jpg"
            target_path = self.storage_dir / filename

            # Save as optimized JPEG with 75% quality (excellent clarity at 10-20% file size)
            pil_image.save(target_path, format="JPEG", quality=75, optimize=True)
            logger.info("Saved compressed receipt image: %s (%d bytes)", filename, target_path.stat().st_size)

            return f"/api/receipts/{filename}"

        except Exception as e:
            logger.error("Failed to compress and save receipt image: %s", e)
            return ""

    def save_pdf(self, pdf_stream: BinaryIO) -> str:
        """Persist an uploaded PDF invoice and return its URL."""
        try:
            filename = f"rec_{uuid.uuid4().hex[:12]}.pdf"
            target_path = self.storage_dir / filename

            pdf_stream.seek(0)
            with open(target_path, "wb") as f:
                f.write(pdf_stream.read())
            pdf_stream.seek(0)

            logger.info("Saved receipt PDF: %s (%d bytes)", filename, target_path.stat().st_size)
            return f"/api/receipts/{filename}"
        except Exception as e:
            logger.error("Failed to save receipt PDF: %s", e)
            return ""

    def _to_pil_image(self, image_data: Union[np.ndarray, Image.Image, bytes, str]) -> Image.Image:
        """Standardize image representations into a PIL Image."""
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

        raise ValueError(f"Unsupported image input type: {type(image_data)}")
