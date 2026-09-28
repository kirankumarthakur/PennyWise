import json
import sqlite3
import threading
import time
import math
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any

from backend.models.expense import Expense, ExpenseFilter
from backend.repositories.base import ExpenseRepository

SAMPLE_EXPENSES = [
    {
        "vendor": "Starbucks Coffee",
        "amount": 450.0,
        "currency": "INR",
        "category": "Food & Dining",
        "days_ago": 0,
        "items": ["Caramel Macchiato", "Blueberry Muffin"],
        "tags": ["coffee", "work"],
    },
    {
        "vendor": "Swiggy Gourmet",
        "amount": 890.0,
        "currency": "INR",
        "category": "Food & Dining",
        "days_ago": 1,
        "items": ["Pasta Alfredo", "Garlic Bread"],
        "tags": ["dinner", "food"],
    },
    {
        "vendor": "Uber City Commute",
        "amount": 340.0,
        "currency": "INR",
        "category": "Transportation",
        "days_ago": 2,
        "items": ["Airport Transit Ride"],
        "tags": ["commute", "travel"],
    },
    {
        "vendor": "Amazon Shopping",
        "amount": 3499.0,
        "currency": "INR",
        "category": "Shopping",
        "days_ago": 4,
        "items": ["Mechanical Keyboard", "USB-C Cable"],
        "tags": ["tech", "setup"],
    },
    {
        "vendor": "Electricity Board",
        "amount": 1850.0,
        "currency": "INR",
        "category": "Bills & Utilities",
        "days_ago": 6,
        "items": ["Monthly Power Utility Bill"],
        "tags": ["utility", "home"],
    },
    {
        "vendor": "Netflix Subscription",
        "amount": 649.0,
        "currency": "INR",
        "category": "Entertainment",
        "days_ago": 9,
        "items": ["Monthly 4K Premium Plan"],
        "tags": ["streaming", "subscription"],
    },
    {
        "vendor": "Apollo Pharmacy",
        "amount": 620.0,
        "currency": "INR",
        "category": "Healthcare",
        "days_ago": 11,
        "items": ["Multivitamins", "Pain Relief Spray"],
        "tags": ["health", "medical"],
    },
    {
        "vendor": "Blinkit Supermarket",
        "amount": 1280.0,
        "currency": "INR",
        "category": "Groceries",
        "days_ago": 14,
        "items": ["Organic Milk", "Almonds", "Sourdough Bread"],
        "tags": ["groceries", "pantry"],
    },
]


