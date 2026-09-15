# PennyWise Backend

PennyWise Backend provides RESTful APIs for expense management, receipt and invoice document processing (OCR), and intelligent expense categorization combining heuristic rule matching with a trained machine learning ensemble.

## Architecture

The backend is organized using a layered Object-Oriented design:

```
backend/
├── Model/                       # ML training scripts, datasets, and serialized models
│   ├── data/                    # Dataset (exp.csv)
│   ├── models/                  # Serialized artifacts (ensemble, TF-IDF, scaler, info)
│   └── scripts/                 # train_production_model.py
├── src/
│   └── backend/
│       ├── __init__.py          # Package entry points (app, create_app, main)
│       ├── config.py            # AppConfig and logging initialization
│       ├── app.py               # Flask application factory
│       ├── models/              # Domain models (Expense, BillExtractionResult)
│       ├── repositories/        # Persistence layer (ExpenseRepository, InMemoryExpenseRepository)
│       ├── extractors/          # OCR, PDF document parsing, entity extractors
│       │   ├── ocr.py           # Tesseract OCR engine with preprocessing
│       │   ├── document_parser.py # PDF text stream & rasterization fallback
│       │   ├── date_extractor.py  # Regex & contextual date parser
│       │   ├── amount_extractor.py# Monetary amount & currency parser
│       │   └── vendor_extractor.py# Retail brand & merchant extractor
│       ├── services/            # Business logic layer
│       │   ├── expense_service.py # CRUD & financial analytics
│       │   ├── categorization_service.py # ML + heuristic classification
│       │   └── bill_processing_service.py# Document extraction coordinator
│       └── api/                 # Presentation layer (Flask Blueprints)
│           ├── expenses_routes.py
│           ├── bill_routes.py
│           ├── analytics_routes.py
│           └── health_routes.py
├── pyproject.toml
└── requirements.txt
```

## Setup & Running

### 1. Install Dependencies
Using uv:
```bash
uv sync
```
Or using pip:
```bash
pip install -r requirements.txt
```

### 2. External Dependencies
- **Tesseract OCR**: Recommended for image and scanned PDF text extraction. Ensure `tesseract` is on your PATH or installed at the default Windows location (`C:\Program Files\Tesseract-OCR\tesseract.exe`).

### 3. Run the Backend Server
Using `uv`:
```bash
uv run dev
# or
uv run python -m backend.app
```
Or using python directly:
```bash
python -m backend.app
```
By default, the server runs at `http://localhost:5000` and creates or uses `pennywise.db` (SQLite) for persistence.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check and system readiness |
| `GET` | `/api/expenses` | List expenses with `start_date`, `end_date`, `category`, `tag` filters |
| `POST` | `/api/expenses` | Create a new expense entry (with tags & optional receipt) |
| `DELETE` | `/api/expenses/<id>` | Delete an expense by ID |
| `GET` | `/api/tags` | List all unique tags across all transactions |
| `GET` | `/api/analytics` | Category breakdown and monthly aggregates |
| `POST` | `/api/process-bill` | Multimodal AI or OCR bill/receipt extraction (`image` or `pdf`) |
| `GET` | `/api/receipts/<filename>` | View/download archived receipt document |
| `GET` | `/api/settings` | Get configured settings and masked API keys |
| `POST` | `/api/settings` | Save active provider, API key, model, and budget |
| `POST` | `/api/settings/test-key` | Test connection for an AI provider (Gemini, OpenAI, Anthropic) |
| `GET` | `/api/ai/insights` | Bundled financial intelligence (velocity, anomalies, subscriptions, tips, digest) |
| `POST` | `/api/ai/suggest` | Auto-predict category and tags from merchant and amount |
| `POST` | `/api/ai/parse-text` | Parse raw bank SMS or natural language text into expense fields |
| `POST` | `/api/ai/chat` | Conversational financial copilot chat with transaction snapshot |

