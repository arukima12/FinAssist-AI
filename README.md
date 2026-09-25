# FinAssist AI 📊🤖

**FinAssist AI** is a production-grade, 100% offline, air-gapped Retrieval-Augmented Generation (RAG) platform engineered to ingest, parse, and extract contextual insights from dense financial (10-K, 10-Q, earnings reports, balance sheets) and legal documents (credit agreements, covenants, contracts).

Operating completely on local hardware with zero data leakage to external cloud APIs, FinAssist AI combines **IBM Docling** for layout-preserving parsing, **ChromaDB** for local vector indexing, **Sentence-Transformers/MiniLM** embeddings, and local **DeepSeek-R1 (1.5B)** via **Ollama** for deterministic financial reasoning.

---

## 🎯 Alignment with Core Architecture & Resume Highlights

| Resume Dimension | Implementation in FinAssist AI |
| :--- | :--- |
| **Enterprise RAG Pipeline for Dense Financial & Legal PDFs** | Integrated **IBM Docling** layout analysis engine with `PdfPipelineOptions(do_table_structure=True)` and pandas spreadsheet converter to preserve multi-column tables, balance sheets, and footnotes without vision memory spikes. |
| **SOTA Embeddings & Local Vector Store** | Employs high-speed **all-minilm** (384-dimensional) embeddings backed by **ChromaDB** persistent storage with normalized cosine relevance scoring, top-$k$ thresholding, and source citation extraction. |
| **Conversational Memory & Structured Query Routing** | Features `QueryRouter` classifying queries into *Financial Table Analysis*, *Legal Compliance*, *Document Summary*, and *General QA*. Maintains multi-turn session buffers with automatic query contextualization. |
| **Deterministic Prompt Sequencing** | Strict anti-hallucination guardrails instructing DeepSeek-R1 to cite exact source documents/chunks, format numerical balance sheets in markdown tables, and refuse speculation when data is absent. |
| **High-Throughput Async Backend API & Real-time Streaming** | **FastAPI** asynchronous server delivering Server-Sent Events (SSE). Streams token-by-token with dual-channel parsing: separating DeepSeek-R1 `<think>` reasoning traces from grounded responses. |

---

## 🏗️ Repository Architecture

```text
finassist-ai/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Package initialization
│   │   ├── config.py            # Environment settings (Ollama URL, models, thresholds)
│   │   ├── parser.py            # Docling multi-format layout parser (PDF, DOCX, XLSX, CSV, TXT)
│   │   ├── vector_store.py      # ChromaDB manager with local Ollama/ONNX MiniLM embeddings
│   │   ├── query_router.py      # Structured query routing engine (Financial, Legal, Summary, QA)
│   │   ├── memory.py            # Multi-turn conversational memory & query contextualizer
│   │   ├── llm_chain.py         # RAG pipeline with deterministic prompt sequencing & streaming
│   │   └── main.py              # FastAPI REST & SSE endpoints
│   ├── main.py                  # Direct Uvicorn launcher
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment template
│   └── chroma_db/               # Persistent Chroma vector store
├── frontend/
│   ├── app/
│   │   ├── globals.css          # TailwindCSS tokens, glassmorphism, pulse animations
│   │   ├── layout.js            # App root layout
│   │   └── page.js              # High-density financial dashboard & dual-channel streaming chat
│   ├── package.json             # Next.js 16 + React 19 + Lucide React
│   └── public/
├── sample_financial_report.md   # Benchmark 10-Q financial test document
└── README.md                    # Project documentation
```

---

## ⚡ Quick Start & Deployment Guide

### Prerequisites
1. **Python 3.10+** (with virtual environment)
2. **Node.js 18+** & npm
3. **Ollama** installed on the local system

### Step 1: Ensure Ollama is Running with Models
FinAssist AI runs 100% offline. Ensure the reasoning model and embedding model are present:
```bash
# Start Ollama daemon
ollama serve

# Pull DeepSeek-R1 and MiniLM embedding model (if not already downloaded)
ollama pull deepseek-r1:1.5b
ollama pull all-minilm
```

### Step 2: Launch Backend (FastAPI)
```bash
cd backend

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start backend server on port 8000
python main.py
```
Backend Swagger API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### Step 3: Launch Frontend (Next.js)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔌 API Endpoints Summary

- `GET /api/health` — Returns system health, Ollama status, loaded models, and ChromaDB vector count.
- `GET /api/documents` — Lists all indexed source files, chunk distributions, and upload timestamps.
- `POST /api/upload` — Ingests multi-format documents (PDF, DOCX, XLSX, CSV, TXT), runs layout analysis, and creates vector embeddings.
- `DELETE /api/documents/{doc_id}` — Deletes a document and purges its vector embeddings.
- `POST /api/query` — Server-Sent Events (SSE) streaming endpoint returning route classification, source citations, DeepSeek-R1 reasoning traces, and token-by-token final answers.
- `GET /api/history/{session_id}` — Fetches multi-turn conversation memory for a session.
- `DELETE /api/history/{session_id}` — Clears conversational session memory.
- `POST /api/clear` — Purges the entire ChromaDB collection.

---

## 🔒 Security & Offline Air-Gap Guarantee
- **Zero External API Calls**: No data is sent to OpenAI, Anthropic, or external cloud endpoints.
- **Local Vectors**: ChromaDB runs embedded in `./backend/chroma_db/`.
- **Local Inference**: DeepSeek-R1 runs via local Ollama engine at `http://127.0.0.1:11434`.
- **Ephemeral Upload Cleanup**: Temporary files created during parsing are automatically cleaned up immediately after vector generation.