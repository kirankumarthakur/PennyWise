"""Monetary amount entity extraction and currency detection from bill text."""

import re
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)


class AmountExtractor:
    """Extracts monetary values, prioritizes total bill amounts, and detects currency."""

    BAD_CONTEXT_KEYWORDS = [
        "gstin", "gst", "tax", "pan", "cin", "ph:", "phone", "mobile",
        "email", "uid:", "invoice no", "invoice mo", "receipt no",
        "bill no", "order no", "@", ".com", "www.", "http"
    ]

    WORD_TO_NUM = {
        "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
        "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
        "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
        "eighty": 80, "ninety": 90, "hundred": 100, "thousand": 1000
    }

    def detect_currency(self, text: str) -> str:
        """Detect currency symbol or code from document text."""
        text_upper = text.upper()
        if any(keyword in text_upper for keyword in ["INR", "₹", "RUPEES", "RS."]):
            return "INR"
        elif any(keyword in text_upper for keyword in ["USD", "$", "DOLLARS"]):
            return "USD"
        return "INR"

    def is_amount_in_bad_context(self, text: str, amount_str: str) -> bool:
        """Verify whether an amount matches non-monetary identifiers like tax/phone IDs."""
        escaped_amount = re.escape(str(amount_str))
        context_pattern = f".{{0,50}}{escaped_amount}.{{0,50}}"

        context_matches = re.findall(context_pattern, text, re.IGNORECASE)
        for context in context_matches:
            context_lower = context.lower()
            if any(indicator in context_lower for indicator in self.BAD_CONTEXT_KEYWORDS):
                logger.debug("Skipping amount %s in non-financial context: %s", amount_str, context.strip())
                return True
        return False

    def parse_words_to_number(self, text: str) -> float:
        """Convert English number words into float values."""
        try:
            tokens = text.lower().replace("_", " ").replace("-", " ").split()
            total = 0
            current = 0
            for token in tokens:
                word = token.strip(".,")
                if word in self.WORD_TO_NUM:
                    val = self.WORD_TO_NUM[word]
                    if val == 100:
                        current *= 100
                    elif val == 1000:
                        total += current * 1000
                        current = 0
                    else:
                        current += val
            return float(total + current)
        except Exception:
            return 0.0

    def extract_amounts(self, text: str) -> Tuple[List[float], str]:
        """Extract monetary amounts ordered by priority/confidence and detected currency."""
        currency = self.detect_currency(text)
        candidates: List[Tuple[float, int]] = []  # (amount, priority)

        lines = text.split("\n")
        amount_patterns = [
            r"INR\s*([0-9,]+\.?[0-9]*)",
            r"₹\s*([0-9,]+\.?[0-9]*)",
            r"Rs\.?\s*([0-9,]+\.?[0-9]*)",
            r"(?:grand\s+total|final\s+total|payable\s+amount)[:\s]+.*?(?:INR|₹|Rs\.?)\s*([0-9,]+\.?[0-9]*)",
            r"(?:grand\s+total|final\s+total|payable\s+amount)[:\s]+([0-9,]+\.?[0-9]*)",
            r"(?:total|amount|invoice\s+amount|bill\s+amount|net\s+total)[:\s]+.*?(?:INR|₹|Rs\.?)\s*([0-9,]+\.?[0-9]*)",
            r"(?:total|amount|invoice\s+amount|bill\s+amount|net\s+total)[:\s]+([0-9,]+\.?[0-9]*)",
            r"^.*(?:grand\s+total|final\s+total|payable).*?([0-9,]+\.?[0-9]*).*$",
            r"^.*grand.*?([0-9]+).*$",
            r"^.*(?:total|amount).*?([0-9,]+\.[0-9]{2}).*$",
            r"^.*([0-9,]+\.[0-9]{2}).*(?:INR|₹|Rs|total|amount).*$",
            r"([0-9]{1,2},[0-9]{3}\.[0-9]{2})",
            r"([0-9]{1,3},[0-9]{3})",
            r"([0-9]+\.[0-9]{2})(?=\s*(?:INR|₹|Rs|\s*$))",
            r"([0-9]{2,4})(?=\s*$)",
            r"\$\s*([0-9,]+\.?[0-9]*)",
            r"USD\s*([0-9,]+\.?[0-9]*)",
        ]

        # 1. Line-by-line pattern matching
        for line in lines:
            line_clean = line.strip()
            if not line_clean:
                continue

            line_lower = line_clean.lower()
            if any(skip in line_lower for skip in ["ph:", "phone:", "tel:", "gst no", "gstin:", "pan:", "cin:", "bill no"]):
                continue

            if re.match(r"^[A-Z][0-9]{2,4}$", line_clean):
                continue

            priority = 0
            if any(kw in line_lower for kw in ["invoice amount", "invoice total"]):
                priority = 5
            elif any(kw in line_lower for kw in ["grand total", "final total", "payable amount"]):
                priority = 4
            elif "grand" in line_lower and any(c.isdigit() for c in line_clean):
                priority = 4
            elif any(kw in line_lower for kw in ["net total", "amount payable"]):
                priority = 3
            elif any(kw in line_lower for kw in ["total", "amount", "invoice", "bill", "subtotal", "sum"]):
                priority = 2

            for pattern in amount_patterns:
                for match in re.findall(pattern, line_clean, re.IGNORECASE | re.MULTILINE):
                    try:
                        clean_match = str(match).replace(",", "")
                        if clean_match and float(clean_match) > 0:
                            amt = float(clean_match)
                            if 1 <= amt <= 10000000:
                                candidates.append((amt, priority))
                    except (ValueError, TypeError):
                        continue

        # 2. Heuristic OCR fixes
        ocr_fixes = [
            (r"f([0-9,]+\s*[0-9]{3}\.?[0-9]*)", r"\1"),
            (r"([0-9,]+)\s*([0-9]{3})\.([0-9]{2})", r"\1\2.\3"),
        ]
        for pattern, replacement in ocr_fixes:
            for match in re.findall(pattern, text):
                try:
                    val_str = ("".join(match) if isinstance(match, tuple) else str(match)).replace(",", "").replace(" ", "")
                    amt = float(val_str)
                    if 1000 <= amt <= 50000:
                        candidates.append((amt, 2))
                except (ValueError, TypeError):
                    continue

        # 3. Contextual smart patterns
        smart_patterns = [
            (r"(?:invoice\s+amount|invoice\s+total|total\s+amount|grand\s+total|final\s+total)\s*[:\-\s]*([0-9,]{3,}(?:\.[0-9]{2})?)", 5),
            (r"(?:total|amount|rupees|rs\.?|₹)\s*[:\-\s]*([0-9,]{3,}(?:\.[0-9]{2})?)", 4),
            (r"([0-9,]{3,}(?:\.[0-9]{2})?)\s*(?:only|rupees|rs\.?)", 3),
        ]
        for pattern, priority in smart_patterns:
            for match in re.findall(pattern, text, re.IGNORECASE):
                try:
                    amt_str = str(match).replace(",", "")
                    amt = float(amt_str)
                    if not self.is_amount_in_bad_context(text, match) and 1000 <= amt <= 100000:
                        candidates.append((amt, priority))
                except (ValueError, TypeError):
                    continue

        # 4. Amount written in words
        words_patterns = [
            r"amount.*?in.*?words?.*?([a-zA-Z\s_-]+?)(?:\n|$)",
            r"(?:three|four|five|six|seven|eight|nine|ten).*?(?:thousand|hundred).*?(?:hundred|rupees|only)",
        ]
        for pattern in words_patterns:
            for match in re.findall(pattern, text, re.IGNORECASE | re.MULTILINE):
                amt_words = self.parse_words_to_number(match)
                if 100 <= amt_words <= 100000:
                    candidates.append((amt_words, 3))

        # Order candidates by priority descending, then amount descending
        candidates.sort(key=lambda x: (x[1], x[0]), reverse=True)

        # De-duplicate preserving priority order
        unique_amounts: List[float] = []
        seen = set()
        for amt, _ in candidates:
            if amt not in seen:
                seen.add(amt)
                unique_amounts.append(amt)

        logger.info("Extracted %d unique amounts. Currency: %s. Top candidate: %s",
                    len(unique_amounts), currency, unique_amounts[0] if unique_amounts else None)
        return unique_amounts, currency
