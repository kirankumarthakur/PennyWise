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

## Requirements & Prerequisites

### 1. System Requirements
- **Python**: `3.14` (managed via [`backend/pyproject.toml`](backend/pyproject.toml))
- **Node.js**: `24.0+` & `npm` (managed via [`frontend/package.json`](frontend/package.json))
- **Package Manager**: [`uv`](https://docs.astral.sh/uv/) (recommended) or standard `pip` / `venv`

### 2. External OCR Engine (For Receipt Extraction)
PennyWise uses **Tesseract OCR** for parsing printed receipts and scanned PDF invoices:
- **Windows**: Install using winget or installer:
  ```powershell
  winget install UB-Mannheim.TesseractOCR
  ```
  *(Default detection path: `C:\Program Files\Tesseract-OCR\tesseract.exe` or set `TESSERACT_CMD` environment variable)*
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt update && sudo apt install -y tesseract-ocr
  ```
- **macOS**:
  ```bash
  brew install tesseract
  ```

### 3. Backend Dependencies
All Python dependencies are defined in [`backend/pyproject.toml`](backend/pyproject.toml):
- **Web & API**: `flask`, `flask-cors`, `requests`
- **AI & LLM SDKs**: `google-genai` (Gemini), `openai` (GPT-4o), `anthropic` (Claude)
- **Document & Image Processing**: `pytesseract`, `opencv-python`, `pillow`, `pdfplumber`, `pymupdf`, `pypdf2`
- **Machine Learning & Analytics**: `scikit-learn`, `pandas`, `numpy`, `joblib`, `python-dateutil`

### 4. Frontend Dependencies
All UI dependencies are defined in [`frontend/package.json`](frontend/package.json):
- **Framework**: `react 18`, `react-dom`
- **Build Tool**: `vite`
- **Styling**: `tailwindcss`, `postcss`, `autoprefixer`
- **Icons & Motion**: `lucide-react`, `framer-motion`

### 5. AI API Key (Optional)
PennyWise runs completely offline with built-in heuristic rules and local ML classification even without any API keys. To enable the AI Copilot and Multimodal Receipt Parsing:
- **Google Gemini API Key** (Free tier available via [Google AI Studio](https://aistudio.google.com/))
- **OpenAI API Key** or **Anthropic API Key** (Optional)

---

## Getting Started

### 1. Backend Setup

Using **uv** (recommended):
```bash
cd backend
uv sync
uv run dev
```

Using standard **pip**:
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -e .
python -m backend.app
```
The backend API runs on `http://localhost:5000`.

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
The frontend application runs on `http://localhost:5173`.

---

## AI Provider Configuration

1. Open `http://localhost:5173` and click **Settings**.
2. Select your AI engine:
   - **Google Gemini** (Gemini 3.8 Flash, 3.7 Flash, 3.5 Flash)
   - **OpenAI** (GPT-4o, GPT-4o-mini)
   - **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3.5 Haiku)
3. Paste your API key and click **Test Connection**.
4. Once verified, the key and active model are automatically saved locally into SQLite (`backend/pennywise.db`).

---

## Data Storage

All data stays strictly local on your machine:
- **Database**: SQLite at `backend/pennywise.db`
- **Receipt Archives**: Saved locally in `backend/uploads/receipts/`
- **ML Artifacts**: Pre-trained ensemble models in `backend/Model/models/`

---

## License

MIT
