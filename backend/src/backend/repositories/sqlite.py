"""SQLite repository for persistent expense storage."""

import json
import sqlite3
import logging
from pathlib import Path
from typing import List, Optional
from contextlib import contextmanager
from backend.models.expense import Expense, ExpenseFilter
from backend.repositories.base import ExpenseRepository

logger = logging.getLogger(__name__)


class SqliteExpenseRepository(ExpenseRepository):
    """SQLite implementation of the ExpenseRepository interface."""

    def __init__(self, db_path: Path | str = "pennywise.db"):
        self.db_path = str(db_path)
        self._init_db()

    @contextmanager
    def _connection(self):
        """Create a dedicated, thread-safe SQLite connection context that auto-closes."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Create database tables and indexes if they do not exist and apply migrations."""
        with self._connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    vendor TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'INR',
                    category TEXT NOT NULL,
                    date TEXT NOT NULL,
                    items TEXT,
                    tags TEXT,
                    receipt_url TEXT,
                    created_at TEXT NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);")

            # Check and run automatic column migrations if table already existed without new columns
            cursor = conn.execute("PRAGMA table_info(expenses)")
            existing_cols = {row["name"] for row in cursor.fetchall()}
            if "tags" not in existing_cols:
                conn.execute("ALTER TABLE expenses ADD COLUMN tags TEXT")
                logger.info("Migrated SQLite schema: added 'tags' column.")
            if "receipt_url" not in existing_cols:
                conn.execute("ALTER TABLE expenses ADD COLUMN receipt_url TEXT")
                logger.info("Migrated SQLite schema: added 'receipt_url' column.")

            # Settings table for AI provider keys and user preferences
            conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            logger.info("Initialized SQLite database schema at %s", self.db_path)

    def _row_to_expense(self, row: sqlite3.Row) -> Expense:
        """Convert a SQLite Row into an Expense domain entity."""
        raw_items = row["items"]
        items_list = []
        if raw_items:
            try:
                items_list = json.loads(raw_items)
            except (ValueError, TypeError):
                items_list = [raw_items]

        raw_tags = row["tags"] if "tags" in row.keys() else None
        tags_list = []
        if raw_tags:
            try:
                tags_list = json.loads(raw_tags)
            except (ValueError, TypeError):
                tags_list = [raw_tags]

        receipt_url = row["receipt_url"] if "receipt_url" in row.keys() else None

        return Expense(
            id=row["id"],
            vendor=row["vendor"],
            amount=float(row["amount"]),
            currency=row["currency"],
            category=row["category"],
            date=row["date"],
            items=items_list,
            tags=tags_list,
            receipt_url=receipt_url,
            createdAt=row["created_at"],
        )

    def add(self, expense: Expense) -> Expense:
        items_json = json.dumps(expense.items) if expense.items else None
        tags_json = json.dumps(expense.tags) if expense.tags else None
        with self._connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO expenses (vendor, amount, currency, category, date, items, tags, receipt_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    expense.vendor,
                    expense.amount,
                    expense.currency,
                    expense.category,
                    expense.date,
                    items_json,
                    tags_json,
                    expense.receipt_url,
                    expense.createdAt,
                ),
            )
            expense.id = cursor.lastrowid
            return expense

    def get_all(self, filter_criteria: Optional[ExpenseFilter] = None) -> List[Expense]:
        query = "SELECT * FROM expenses"
        params: List[str] = []
        conditions: List[str] = []

        if filter_criteria:
            if filter_criteria.start_date:
                conditions.append("date >= ?")
                params.append(filter_criteria.start_date)
            if filter_criteria.end_date:
                conditions.append("date <= ?")
                params.append(filter_criteria.end_date)
            if filter_criteria.category and filter_criteria.category != "All Categories":
                conditions.append("category = ?")
                params.append(filter_criteria.category)
            if filter_criteria.tag and filter_criteria.tag != "All Tags":
                conditions.append("tags LIKE ?")
                params.append(f'%"{filter_criteria.tag}"%')

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY date DESC, id DESC"

        with self._connection() as conn:
            cursor = conn.execute(query, params)
            return [self._row_to_expense(row) for row in cursor.fetchall()]

    def get_by_id(self, expense_id: int) -> Optional[Expense]:
        with self._connection() as conn:
            cursor = conn.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,))
            row = cursor.fetchone()
            return self._row_to_expense(row) if row else None

    def delete(self, expense_id: int) -> bool:
        with self._connection() as conn:
            cursor = conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
            return cursor.rowcount > 0

    def clear_all(self) -> None:
        with self._connection() as conn:
            conn.execute("DELETE FROM expenses")

    def update_dates(self, target_date: str, new_date: str) -> int:
        with self._connection() as conn:
            cursor = conn.execute(
                "UPDATE expenses SET date = ? WHERE date = ?",
                (new_date, target_date),
            )
            return cursor.rowcount

    def count(self) -> int:
        with self._connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM expenses")
            row = cursor.fetchone()
            return row[0] if row else 0

    def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Retrieve a configuration value by key."""
        with self._connection() as conn:
            cursor = conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row["value"] if row else default

    def set_setting(self, key: str, value: str) -> None:
        """Store or update a configuration key-value pair."""
        with self._connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                """,
                (key, value),
            )

    def get_all_settings(self) -> dict[str, str]:
        """Retrieve all configuration key-value pairs."""
        with self._connection() as conn:
            cursor = conn.execute("SELECT key, value FROM settings")
            rows = cursor.fetchall()
            return {row["key"]: row["value"] for row in rows}