class SqliteInMemoryExpenseRepository(ExpenseRepository):
    def __init__(self):
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_db()

    def _init_db(self):
        with self.lock:
            self.conn.execute("""
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
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);")
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);")
            self.conn.commit()

    def _row_to_expense(self, row: sqlite3.Row) -> Expense:
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

        return Expense(
            id=row["id"],
            vendor=row["vendor"],
            amount=float(row["amount"]),
            currency=row["currency"],
            category=row["category"],
            date=row["date"],
            items=items_list,
            tags=tags_list,
            receipt_url=row["receipt_url"],
            createdAt=row["created_at"],
        )

    def add(self, expense: Expense) -> Expense:
        items_json = json.dumps(expense.items) if expense.items else None
        tags_json = json.dumps(expense.tags) if expense.tags else None
        with self.lock:
            cursor = self.conn.execute(
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
            self.conn.commit()
            expense.id = cursor.lastrowid
            return expense

    def get_all(self, filter_criteria: Optional[ExpenseFilter] = None) -> List[Expense]:
        query = "SELECT * FROM expenses"
        params: List[Any] = []
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

        with self.lock:
            cursor = self.conn.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_expense(row) for row in rows]

    def get_by_id(self, expense_id: int) -> Optional[Expense]:
        with self.lock:
            cursor = self.conn.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,))
            row = cursor.fetchone()
            return self._row_to_expense(row) if row else None

    def delete(self, expense_id: int) -> bool:
        with self.lock:
            cursor = self.conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
            self.conn.commit()
            return cursor.rowcount > 0

    def clear_all(self) -> None:
        with self.lock:
            self.conn.execute("DELETE FROM expenses")
            self.conn.commit()

    def count(self) -> int:
        with self.lock:
            cursor = self.conn.execute("SELECT COUNT(*) FROM expenses")
            row = cursor.fetchone()
            return row[0] if row else 0

    def seed_default_data(self):
        today = date.today()
        for item in SAMPLE_EXPENSES:
            tx_date = (today - timedelta(days=item["days_ago"])).isoformat()
            expense = Expense(
                id=0,
                vendor=item["vendor"],
                amount=item["amount"],
                currency=item["currency"],
                category=item["category"],
                date=tx_date,
                items=item["items"],
                tags=item["tags"],
                createdAt=f"{tx_date}T12:00:00",
            )
            self.add(expense)

    def close(self):
        with self.lock:
            try:
                self.conn.close()
            except Exception:
                pass


class InMemorySessionStore:
    def __init__(
        self,
        max_sessions: int = 100,
        ttl_seconds: int = 1800,
        max_expenses_per_session: int = 80,
        max_receipts_per_session: int = 15,
        max_receipt_bytes: int = 5 * 1024 * 1024,
    ):
        self.lock = threading.Lock()
        self.max_sessions = max_sessions
        self.ttl_seconds = ttl_seconds
        self.max_expenses_per_session = max_expenses_per_session
        self.max_receipts_per_session = max_receipts_per_session
        self.max_receipt_bytes = max_receipt_bytes
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def _cleanup_stale_sessions_locked(self):
        now = time.time()
        stale_keys = [
            sid
            for sid, sdata in self.sessions.items()
            if (now - sdata["last_active"]) > self.ttl_seconds
        ]
        for sid in stale_keys:
            sdata = self.sessions.pop(sid, None)
            if sdata and "repo" in sdata:
                sdata["repo"].close()

        if len(self.sessions) >= self.max_sessions:
            sorted_by_activity = sorted(
                self.sessions.items(), key=lambda kv: kv[1]["last_active"]
            )
            to_remove = len(self.sessions) - self.max_sessions + 1
            for sid, sdata in sorted_by_activity[:to_remove]:
                self.sessions.pop(sid, None)
                if "repo" in sdata:
                    sdata["repo"].close()

    def get_or_create(self, session_id: str) -> Dict[str, Any]:
        sid = (session_id or "demo").strip()[:64]
        with self.lock:
            self._cleanup_stale_sessions_locked()
            now = time.time()

            if sid in self.sessions:
                self.sessions[sid]["last_active"] = now
                return self.sessions[sid]

            repo = SqliteInMemoryExpenseRepository()
            repo.seed_default_data()

            session_data = {
                "id": sid,
                "repo": repo,
                "last_active": now,
                "created_at": now,
                "receipts": {},
                "settings": {
                    "monthly_budget": 15000.0,
                    "currency": "INR",
                    "active_provider": "gemini",
                    "gemini_model": "gemini-3.8-flash",
                    "openai_model": "gpt-6-luna",
                    "anthropic_model": "claude-haiku-5.5",
                },
            }
            self.sessions[sid] = session_data
            return session_data

    def reset_session(self, session_id: str) -> Dict[str, Any]:
        sid = (session_id or "demo").strip()[:64]
        with self.lock:
            sdata = self.sessions.get(sid)
            if sdata and "repo" in sdata:
                sdata["repo"].clear_all()
                sdata["repo"].seed_default_data()
                sdata["receipts"].clear()
                sdata["last_active"] = time.time()
                return sdata
        return self.get_or_create(sid)

    def save_receipt(
        self, session_id: str, filename: str, data: bytes, mime_type: str
    ) -> bool:
        if len(data) > self.max_receipt_bytes:
            return False
        session = self.get_or_create(session_id)
        with self.lock:
            receipts = session["receipts"]
            if len(receipts) >= self.max_receipts_per_session:
                oldest_key = next(iter(receipts))
                receipts.pop(oldest_key, None)

            receipts[filename] = {
                "data": data,
                "mime_type": mime_type,
                "created_at": time.time(),
            }
            session["last_active"] = time.time()
            return True

    def get_receipt(
        self, session_id: str, filename: str
    ) -> Optional[Dict[str, Any]]:
        session = self.get_or_create(session_id)
        with self.lock:
            session["last_active"] = time.time()
            return session["receipts"].get(filename)
