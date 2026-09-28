"""Test runner using standard library unittest."""

import unittest
import json
from backend.app import create_app
from backend.extractors.date_extractor import DateExtractor
from backend.extractors.amount_extractor import AmountExtractor
from backend.extractors.vendor_extractor import VendorExtractor


from pathlib import Path
from backend.config import AppConfig

class TestPennyWiseBackend(unittest.TestCase):
    TEST_DB_PATH = Path("test_pennywise.db")

    def setUp(self):
        class TestConfig(AppConfig):
            SQLITE_DB_PATH = TestPennyWiseBackend.TEST_DB_PATH

        self.app = create_app(TestConfig)
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def tearDown(self):
        if self.TEST_DB_PATH.exists():
            try:
                self.TEST_DB_PATH.unlink()
            except Exception:
                pass

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("model_loaded", data)
        self.assertIn("expenses_count", data)

    def test_expense_crud_and_analytics(self):
        # 1. Create expense
        new_expense = {
            "vendor": "Starbucks Coffee",
            "amount": 350.50,
            "currency": "INR",
            "category": "Food & Dining",
            "date": "2026-09-28",
            "items": ["Caramel Macchiato", "Croissant"]
        }
        create_res = self.client.post("/api/expenses", json=new_expense)
        self.assertEqual(create_res.status_code, 201)
        create_data = create_res.get_json()
        self.assertTrue(create_data["success"])
        expense_id = create_data["expense"]["id"]

        # 2. Get expenses list
        get_res = self.client.get("/api/expenses")
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.get_json()
        self.assertTrue(get_data["success"])
        self.assertGreaterEqual(get_data["total"], 1)

        # 3. Filter by category
        filter_res = self.client.get("/api/expenses?category=Food%20%26%20Dining")
        self.assertEqual(filter_res.status_code, 200)
        filter_data = filter_res.get_json()
        self.assertTrue(any(e["id"] == expense_id for e in filter_data["expenses"]))

        # 4. Analytics
        analytics_res = self.client.get("/api/analytics")
        self.assertEqual(analytics_res.status_code, 200)
        analytics_data = analytics_res.get_json()
        self.assertTrue(analytics_data["success"])
        self.assertGreaterEqual(analytics_data["totalExpenses"], 350.50)

        # 5. Delete expense
        del_res = self.client.delete(f"/api/expenses/{expense_id}")
        self.assertEqual(del_res.status_code, 200)
        del_data = del_res.get_json()
        self.assertTrue(del_data["success"])

    def test_categorize_expense_endpoint(self):
        res = self.client.post("/api/categorize-expense", json={
            "description": "Domino's Pizza order",
            "amount": 599.0
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["category"], "Food & Dining")

    def test_extractors(self):
        # DateExtractor
        date_ext = DateExtractor()
        extracted_date = date_ext.extract_date("Tax Invoice\nDate: 15/08/2026\nCustomer: John")
        self.assertEqual(extracted_date, "2026-08-15")

        # AmountExtractor
        amt_ext = AmountExtractor()
        sample_receipt = """
        XYZ Store
        Item 1: 150.00
        Item 2: 250.00
        Grand Total: INR 400.00
        GSTIN: 29AAAAA0000A1Z5
        """
        amounts, currency = amt_ext.extract_amounts(sample_receipt)
        self.assertEqual(currency, "INR")
        self.assertGreater(len(amounts), 0)
        self.assertEqual(amounts[0], 400.0)

        # VendorExtractor
        vendor_ext = VendorExtractor()
        vendor = vendor_ext.extract_vendor("Welcome to Allen Solly Store\nDate: 2026-09-28\nItem: Shirt")
        self.assertEqual(vendor, "Allen Solly")

    def test_clear_expenses_endpoint(self):
        # Add an expense first
        self.client.post("/api/expenses", json={
            "vendor": "Test Vendor",
            "amount": 100.0,
            "category": "Miscellaneous",
            "date": "2026-09-28"
        })
        res = self.client.delete("/api/expenses/clear")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["success"])

        get_res = self.client.get("/api/expenses")
        self.assertEqual(get_res.get_json()["total"], 0)

    def test_fix_dates_endpoint(self):
        self.client.post("/api/expenses", json={
            "vendor": "Test Vendor",
            "amount": 100.0,
            "category": "Miscellaneous",
            "date": "2025-10-06"
        })
        res = self.client.post("/api/fix-dates")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["updated_count"], 1)

    def test_process_bill_image_endpoint(self):
        import io
        import base64
        from PIL import Image, ImageDraw

        # 1. Blank image returns success=False
        blank_img = Image.new("RGB", (200, 100), color=(255, 255, 255))
        buf_blank = io.BytesIO()
        blank_img.save(buf_blank, format="PNG")
        enc_blank = base64.b64encode(buf_blank.getvalue()).decode("utf-8")
        res_blank = self.client.post("/api/process-bill", json={"image_data": enc_blank})
        self.assertFalse(res_blank.get_json()["success"])

        # 2. Image with text
        img = Image.new("RGB", (400, 200), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((20, 20), "Starbucks Coffee\nGrand Total: 250.00\nDate: 2026-09-28", fill=(0, 0, 0))
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        encoded_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

        res = self.client.post("/api/process-bill", json={"image_data": encoded_image})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["amount"], 250.0)
        self.assertEqual(data["vendor"], "Starbucks")


if __name__ == "__main__":
    unittest.main()
