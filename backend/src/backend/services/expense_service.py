"""Business logic service for managing expenses and computing analytics."""

import logging
from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

from backend.models.expense import Expense, ExpenseFilter
from backend.repositories.base import ExpenseRepository

logger = logging.getLogger(__name__)


class ExpenseService:
    """Provides expense validation, persistence interactions, and financial analytics."""

    USD_TO_INR_RATE = 80.0

    def __init__(self, repository: ExpenseRepository):
        self.repository = repository

    def create_expense(self, data: Dict[str, Any]) -> Tuple[Optional[Expense], Optional[str]]:
        """Validate input payload and persist a new expense."""
        required_fields = ["vendor", "amount", "category", "date"]
        for field in required_fields:
            if field not in data:
                return None, f"Missing required field: {field}"

        try:
            amount = float(data["amount"])
            if amount <= 0:
                return None, "Amount must be greater than 0"
        except (ValueError, TypeError):
            return None, "Amount must be a valid number"

        vendor = str(data["vendor"]).strip()
        if not vendor:
            return None, "Vendor name cannot be empty"

        category = str(data["category"]).strip()
        if not category:
            return None, "Category cannot be empty"

        # Sanitize tags list
        raw_tags = data.get("tags", [])
        if isinstance(raw_tags, str):
            raw_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
        tags = [str(t).strip().lower() for t in raw_tags if str(t).strip()]

        expense = Expense(
            id=0,
            vendor=vendor,
            amount=amount,
            currency=data.get("currency", "INR"),
            category=category,
            date=str(data["date"]).strip(),
            items=data.get("items", []),
            tags=tags,
            receipt_url=data.get("receipt_url"),
        )

        persisted = self.repository.add(expense)
        logger.info("Created expense ID %d for vendor '%s' (amount: %.2f)", persisted.id, persisted.vendor, persisted.amount)
        return persisted, None

    def list_expenses(self, filter_criteria: Optional[ExpenseFilter] = None) -> List[Expense]:
        """Fetch all expenses adhering to filter criteria."""
        return self.repository.get_all(filter_criteria)

    def delete_expense(self, expense_id: int) -> bool:
        """Delete an existing expense by ID."""
        deleted = self.repository.delete(expense_id)
        if deleted:
            logger.info("Deleted expense ID: %d", expense_id)
        return deleted

    def clear_all(self) -> None:
        """Purge all stored expenses."""
        self.repository.clear_all()
        logger.info("Cleared all expenses from repository.")

    def fix_dates(self, target_date: str, new_date: str) -> int:
        """Bulk update matching legacy dates."""
        count = self.repository.update_dates(target_date, new_date)
        logger.info("Updated %d expenses from date '%s' to '%s'", count, target_date, new_date)
        return count

    def get_all_tags(self) -> List[str]:
        """Return unique sorted list of all tags currently in use."""
        expenses = self.repository.get_all()
        tag_set = set()
        for e in expenses:
            for t in e.tags:
                if t.strip():
                    tag_set.add(t.strip())
        return sorted(tag_set)

    def get_analytics(self) -> Dict[str, Any]:
        """Compute category totals, monthly aggregates, and tag breakdown normalized to INR."""
        expenses = self.repository.get_all()
        if not expenses:
            return {
                "success": True,
                "categoryData": [],
                "monthlyData": [],
                "tagData": [],
                "totalExpenses": 0.0,
                "averageExpense": 0.0,
                "expenseCount": 0,
            }

        category_totals = defaultdict(float)
        monthly_totals = defaultdict(float)
        tag_totals = defaultdict(float)

        for e in expenses:
            amount_inr = e.amount * self.USD_TO_INR_RATE if e.currency == "USD" else e.amount
            category_totals[e.category] += amount_inr

            # Tag totals
            for t in e.tags:
                tag_name = t.strip()
                if tag_name:
                    tag_totals[tag_name] += amount_inr

            # Month grouping
            try:
                date_str = e.date[0] if isinstance(e.date, list) and e.date else str(e.date)
                parsed_dt = datetime.strptime(date_str, "%Y-%m-%d")
                month_key = parsed_dt.strftime("%Y-%m")
            except (ValueError, TypeError):
                month_key = datetime.now().strftime("%Y-%m")

            monthly_totals[month_key] += amount_inr

        category_data = [
            {"name": cat, "value": round(val, 2)}
            for cat, val in category_totals.items()
        ]

        monthly_data = [
            {"month": m, "amount": round(val, 2)}
            for m, val in sorted(monthly_totals.items())
        ]

        tag_data = [
            {"name": tag, "value": round(val, 2)}
            for tag, val in sorted(tag_totals.items(), key=lambda x: x[1], reverse=True)
        ]

        total_expenses = sum(category_totals.values())
        average_expense = total_expenses / len(expenses) if expenses else 0.0

        return {
            "success": True,
            "categoryData": category_data,
            "monthlyData": monthly_data,
            "tagData": tag_data,
            "totalExpenses": round(total_expenses, 2),
            "averageExpense": round(average_expense, 2),
            "expenseCount": len(expenses),
        }

    def count(self) -> int:
        """Count total recorded expenses."""
        return self.repository.count()
