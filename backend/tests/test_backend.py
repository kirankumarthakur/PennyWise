"""Integration and unit tests for PennyWise backend."""

import pytest
import json
from backend.app import create_app
from backend.models.expense import Expense, ExpenseFilter
from backend.repositories.memory import InMemoryExpenseRepository
from backend.services.expense_service import ExpenseService
from backend.extractors.date_extractor import DateExtractor
from backend.extractors.amount_extractor import AmountExtractor
from backend.extractors.vendor_extractor import VendorExtractor


@pytest.fixture
def app():
    """Create test application."""
    test_app = create_app()
    test_app.config["TESTING"] = True
    return test_app


@pytest.fixture
def client(app):
    """Test client."""
    return app.test_client()


def test_health_endpoint(client):
    """Verify /api/health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert "model_loaded" in data
    assert "expenses_count" in data


def test_expense_crud(client):
    """Verify expense creation, retrieval, filtering, and deletion."""
    # 1. Create expense
    new_expense = {
        "vendor": "Starbucks Coffee",
        "amount": 350.50,
        "currency": "INR",
        "category": "Food & Dining",
        "date": "2026-09-28",
        "items": ["Caramel Macchiato", "Croissant"]
    }
    create_res = client.post("/api/expenses", json=new_expense)
    assert create_res.status_code == 201
    create_data = create_res.get_json()
    assert create_data["success"] is True
    expense_id = create_data["expense"]["id"]

    # 2. Get expenses list
    get_res = client.get("/api/expenses")
    assert get_res.status_code == 200
    get_data = get_res.get_json()
    assert get_data["success"] is True
    assert get_data["total"] >= 1
    matched = [e for e in get_data["expenses"] if e["id"] == expense_id]
    assert len(matched) == 1
    assert matched[0]["vendor"] == "Starbucks Coffee"

    # 3. Filter by category
    filter_res = client.get("/api/expenses?category=Food%20%26%20Dining")
    assert filter_res.status_code == 200
    filter_data = filter_res.get_json()
    assert any(e["id"] == expense_id for e in filter_data["expenses"])

    # 4. Analytics
    analytics_res = client.get("/api/analytics")
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.get_json()
    assert analytics_data["success"] is True
    assert analytics_data["totalExpenses"] >= 350.50

    # 5. Delete expense
    del_res = client.delete(f"/api/expenses/{expense_id}")
    assert del_res.status_code == 200
    del_data = del_res.get_json()
    assert del_data["success"] is True

    # Confirm deletion
    get_after_del = client.get("/api/expenses")
    assert not any(e["id"] == expense_id for e in get_after_del.get_json()["expenses"])


def test_categorize_expense_endpoint(client):
    """Verify /api/categorize-expense endpoint."""
    res = client.post("/api/categorize-expense", json={
        "description": "Domino's Pizza order",
        "amount": 599.0
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["category"] == "Food & Dining"


def test_extractors():
    """Unit test individual extractors."""
    # DateExtractor
    date_ext = DateExtractor()
    extracted_date = date_ext.extract_date("Tax Invoice\nDate: 15/08/2026\nCustomer: John")
    assert extracted_date == "2026-08-15"

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
    assert currency == "INR"
    assert len(amounts) > 0
    assert amounts[0] == 400.0

    # VendorExtractor
    vendor_ext = VendorExtractor()
    vendor = vendor_ext.extract_vendor("Welcome to Allen Solly Store\nDate: 2026-09-28\nItem: Shirt")
    assert vendor == "Allen Solly"
