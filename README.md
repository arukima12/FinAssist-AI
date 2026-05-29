# FinAssist AI 📊🤖

FinAssist AI is a production-ready, fully local Retrieval-Augmented Generation (RAG) application engineered to parse, embed, and analyze complex financial documents (like 10-K filings, earnings reports, and financial statements). By leveraging state-of-the-art document layout analysis and local reasoning LLMs, FinAssist AI provides accurate, context-aware financial insights without exposing sensitive data to external cloud APIs.

---

## 🚀 Key Features

*   **Intelligent Document Parsing:** Utilizes **Docling** to accurately parse complex financial PDFs, maintaining structural integrity across tables, headers, and multi-column layouts.
*   **Local Privacy & Reasoning:** Powered by **DeepSeek-R1** running locally, delivering high-tier financial reasoning and mathematical verification safely on your own hardware.
*   **Vector Search Pipeline:** Uses **ChromaDB** for efficient, local vector storage and semantic similarity search.
*   **Real-time Streaming UI:** Features a modern, ultra-responsive **Next.js** frontend with token-by-token streaming responses via a custom FastAPI pipeline.
*   **Modular Architecture:** Cleanly separated into standalone `backend` and `frontend` microservices.

---

## 🛠️ Tech Stack

### Backend
*   **Framework:** FastAPI (Python 3.10+)
*   **Parsing:** Docling (IBM)
*   **LLM & Orchestration:** DeepSeek-R1 (via Ollama / local inference)
*   **Vector Database:** ChromaDB
*   **Embeddings:** HuggingFace / SentenceTransformers

### Frontend
*   **Framework:** Next.js (App Router)
*   **Styling:** Tailwind CSS
*   **State Management:** React Hooks
*   **Streaming API handling:** Native Fetch / ReadableStreams

---

## 📁 Repository Structure

```text
finassist-ai/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application entrypoint
│   │   ├── parser.py        # Docling document processing engine
│   │   ├── vector_store.py  # ChromaDB integration & embeddings
│   │   └── llm_chain.py     # DeepSeek-R1 streaming query pipeline
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Backend environment configuration
├── frontend/
│   ├── app/                 # Next.js App Router (pages & layout)
│   ├── components/          # Reusable UI components (Chat, Upload, Navbar)
│   ├── package.json         # Node.js dependencies
│   └── .env.example         # Frontend environment configuration
└── README.md                # Project documentation