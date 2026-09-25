"""Expense categorization service with machine learning and rule-based heuristics."""

import re
import json
import logging
import pickle
import numpy as np
import pandas as pd
from typing import Optional, List, Dict
from scipy.sparse import hstack
from backend.config import AppConfig

logger = logging.getLogger(__name__)


class CategorizationService:
    """Classifies expense notes and amounts using an ensemble ML model with rule-based heuristics fallback."""

    KEYWORD_CATEGORIES = {
        "food": ["food", "restaurant", "chicken", "pizza", "meal", "dining", "naan", "curry", "biryani", "angara"],
        "transport": ["taxi", "auto", "fuel", "parking", "uber", "transport", "gas", "metro"],
        "bills": ["bill", "electric", "electricity", "internet", "phone", "subscription", "utility"],
        "shopping": ["shopping", "amazon", "store", "clothes", "electronics", "mall"],
        "health": ["hospital", "doctor", "medical", "health", "pharmacy", "clinic"],
        "entertainment": ["movie", "game", "entertainment", "netflix", "cinema"],
        "tools": [
            "tool", "tools", "equipment", "hardware", "saw", "hammer", "drill", "wrench",
            "stanley", "bosch", "makita", "precision", "manufacturing", "workshop", "machinery"
        ],
        "business": ["business", "office", "consulting", "professional", "service", "company"],
    }

    def __init__(
        self,
        model_path: Optional[str] = None,
        tfidf_path: Optional[str] = None,
        scaler_path: Optional[str] = None,
        info_path: Optional[str] = None,
    ):
        self.model_path = model_path or AppConfig.EXPENSE_MODEL_PATH
        self.tfidf_path = tfidf_path or AppConfig.TFIDF_VECTORIZER_PATH
        self.scaler_path = scaler_path or AppConfig.FEATURE_SCALER_PATH
        self.info_path = info_path or AppConfig.MODEL_INFO_PATH

        self.model = None
        self.tfidf = None
        self.scaler = None
        self.categories: List[str] = []

        self._load_artifacts()

    def _load_artifacts(self) -> None:
        """Load serialized ML artifacts if available."""
        try:
            if not self.model_path.exists():
                logger.warning("Expense model not found at %s", self.model_path)
                return

            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)

            if self.tfidf_path.exists() and self.scaler_path.exists():
                with open(self.tfidf_path, "rb") as f:
                    self.tfidf = pickle.load(f)
                with open(self.scaler_path, "rb") as f:
                    self.scaler = pickle.load(f)

            if self.info_path.exists():
                with open(self.info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
                    self.categories = info.get("categories", [])

            logger.info("Loaded ML model artifacts successfully with %d categories.", len(self.categories))
        except Exception as e:
            logger.error("Failed to load machine learning artifacts: %s", e)
            self.model = None
            self.tfidf = None
            self.scaler = None
            self.categories = []

    def is_model_loaded(self) -> bool:
        """Check if ML model is active."""
        return self.model is not None

    def _clean_text(self, text: str) -> str:
        """Normalize text representation."""
        text = str(text).lower()
        text = re.sub(r"[^\w\s]", " ", text)
        return " ".join(text.split())

    def _get_amount_range(self, amount: float) -> int:
        """Bin amounts into categorical range tiers."""
        if amount < 50:
            return 0
        elif amount < 200:
            return 1
        elif amount < 500:
            return 2
        elif amount < 1000:
            return 3
        elif amount < 5000:
            return 4
        return 5

    def _extract_numeric_features(self, note: str, note_clean: str, amount: float) -> pd.DataFrame:
        """Extract exact 22 numeric features expected by scaler."""
        now = pd.Timestamp.now()

        data: Dict[str, float | int] = {
            "Amount": amount,
            "LogAmount": np.log1p(amount),
            "AmountRange": self._get_amount_range(amount),
            "TextLength": len(note_clean),
            "WordCount": len(note_clean.split()),
            "UpperCaseRatio": sum(1 for c in note if c.isupper()) / len(note) if note else 0.0,
            "DigitRatio": sum(1 for c in note if c.isdigit()) / len(note) if note else 0.0,
        }

        # Keyword counts
        note_lower = note_clean.lower()
        for cat_name, keywords in self.KEYWORD_CATEGORIES.items():
            data[f"{cat_name}_keywords"] = sum(1 for kw in keywords if kw in note_lower)

        # Pattern indicators
        data["HasAmountPattern"] = 1 if re.search(r"\d+\s*(rs|rupees|inr|\$)", note.lower()) else 0
        data["HasTimePattern"] = 1 if re.search(r"\d{1,2}:\d{2}", note) else 0
        data["HasPlacePattern"] = 1 if re.search(r"place\s+\d+", note.lower()) else 0

        # Temporal indicators
        data["DayOfWeek"] = now.dayofweek
        data["Month"] = now.month
        data["Day"] = now.day
        data["IsWeekend"] = 1 if now.dayofweek >= 5 else 0
        data["IsMonthEnd"] = 1 if now.day >= 25 else 0
        data["IsMonthStart"] = 1 if now.day <= 5 else 0

        feature_order = [
            "Amount", "LogAmount", "AmountRange", "TextLength", "WordCount",
            "UpperCaseRatio", "DigitRatio", "food_keywords", "transport_keywords",
            "bills_keywords", "shopping_keywords", "health_keywords",
            "entertainment_keywords", "HasAmountPattern", "HasTimePattern",
            "HasPlacePattern", "DayOfWeek", "Month", "Day", "IsWeekend", "IsMonthEnd",
            "IsMonthStart"
        ]

        return pd.DataFrame([[data[f] for f in feature_order]], columns=feature_order)

    def categorize(self, description: str, amount: float) -> str:
        """Categorize expense using rule-based heuristics first, ML model second."""
        rule_category = self._categorize_rule_based(description, amount)
        if rule_category != "Miscellaneous":
            return rule_category

        if self.is_model_loaded() and self.tfidf and self.scaler:
            try:
                note_clean = self._clean_text(description)
                text_features = self.tfidf.transform([note_clean])
                numeric_df = self._extract_numeric_features(description, note_clean, amount)
                numeric_scaled = self.scaler.transform(numeric_df)
                x_combined = hstack([text_features, numeric_scaled])

                pred_index = self.model.predict(x_combined)[0]
                if self.categories and 0 <= int(pred_index) < len(self.categories):
                    ml_category = self.categories[int(pred_index)]
                    logger.debug("ML predicted category: %s", ml_category)
                    return ml_category
            except Exception as e:
                logger.error("Error during ML categorization prediction: %s", e)

        return rule_category

    def _categorize_rule_based(self, description: str, amount: float) -> str:
        """Deterministic keyword and regex heuristic classifier."""
        desc_lower = description.lower()

        # Maintenance & Repair
        maintenance_patterns = [
            r"\bmaintenance\b", r"\brepair\b", r"\brepairs\b", r"\bservic(?:e|ing)\b",
            r"\bworkshop\b", r"\bgarage\b", r"\bmechanic\b", r"\binstallation\b",
            r"\bplumber\b", r"\belectrician\b", r"\boverhaul\b", r"\breplacement\b"
        ]
        if any(re.search(pat, desc_lower) for pat in maintenance_patterns):
            return "Maintenance"

        # Electronics & Technology Shopping
        electronics_stores = [
            "poorvika", "croma", "reliance digital", "vijay sales", "samsung", "apple store",
            "mi store", "oneplus", "oppo", "vivo", "realme", "dell", "hp", "lenovo", "asus"
        ]
        if any(store in desc_lower for store in electronics_stores):
            return "Shopping"

        electronics_items = [
            "mobile", "phone", "smartphone", "tablet", "laptop", "computer", "pc",
            "headphone", "earphone", "speaker", "charger", "adapter", "cable", "usb",
            "smartwatch", "tv", "monitor", "keyboard", "mouse", "ssd", "gadget"
        ]
        if any(item in desc_lower for item in electronics_items):
            return "Shopping"

        # Tools & Equipment
        tool_keywords = [
            "hammer", "saw", "drill", "screwdriver", "wrench", "pliers", "caliper",
            "stanley", "bosch", "makita", "dewalt", "precision tool", "power tool"
        ]
        if sum(1 for kw in tool_keywords if kw in desc_lower) >= 2 or any(
            b in desc_lower for b in ["stanley", "bosch", "makita", "dewalt"]
        ):
            return "Tools"

        # Food & Dining
        food_dishes = [
            "chicken", "fish", "mutton", "beef", "pork", "paneer", "dal", "curry",
            "biryani", "naan", "roti", "paratha", "rice", "pasta", "pizza", "burger",
            "sandwich", "angara", "masala", "tandoori"
        ]
        food_terms = [
            "restaurant", "cafe", "dining", "kitchen", "meal", "breakfast", "lunch",
            "dinner", "snack", "beverage", "bakery", "supermarket"
        ]
        if any(dish in desc_lower for dish in food_dishes) or sum(1 for kw in food_terms if kw in desc_lower) >= 2:
            return "Food & Dining"

        # Clothing & Apparel
        apparel_brands = [
            "allen solly", "aditya birla", "raymond", "arrow", "van heusen",
            "louis philippe", "peter england", "zara", "h&m", "uniqlo", "nike", "adidas", "puma"
        ]
        apparel_items = [
            "shirt", "trouser", "pant", "duffel bag", "bag", "clothing",
            "apparel", "dress", "jacket", "blazer", "shoes", "socks"
        ]
        if any(brand in desc_lower for brand in apparel_brands) or any(item in desc_lower for item in apparel_items):
            return "Shopping"

        # General shopping
        if any(w in desc_lower for w in ["store", "shop", "mall", "amazon", "flipkart", "retail", "purchase"]):
            return "Shopping"

        # Transportation
        transport_terms = [
            "uber", "ola", "taxi", "cab fare", "bus ticket", "train ticket", "metro",
            "parking fee", "toll plaza", "petrol", "diesel", "fuel", "rickshaw"
        ]
        if any(term in desc_lower for term in transport_terms):
            return "Transportation"

        # Entertainment
        if any(w in desc_lower for w in ["movie", "theater", "cinema", "netflix", "concert", "game", "show"]):
            return "Entertainment"

        # Bills & Utilities
        utility_terms = [
            "electric bill", "electricity", "water bill", "gas bill", "internet bill",
            "phone bill", "mobile bill", "broadband", "utility", "subscription"
        ]
        if any(w in desc_lower for w in utility_terms) and not any(dish in desc_lower for dish in food_dishes):
            return "Bills & Utilities"

        # Healthcare
        if any(w in desc_lower for w in ["hospital", "doctor", "pharmacy", "medical", "clinic", "medicine"]):
            return "Healthcare"

        # Education
        if any(w in desc_lower for w in ["school", "college", "university", "tuition", "course", "exam", "books"]):
            return "Education"

        # Business Services
        if any(w in desc_lower for w in ["consulting", "legal", "accounting", "audit", "software labs", "it services"]):
            return "Business Services"

        if amount > 10000:
            return "Business Services"

        return "Miscellaneous"
