"""Abstract repository interface for expenses."""

from abc import ABC, abstractmethod
from typing import List, Optional
from backend.models.expense import Expense, ExpenseFilter


class ExpenseRepository(ABC):
    """Abstract interface defining operations on expense persistence."""

    @abstractmethod
    def add(self, expense: Expense) -> Expense:
        """Add a new expense."""
        pass

    @abstractmethod
    def get_all(self, filter_criteria: Optional[ExpenseFilter] = None) -> List[Expense]:
        """Retrieve all expenses matching filter criteria."""
        pass

    @abstractmethod
    def get_by_id(self, expense_id: int) -> Optional[Expense]:
        """Retrieve a specific expense by ID."""
        pass

    @abstractmethod
    def delete(self, expense_id: int) -> bool:
        """Delete an expense by ID. Returns True if deleted, False otherwise."""
        pass

    @abstractmethod
    def clear_all(self) -> None:
        """Clear all stored expenses."""
        pass

    @abstractmethod
    def update_dates(self, target_date: str, new_date: str) -> int:
        """Update dates matching target_date to new_date. Returns count of modified records."""
        pass

    @abstractmethod
    def count(self) -> int:
        """Return the total number of stored expenses."""
        pass
