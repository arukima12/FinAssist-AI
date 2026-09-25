# 🚀 FinAssist AI - Deployment Guide (Vercel & Render)

This guide walks you through deploying **FinAssist AI** to production using **Render** (for the FastAPI + ChromaDB backend) and **Vercel** (for the Next.js frontend).

---

## 🏗️ Architecture Overview in Cloud

```text
[ User Browser ]
       │
       ▼ (HTTPS)
[ Next.js Frontend on Vercel ]
       │
       ▼ (REST / SSE Streaming via NEXT_PUBLIC_API_URL)
[ FastAPI Backend on Render ]
       │
       ├── ChromaDB (Embedded local persistent vector store)
       ├── Docling & Document Layout Parser
       └── LLM Inference:
           • Local Offline Mode: Ollama (deepseek-r1:1.5b)
           • Cloud Deploy Mode: Groq Cloud (deepseek-r1-distill-llama-70b / free API)
```

> **Why Cloud LLM Fallback for Render Free Tier?**  
> Locally, FinAssist AI runs **100% offline** on your machine using Ollama. However, free cloud hosting like Render provides 512MB RAM without a dedicated GPU. We have added automatic multi-provider streaming: in cloud deployment on Render, it uses **Groq's free API** to run **DeepSeek-R1** at 300 tokens/sec with zero hosting costs!

---

## 📦 Part 1: Deploy Backend to Render

### Option A: Using the Render Dashboard (Simplest)

1. Push your repository to GitHub.
2. Log into [Render.com](https://render.com) and click **New +** -> **Web Service**.
3. Connect your GitHub repository (`FinAssist-AI`).
4. Configure the service settings:
   - **Name**: `finassist-backend` (or your choice)
   - **Root Directory**: `backend`
   - **Runtime**: `Python` (or `Docker`)
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
5. Click **Advanced** -> **Add Environment Variable**:
   - `LLM_PROVIDER`: `groq`
   - `GROQ_API_KEY`: *(Get a free key in 30 seconds at [console.groq.com/keys](https://console.groq.com/keys))*
   - `GROQ_MODEL`: `deepseek-r1-distill-llama-70b`
   - `EMBEDDING_MODEL`: `all-minilm`
   - `FRONTEND_ORIGIN`: `*`
6. Click **Create Web Service**.
7. Once deployed, copy your backend URL (e.g., `https://finassist-backend.onrender.com`).
   - You can test it by visiting: `https://your-backend.onrender.com/api/health`

### Option B: Using the `render.yaml` Blueprint
1. Go to [Render Dashboard](https://dashboard.render.com/) -> **Blueprints**.
2. Connect your repo; Render will automatically detect `render.yaml`.
3. Add your `GROQ_API_KEY` when prompted and click Deploy.

---

## ⚡ Part 2: Deploy Frontend to Vercel

1. Log into [Vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
2. Import your GitHub repository (`FinAssist-AI`).
3. In the project configuration screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select **`frontend`**
4. Expand **Environment Variables** and add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://your-backend.onrender.com` *(your Render backend URL from Part 1, without trailing slash)*
5. Click **Deploy**.
6. In ~60 seconds, Vercel will give you a live production URL (e.g., `https://finassist-ai.vercel.app`).

---

## 🧪 Testing Your Production Deployment

1. Open your Vercel URL in your browser.
2. In the left panel, upload a financial PDF or spreadsheet (you can use [`sample_financial_report.md`](./sample_financial_report.md) or any 10-K/10-Q filing).
3. Check that the document is parsed into vector embeddings in ChromaDB.
4. Click one of the prompt suggestion chips (e.g. *"Analyze EBITDA & Margins"*) or type an analytical question.
5. Watch the real-time token stream with the **DeepSeek-R1 Reasoning Chain** and **Verified Context Citations**!
