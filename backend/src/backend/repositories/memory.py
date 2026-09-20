"""Thread-safe in-memory expense repository implementation."""

import threading
from typing import List, Optional
from backend.models.expense import Expense, ExpenseFilter
from backend.repositories.base import ExpenseRepository


class InMemoryExpenseRepository(ExpenseRepository):
    """Thread-safe in-memory store for expenses."""

    def __init__(self):
        self._lock = threading.RLock()
        self._expenses: List[Expense] = []
        self._id_counter = 1

    def add(self, expense: Expense) -> Expense:
        with self._lock:
            expense.id = self._id_counter
            self._id_counter += 1
            self._expenses.append(expense)
            return expense

    def get_all(self, filter_criteria: Optional[ExpenseFilter] = None) -> List[Expense]:
        with self._lock:
            results = list(self._expenses)

            if filter_criteria:
                if filter_criteria.start_date:
                    results = [e for e in results if str(e.date) >= filter_criteria.start_date]
                if filter_criteria.end_date:
                    results = [e for e in results if str(e.date) <= filter_criteria.end_date]
                if filter_criteria.category and filter_criteria.category != "All Categories":
                    results = [e for e in results if e.category == filter_criteria.category]
                if filter_criteria.tag and filter_criteria.tag != "All Tags":
                    results = [e for e in results if filter_criteria.tag in e.tags]

            # Return sorted by date descending (newest first)
            results.sort(key=lambda x: str(x.date), reverse=True)
            return results

    def get_by_id(self, expense_id: int) -> Optional[Expense]:
        with self._lock:
            for expense in self._expenses:
                if expense.id == expense_id:
                    return expense
            return None

    def delete(self, expense_id: int) -> bool:
        with self._lock:
            initial_count = len(self._expenses)
            self._expenses = [e for e in self._expenses if e.id != expense_id]
            return len(self._expenses) < initial_count

    def clear_all(self) -> None:
        with self._lock:
            self._expenses.clear()

    def update_dates(self, target_date: str, new_date: str) -> int:
        with self._lock:
            updated_count = 0
            for expense in self._expenses:
                if expense.date == target_date:
                    expense.date = new_date
                    updated_count += 1
            return updated_count

    def count(self) -> int:
        with self._lock:
            return len(self._expenses)
