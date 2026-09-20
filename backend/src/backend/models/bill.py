"""Domain models for bill parsing and extraction results."""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any


@dataclass
class BillExtractionResult:
    """Encapsulates the structured result of an invoice or receipt extraction."""

    success: bool
    vendor: str = "Unknown Vendor"
    amount: float = 0.0
    total_amount: float = 0.0
    currency: str = "INR"
    date: str = ""
    items: List[str] = field(default_factory=list)
    category: str = "Miscellaneous"
    confidence: float = 0.0
    extracted_text: str = ""
    manual_entry_required: bool = False
    message: Optional[str] = None
    error: Optional[str] = None
    file_type: Optional[str] = None
    filename: Optional[str] = None
    source: Optional[str] = None
    receipt_url: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not self.total_amount and self.amount:
            self.total_amount = self.amount
        elif not self.amount and self.total_amount:
            self.amount = self.total_amount

    def to_dict(self) -> Dict[str, Any]:
        """Convert extraction result to dictionary, omitting None values if appropriate."""
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None}
