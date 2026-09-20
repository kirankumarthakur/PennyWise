"""Date entity extraction and normalization from bill text."""

import re
import logging
from datetime import datetime
from typing import List, Dict, Any
import dateutil.parser as date_parser

logger = logging.getLogger(__name__)


class DateExtractor:
    """Extracts and normalizes transaction dates from invoice and receipt text."""

    DATE_PATTERNS = [
        r"(?:invoice\s+date|bill\s+date|date)\s*[:]\s*(\d{2}/\d{2}/\d{4})",
        r"(?:invoice\s+date|bill\s+date|date)\s*[:]\s*([a-zA-Z]+\s+\d{1,2},?\s+\d{4})",
        r"(\d{4}-\d{2}-\d{2})",
        r"(?:invoice\s+date|bill\s+date|date)[:\s]*(\d{4}-\d{2}-\d{2})",
        r"(?:invoice\s+date|bill\s+date|date)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})",
        r"(?:invoice\s+date|bill\s+date|date)[:\s]*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})",
        r"(?:dated)[:\s]*(\d{4}-\d{2}-\d{2})",
        r"(?:dated)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})",
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{4})",
        r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})",
        r"(\d{2}/\d{2}/\d{4})",
        r"(00/\d{2}/\d{4})",
        r"(\d{1,2}/\d{1,2}/\d{4})",
        r"(\d{1,2}-\d{1,2}-\d{4})",
    ]

    DATE_KEYWORDS = ["date:", "invoice date:", "bill date:", "dated:", "on:"]

    def extract_date(self, text: str) -> str:
        """Extract the most plausible transaction date formatted as YYYY-MM-DD."""
        dates: List[Dict[str, Any]] = []
        found_dates_set = set()
        current_year = datetime.now().year
        current_date_str = datetime.now().strftime("%Y-%m-%d")

        lines = text.split("\n")
        for line in lines:
            line_lower = line.lower()
            has_date_keyword = any(kw in line_lower for kw in self.DATE_KEYWORDS)

            for i, pattern in enumerate(self.DATE_PATTERNS):
                matches = re.findall(pattern, line, re.IGNORECASE)
                for match in matches:
                    if match in found_dates_set:
                        continue

                    try:
                        cleaned_match = match
                        # Correct common OCR anomaly where leading day digit '00' appears
                        if cleaned_match.startswith("00/"):
                            cleaned_match = cleaned_match.replace("00/", "10/", 1)
                            logger.debug("Corrected OCR day corruption: %s -> %s", match, cleaned_match)

                        # Parse candidate date
                        parsed_date = None
                        if re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", cleaned_match):
                            try:
                                parsed_date = datetime.strptime(cleaned_match, "%d/%m/%Y")
                            except ValueError:
                                try:
                                    parsed_date = datetime.strptime(cleaned_match, "%m/%d/%Y")
                                except ValueError:
                                    parsed_date = date_parser.parse(cleaned_match, fuzzy=True)
                        else:
                            parsed_date = date_parser.parse(cleaned_match, fuzzy=True)

                        if parsed_date.year < 1990 or parsed_date.year > current_year + 1:
                            continue

                        formatted_date = parsed_date.strftime("%Y-%m-%d")
                        if formatted_date in [d["date"] for d in dates]:
                            continue

                        # Confidence scoring
                        confidence = 2.0 if has_date_keyword else 1.0
                        if i == 0:
                            confidence += 3.0
                        elif i == 1:
                            confidence += 1.0

                        if parsed_date.year >= current_year - 10:
                            confidence += 0.5

                        found_dates_set.add(match)
                        dates.append({
                            "date": formatted_date,
                            "raw_text": match,
                            "confidence": confidence,
                            "parsed_date": parsed_date,
                        })

                    except (ValueError, TypeError):
                        continue

        if not dates:
            logger.info("No explicit date identified; defaulting to current date %s", current_date_str)
            return current_date_str

        dates.sort(key=lambda x: x["confidence"], reverse=True)
        best_date = dates[0]

        if best_date["parsed_date"].year > current_year + 1 or best_date["parsed_date"].year < 1990:
            return current_date_str

        logger.info("Selected extracted date: %s (confidence: %.2f)", best_date["date"], best_date["confidence"])
        return best_date["date"]
