"""Domain models for expenses."""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any


@dataclass
class Expense:
    """Represents an individual expense entry."""

    id: int
    vendor: str
    amount: float
    category: str
    date: str
    currency: str = "INR"
    items: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    receipt_url: Optional[str] = None
    createdAt: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        """Convert expense instance to dictionary."""
        return asdict(self)


@dataclass
class ExpenseFilter:
    """Filter criteria for querying expenses."""

    start_date: Optional[str] = None
    end_date: Optional[str] = None
    category: Optional[str] = None
    tag: Optional[str] = None
