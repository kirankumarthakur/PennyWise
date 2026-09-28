"""AI Financial Intelligence Service for PennyWise."""

import calendar
import datetime
import json
import logging
import re
from typing import Any, Optional

from backend.models.expense import Expense
from backend.models.bill import BillExtractionResult
from backend.services.llm.factory import LLMClientFactory
from backend.services.settings_service import SettingsService

logger = logging.getLogger(__name__)

STANDARD_CATEGORIES = [
    "Food & Dining",
    "Shopping",
    "Transportation",
    "Bills & Utilities",
    "Healthcare",
    "Entertainment",
    "Travel",
    "Education",
    "Groceries",
    "Other",
]


class AIFinancialService:
    """Orchestrates LLM-powered financial intelligence, parsing, analysis, and chat."""

    def __init__(self, settings_service: SettingsService, expense_repo):
        self.settings_service = settings_service
        self.repo = expense_repo

    def _get_client(self):
        """Retrieve active LLM client or None if no valid key is configured."""
        return LLMClientFactory.get_active_client(self.settings_service)

    def parse_unstructured_expense(self, text: str) -> dict[str, Any]:
        """Parse raw SMS text, bill snippets, or natural language notes into transaction fields."""
        client = self._get_client()
        today = datetime.date.today().isoformat()

        if client:
            prompt = f"""
Parse the following unstructured expense text (such as a bank SMS alert, note, or receipt summary) into a structured JSON expense object.

Today's date is: {today}
Allowed categories: {', '.join(STANDARD_CATEGORIES)}

Input text:
\"\"\"{text}\"\"\"

Return a JSON object strictly matching this schema:
{{
  "vendor": "Store, merchant, or payee name",
  "amount": 0.00,
  "currency": "INR",
  "category": "One of the allowed categories",
  "date": "YYYY-MM-DD",
  "tags": ["tag1", "tag2"],
  "notes": "Short description or line items"
}}
"""
            try:
                result = client.generate_json(prompt, system_instruction="You are a precise financial data extraction assistant.")
                if result.get("vendor") and result.get("amount") is not None:
                    # Normalize category
                    cat = result.get("category", "Other")
                    if cat not in STANDARD_CATEGORIES:
                        cat = "Other"
                    result["category"] = cat
                    result["amount"] = float(result["amount"])
                    if not result.get("date"):
                        result["date"] = today
                    return result
            except Exception as e:
                logger.warning("LLM text parsing failed, using fallback: %s", e)

        # Rule-based fallback if no LLM configured or call failed
        return self._heuristic_text_parse(text, today)

    def _heuristic_text_parse(self, text: str, today: str) -> dict[str, Any]:
        """Deterministic heuristic fallback parser for bank SMS and notes."""
        amount = 0.0
        vendor = "Unknown Merchant"
        category = "Other"
        tags = []

        # Find amounts (Rs. 450, INR 500, ₹450, 450.00)
        amt_match = re.search(r"(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
        if not amt_match:
            amt_match = re.search(r"\b([\d,]+\.\d{2})\b", text)
        if amt_match:
            try:
                amount = float(amt_match.group(1).replace(",", ""))
            except ValueError:
                pass

        # Find vendor following 'at', 'to', 'for', 'vpa'
        v_match = re.search(r"(?:at|to|vpa|paid to)\s+([A-Za-z0-9\s&'-]{2,25})", text, re.IGNORECASE)
        if v_match:
            vendor = v_match.group(1).strip().title()

        # Simple category keywords
        lower = text.lower()
        if any(w in lower for w in ("swiggy", "zomato", "restaurant", "cafe", "coffee", "food", "dinner", "lunch")):
            category = "Food & Dining"
            tags = ["food", "dining"]
        elif any(w in lower for w in ("uber", "ola", "metro", "fuel", "petrol", "cab", "taxi")):
            category = "Transportation"
            tags = ["commute", "travel"]
        elif any(w in lower for w in ("amazon", "flipkart", "myntra", "store", "shopping")):
            category = "Shopping"
            tags = ["shopping"]
        elif any(w in lower for w in ("groceries", "supermarket", "blinkit", "zepto", "instamart")):
            category = "Groceries"
            tags = ["groceries"]
        elif any(w in lower for w in ("electricity", "wifi", "bill", "recharge", "airtel", "jio")):
            category = "Bills & Utilities"
            tags = ["utilities", "bills"]

        return {
            "vendor": vendor,
            "amount": amount,
            "currency": "INR",
            "category": category,
            "date": today,
            "tags": tags,
            "notes": text.strip()[:100],
        }

    def suggest_category_and_tags(self, vendor: str, amount: float, notes: str = "") -> dict[str, Any]:
        """Suggest appropriate category and tags for a given transaction."""
        client = self._get_client()
        if client and vendor:
            prompt = f"""
For an expense transaction with:
Vendor: {vendor}
Amount: ₹{amount}
Notes: {notes}

Choose the best category from: {', '.join(STANDARD_CATEGORIES)}
Suggest 2-3 relevant lowercase tags (e.g. coffee, groceries, commute, tech).

Return strictly JSON:
{{
  "category": "Chosen Category",
  "tags": ["tag1", "tag2"]
}}
"""
            try:
                res = client.generate_json(prompt, system_instruction="You are an expert expense classification assistant.")
                cat = res.get("category", "Other")
                if cat not in STANDARD_CATEGORIES:
                    cat = "Other"
                return {
                    "category": cat,
                    "tags": [re.sub(r'[^a-z0-9_-]', '', t.lower()) for t in res.get("tags", []) if t],
                }
            except Exception as e:
                logger.warning("AI suggestion error: %s", e)

        parsed = self._heuristic_text_parse(f"{vendor} {notes}", datetime.date.today().isoformat())
        return {"category": parsed["category"], "tags": parsed["tags"]}

    def analyze_receipt(
        self,
        image_bytes: bytes,
        mime_type: str,
        ocr_text: str = "",
    ) -> Optional[BillExtractionResult]:
        """Analyze receipt image using multimodal LLM vision."""
        client = self._get_client()
        if not client:
            return None

        today = datetime.date.today().isoformat()
        prompt = f"""
Inspect this receipt / invoice document image with precision.
Today's date is {today}. Allowed categories: {', '.join(STANDARD_CATEGORIES)}.

Extract:
1. Vendor / Merchant name.
2. Total final amount paid (numerical float).
3. Currency (INR, USD, EUR, etc. Default to INR if ₹ or unstated).
4. Date of transaction in YYYY-MM-DD format (use today's date if missing or illegible).
5. Most appropriate Category.
6. Line items (list of item descriptions and amounts if visible).
7. Relevant tags (e.g. ["groceries", "retail"]).

Return strictly a JSON object:
{{
  "vendor": "Merchant Name",
  "total_amount": 0.00,
  "currency": "INR",
  "date": "YYYY-MM-DD",
  "category": "Category",
  "items": ["Item 1", "Item 2"],
  "tags": ["tag1", "tag2"],
  "summary": "Brief 1-sentence note"
}}
"""
        try:
            data = client.analyze_image(
                image_bytes=image_bytes,
                mime_type=mime_type,
                prompt=prompt,
                system_instruction="You are a professional receipt extraction specialist.",
            )
            vendor = str(data.get("vendor", "Unknown Merchant")).strip().title()
            amount = float(data.get("total_amount") or data.get("amount") or 0.0)
            category = data.get("category", "Other")
            if category not in STANDARD_CATEGORIES:
                category = "Other"
            date = str(data.get("date", today)).strip()
            items = list(data.get("items", []))
            tags = [re.sub(r'[^a-z0-9_-]', '', t.lower()) for t in data.get("tags", []) if t]

            return BillExtractionResult(
                success=True,
                text=ocr_text or json.dumps(data),
                vendor=vendor,
                amount=amount,
                date=date,
                category=category,
                items=items,
                tags=tags,
            )
        except Exception as e:
            logger.error("LLM multimodal receipt analysis failed: %s", e)
            return None

    def compute_spending_velocity(self, expenses: list[Expense], budget: float) -> dict[str, Any]:
        """Compute spending pace, burn rate, and projected month-end utilization."""
        now = datetime.date.today()
        current_month_str = now.strftime("%Y-%m")
        _, total_days_in_month = calendar.monthrange(now.year, now.month)
        day_of_month = now.day
        days_remaining = max(1, total_days_in_month - day_of_month)

        month_expenses = [e for e in expenses if e.date.startswith(current_month_str)]
        total_spent = sum(e.amount for e in month_expenses)

        daily_burn_rate = total_spent / max(1, day_of_month)
        projected_spend = daily_burn_rate * total_days_in_month
        remaining_budget = budget - total_spent
        safe_daily_allowance = max(0.0, remaining_budget / days_remaining)

        pacing_ratio = (projected_spend / budget) if budget > 0 else 1.0

        if pacing_ratio <= 0.90:
            status = "safe"
            message = f"You are pacing comfortably under budget. Safe allowance is ₹{safe_daily_allowance:.0f}/day."
        elif pacing_ratio <= 1.05:
            status = "on_track"
            message = f"Pacing closely to your ₹{budget:,.0f} budget. Keep daily spending under ₹{safe_daily_allowance:.0f}."
        else:
            status = "danger"
            over_amount = projected_spend - budget
            message = f"At your current pace of ₹{daily_burn_rate:.0f}/day, you will exceed budget by ₹{over_amount:,.0f}."

        return {
            "total_spent": round(total_spent, 2),
            "budget": round(budget, 2),
            "remaining_budget": round(remaining_budget, 2),
            "daily_burn_rate": round(daily_burn_rate, 2),
            "projected_month_end": round(projected_spend, 2),
            "safe_daily_allowance": round(safe_daily_allowance, 2),
            "days_elapsed": day_of_month,
            "days_remaining": days_remaining,
            "pacing_percentage": round(pacing_ratio * 100, 1),
            "status": status,
            "message": message,
        }

    def detect_anomalies(self, expenses: list[Expense]) -> list[dict[str, Any]]:
        """Detect spending surges and abnormal transactions."""
        if not expenses:
            return []

        anomalies = []
        now = datetime.date.today()
        seven_days_ago = (now - datetime.timedelta(days=7)).isoformat()

        # 1. Check for single high transactions (> 3x average)
        amounts = [e.amount for e in expenses]
        avg_amount = sum(amounts) / len(amounts)

        recent_expenses = [e for e in expenses if e.date >= seven_days_ago]
        for e in recent_expenses:
            if e.amount > max(1500, avg_amount * 3):
                anomalies.append({
                    "type": "high_transaction",
                    "severity": "high",
                    "title": f"Unusually large transaction at {e.vendor}",
                    "amount": e.amount,
                    "date": e.date,
                    "description": f"₹{e.amount:,.2f} spent at {e.vendor} is significantly higher than your average transaction (₹{avg_amount:,.0f}).",
                    "category": e.category,
                })

        # 2. Category surges in the last 7 days vs previous 21 days
        cat_recent: dict[str, float] = {}
        for e in recent_expenses:
            cat_recent[e.category] = cat_recent.get(e.category, 0) + e.amount

        cat_prior: dict[str, float] = {}
        prior_expenses = [e for e in expenses if e.date < seven_days_ago]
        for e in prior_expenses:
            cat_prior[e.category] = cat_prior.get(e.category, 0) + e.amount

        # Normalize prior to 7-day average
        weeks_prior = max(1.0, len(expenses) / 15.0)
        for cat, recent_val in cat_recent.items():
            prior_weekly_avg = cat_prior.get(cat, 0) / weeks_prior
            if recent_val > 2000 and recent_val > (prior_weekly_avg * 1.5):
                pct_surge = round(((recent_val - prior_weekly_avg) / max(1.0, prior_weekly_avg)) * 100)
                anomalies.append({
                    "type": "category_surge",
                    "severity": "medium",
                    "title": f"Surge in {cat}",
                    "amount": recent_val,
                    "description": f"₹{recent_val:,.0f} spent on {cat} this week (+{pct_surge}% above typical weekly average).",
                    "category": cat,
                })

        return anomalies[:4]

    def detect_subscriptions(self, expenses: list[Expense]) -> list[dict[str, Any]]:
        """Identify potential recurring monthly charges and subscriptions."""
        vendor_records: dict[str, list[Expense]] = {}
        for e in expenses:
            vendor_records.setdefault(e.vendor.strip().lower(), []).append(e)

        subscriptions = []
        known_services = {
            "netflix", "spotify", "prime", "amazon prime", "youtube", "hotstar",
            "gym", "apple", "google", "icloud", "chatgpt", "openai", "github",
            "airtel", "jio", "swiggy one", "zomato gold", "electricity", "broadband"
        }

        for vendor_key, txs in vendor_records.items():
            is_known = any(k in vendor_key for k in known_services)
            # Either a known subscription service or has 2+ transactions with similar amounts
            if is_known or len(txs) >= 2:
                amounts = [t.amount for t in txs]
                avg_amt = sum(amounts) / len(amounts)
                # Check consistency
                consistent = all(abs(a - avg_amt) / max(1, avg_amt) < 0.25 for a in amounts)
                if is_known or consistent:
                    latest = max(txs, key=lambda t: t.date)
                    try:
                        latest_date = datetime.date.fromisoformat(latest.date)
                        next_renewal = (latest_date + datetime.timedelta(days=30)).isoformat()
                    except ValueError:
                        next_renewal = "Upcoming"

                    subscriptions.append({
                        "vendor": latest.vendor,
                        "amount": round(avg_amt, 2),
                        "category": latest.category,
                        "frequency": "Monthly",
                        "last_billed": latest.date,
                        "next_expected": next_renewal,
                        "total_spent_ytd": sum(amounts),
                        "count": len(txs),
                    })

        return sorted(subscriptions, key=lambda s: s["amount"], reverse=True)[:6]

    def generate_daily_digest(self, expenses: list[Expense]) -> dict[str, Any]:
        """Produce a concise narrative daily recap."""
        today_str = datetime.date.today().isoformat()
        yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

        today_txs = [e for e in expenses if e.date == today_str]
        yesterday_txs = [e for e in expenses if e.date == yesterday_str]

        today_total = sum(e.amount for e in today_txs)
        yesterday_total = sum(e.amount for e in yesterday_txs)

        top_expense = max(today_txs, key=lambda e: e.amount) if today_txs else None

        return {
            "date": today_str,
            "today_count": len(today_txs),
            "today_total": round(today_total, 2),
            "yesterday_total": round(yesterday_total, 2),
            "top_expense": {
                "vendor": top_expense.vendor,
                "amount": top_expense.amount,
                "category": top_expense.category,
            } if top_expense else None,
            "summary": (
                f"You have made {len(today_txs)} transaction(s) totaling ₹{today_total:,.2f} today."
                if today_txs
                else "No transactions recorded yet today. Clean slate!"
            ),
        }

    def generate_smart_tips(self, expenses: list[Expense], budget: float) -> list[dict[str, Any]]:
        """Generate high-impact, actionable financial tips."""
        client = self._get_client()

        # If LLM available, generate customized advice based on actual data
        if client and len(expenses) >= 2:
            summary_context = [
                f"{e.date}: {e.vendor} - ₹{e.amount} ({e.category})"
                for e in expenses[-15:]
            ]
            prompt = f"""
Analyze these recent transactions (Monthly Budget: ₹{budget:,.0f}):
{chr(10).join(summary_context)}

Provide 3 actionable, empathetic, and specific financial tips to save money or optimize spending.
Return strictly JSON matching:
{{
  "tips": [
    {{
      "title": "Short title (3-5 words)",
      "impact": "High | Medium | Low",
      "potential_savings": "₹XXX/mo",
      "advice": "1-2 sentences of actionable advice."
    }}
  ]
}}
"""
            try:
                res = client.generate_json(prompt, system_instruction="You are a personal financial advisor.")
                if res.get("tips") and isinstance(res["tips"], list):
                    return res["tips"][:3]
            except Exception as e:
                logger.warning("LLM smart tips generation error: %s", e)

        # Analytical rule-based tips fallback
        tips = []
        now = datetime.date.today()
        current_month = now.strftime("%Y-%m")
        month_expenses = [e for e in expenses if e.date.startswith(current_month)]

        # Category breakdown
        cat_totals: dict[str, float] = {}
        for e in month_expenses:
            cat_totals[e.category] = cat_totals.get(e.category, 0) + e.amount

        if cat_totals.get("Food & Dining", 0) > (budget * 0.3):
            tips.append({
                "title": "Dining Out Optimization",
                "impact": "High",
                "potential_savings": f"₹{cat_totals['Food & Dining'] * 0.25:,.0f}/mo",
                "advice": "Food & Dining takes over 30% of your budget. Swapping 1 dining out order per week for homemade meals can yield substantial savings.",
            })

        if len(expenses) > 5:
            tips.append({
                "title": "Review Recurring Subscriptions",
                "impact": "Medium",
                "potential_savings": "₹500 - ₹1,200/mo",
                "advice": "Audit recurring software, streaming, and gym memberships. Cancelling unused subscriptions keeps fixed overhead low.",
            })

        tips.append({
            "title": "Daily Spend Pacing",
            "impact": "Medium",
            "potential_savings": "Budget Buffer",
            "advice": "Track small discretionary transactions daily. Multiple minor spends often accumulate to 20-30% of monthly burn.",
        })

        return tips[:3]

    def get_bundled_insights(self) -> dict[str, Any]:
        """Aggregate velocity, anomalies, subscriptions, daily digest, and smart tips."""
        expenses = self.repo.get_all()
        budget = float(self.settings_service.repo.get_setting("monthly_budget", "15000"))

        velocity = self.compute_spending_velocity(expenses, budget)
        anomalies = self.detect_anomalies(expenses)
        subscriptions = self.detect_subscriptions(expenses)
        digest = self.generate_daily_digest(expenses)
        tips = self.generate_smart_tips(expenses, budget)

        return {
            "velocity": velocity,
            "anomalies": anomalies,
            "subscriptions": subscriptions,
            "digest": digest,
            "tips": tips,
            "active_provider": self.settings_service.get_active_provider(),
        }

    def chat_copilot(self, history: list[dict[str, str]], message: str) -> str:
        """Handle conversational query with live spending context injected."""
        client = self._get_client()
        if not client:
            return (
                "AI features are currently offline because no API key has been configured. "
                "Please open Settings to add your Google Gemini, OpenAI, or Anthropic API key."
            )

        expenses = self.repo.get_all()
        budget = float(self.settings_service.repo.get_setting("monthly_budget", "15000"))
        velocity = self.compute_spending_velocity(expenses, budget)

        now = datetime.date.today().isoformat()
        current_month = datetime.date.today().strftime("%Y-%m")
        month_expenses = [e for e in expenses if e.date.startswith(current_month)]

        # Category breakdown
        cat_totals: dict[str, float] = {}
        for e in month_expenses:
            cat_totals[e.category] = cat_totals.get(e.category, 0) + e.amount

        top_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:5]
        top_cats_str = ", ".join(f"{c}: ₹{amt:,.0f}" for c, amt in top_cats) if top_cats else "None"

        recent_txs = [
            f"{e.date} - {e.vendor}: ₹{e.amount:,.2f} ({e.category})"
            for e in expenses[-12:]
        ]
        recent_txs_str = chr(10).join(recent_txs) if recent_txs else "No recent transactions."

        system_instruction = f"""
You are PennyWise Copilot, a friendly, perceptive, and knowledgeable personal financial advisor.
Today is {now}. The user's currency is INR (₹).

User's Real-Time Financial Snapshot:
- Monthly Budget: ₹{budget:,.2f}
- Spent So Far This Month: ₹{velocity['total_spent']:,.2f}
- Remaining Budget: ₹{velocity['remaining_budget']:,.2f}
- Daily Burn Rate: ₹{velocity['daily_burn_rate']:,.2f}/day (Safe allowance: ₹{velocity['safe_daily_allowance']:,.2f}/day)
- Budget Pace Status: {velocity['status']} ({velocity['pacing_percentage']}% of target)
- Top Categories: {top_cats_str}

Recent 12 Transactions:
{recent_txs_str}

Guidelines:
1. Always reference the user's actual spending data when answering.
2. Be encouraging, concise, and direct with numbers.
3. Suggest practical ways to improve their financial health without sounding judgmental.
4. Format responses cleanly using markdown bullet points and bold currency amounts.
"""
        try:
            return client.chat(history=history, message=message, system_instruction=system_instruction)
        except Exception as e:
            logger.error("Copilot chat generation failed: %s", e)
            return f"I encountered an issue connecting to the AI provider: {e}. Please check your API key in Settings."
