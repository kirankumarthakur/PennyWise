"""Vendor and line item extraction from bill and receipt text."""

import re
import logging
from typing import List

logger = logging.getLogger(__name__)


class VendorExtractor:
    """Extracts merchant/vendor entity information and line items from document text."""

    EXACT_BRANDS = [
        "allen solly", "van heusen", "louis philippe", "peter england", "arrow",
        "raymond", "zara", "h&m", "uniqlo", "nike", "adidas", "puma", "reebok",
        "westside", "max fashion", "pantaloons", "big bazaar",
        "reliance trends", "shoppers stop", "central", "brand factory",
        "poorvika", "croma", "reliance digital", "vijay sales", "samsung",
        "apple store", "mi store", "oneplus", "oppo", "vivo", "realme",
        "flipkart", "amazon", "starbucks", "mcdonalds", "kfc", "dominos",
        "swiggy", "zomato", "uber", "ola"
    ]

    VENDOR_PATTERNS = [
        r"Supplier[:\s]+(.+)",
        r"Vendor[:\s]+(.+)",
        r"Company[:\s]+(.+)",
        r"([A-Z][a-z]+ (?:SOFTWARE|LABS|PVT|LTD|INC|CORP|COMPANY|TOOLS|FREIGHT|INDUSTRIES|ENTERPRISES).+)",
        r"([A-Z][A-Za-z\s]+ (?:Pvt\.?\s*Ltd\.?|Inc\.?|Corp\.?|Tools|Freight))",
    ]

    SKIP_WORDS = [
        "tax invoice", "receipt", "bill no", "date:", "time:", "gstin", "pan:",
        "address:", "phone:", "email:", "web:", "customer", "store id", "till:"
    ]

    COMPANY_INDICATORS = [
        "limited", "pvt", "ltd", "inc", "corp", "labs", "software", "tools",
        "freight", "industries", "enterprises", "manufacturing", "supply", "services", "brands"
    ]

    def extract_vendor(self, text: str) -> str:
        """Extract vendor name using pattern matching, brand dictionaries, and header heuristics."""
        lines = text.split("\n")
        vendor_candidates: List[str] = []

        # 1. Regex pattern matches
        for pattern in self.VENDOR_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                vendor_candidates.extend(matches)

        # 2. Header analysis (first 8 lines)
        for i, line in enumerate(lines[:8]):
            clean_line = line.strip()
            if len(clean_line) <= 3 or re.match(r"^\d+$", clean_line):
                continue

            lower_line = clean_line.lower()
            if any(skip in lower_line for skip in self.SKIP_WORDS):
                continue

            if clean_line.isupper() and len(clean_line) > 5:
                vendor_candidates.append(clean_line)
            elif any(ind in lower_line for ind in self.COMPANY_INDICATORS):
                vendor_candidates.append(clean_line)
            elif i <= 2 and len(clean_line) > 10:
                vendor_candidates.append(clean_line)

        if not vendor_candidates:
            logger.info("No vendor name candidate found.")
            return "Unknown Vendor"

        # Prioritize exact brand matches
        for candidate in vendor_candidates:
            cand_clean = candidate.lower().strip()
            for brand in self.EXACT_BRANDS:
                if cand_clean == brand or cand_clean.replace(" ", "") == brand.replace(" ", ""):
                    return candidate.strip()

        # Check for brand containment
        for candidate in vendor_candidates:
            for brand in self.EXACT_BRANDS:
                if brand in candidate.lower():
                    return brand.title()

        # Corporate indicators
        for candidate in vendor_candidates:
            if any(kw in candidate.upper() for kw in ["LIMITED", "BRANDS"]):
                return candidate.strip()

        # All-caps header
        for candidate in vendor_candidates:
            if candidate.isupper() and len(candidate) > 5:
                return candidate.strip()

        for candidate in vendor_candidates:
            if any(ind in candidate.lower() for ind in ["pvt", "ltd", "labs", "tools", "freight", "manufacturing"]):
                return candidate.strip()

        return vendor_candidates[0].strip()

    def extract_items(self, text: str) -> List[str]:
        """Extract individual item lines that combine text with amounts."""
        lines = text.split("\n")
        items: List[str] = []

        for line in lines:
            line_str = line.strip()
            if re.search(r"[a-zA-Z]", line_str) and re.search(r"\d+\.?\d*", line_str):
                lower_str = line_str.lower()
                if not any(skip in lower_str for skip in ["total", "subtotal", "tax", "receipt", "thank you", "gst"]):
                    items.append(line_str)

        return items
