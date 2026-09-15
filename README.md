# PennyWise

PennyWise is a local, privacy-first personal finance platform and expense tracker. It provides multi-provider LLM integrations (Google Gemini, OpenAI, Anthropic Claude), multimodal receipt parsing, real-time spending velocity tracking, subscription detection, and an interactive financial copilot.

---

## Features

### Multi-Provider AI Support
- Supports Google Gemini, OpenAI (GPT-4o, GPT-4o-mini), and Anthropic (Claude 3.5 Sonnet).
- API keys are stored and masked locally in SQLite.
- Includes in-app connection testing to verify provider credentials.

### Receipt and Document Extraction
- Ingests receipt images (PNG, JPEG, WebP) and PDF invoices.
- Multimodal extraction for vendor names, line items, transaction dates, and totals.
- Compresses and archives receipts locally for in-app viewing.

### Natural Language Expense Entry
- Parses plain text descriptions and bank transaction notifications into structured fields (vendor, amount, date, category, tags).

### Spending Velocity and Subscription Tracking
- Monitors daily burn rate against safe budget targets.
- Identifies unusual spending spikes and anomalies.
- Detects recurring monthly commitments and projects annual subscription totals.

### Financial Copilot
- Conversational assistant with context-aware insights based on current transactions and budget status.

### Tagging and Filtering
- Custom multi-tagging for transactions.
- Filter transactions by category, tags, or search keywords.

### Dark Mode
- Full light and dark theme support.

---

## Getting Started

### Prerequisites
- Python 3.10+
- uv
- Node.js 18+ and npm

---

### Backend Setup

```bash
# Sync dependencies and configure virtual environment
uv sync

# Start the backend API server (runs on http://localhost:5000)
uv run dev
```

You can also run directly from the `backend` directory:
```bash
cd backend
uv run dev
```

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server (runs on http://localhost:5173)
npm run dev
```

---

## AI Provider Configuration

PennyWise includes offline heuristic fallbacks if no API key is supplied. To enable LLM features:

1. Open `http://localhost:5173` and go to Settings.
2. Choose your provider:
   - Google Gemini (free tier available via Google AI Studio)
   - OpenAI
   - Anthropic
3. Enter your API key and click Test Connection.
4. Save settings.

---

## Data Storage

All data is stored locally:
- Database: SQLite (`backend/pennywise.db`)
- Receipts: Local directory (`backend/uploads/`)

---

## License

MIT
