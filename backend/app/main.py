import os
import shutil
import tempfile
from typing import List, Optional
import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.parser import parser_engine
from app.vector_store import vector_store_manager
from app.llm_chain import rag_pipeline
from app.memory import conversation_memory

app = FastAPI(
    title="FinAssist AI Backend",
    description="Enterprise-grade offline RAG pipeline for dense financial and legal documents.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend (Supports Localhost, Vercel, and Cloud deployments)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

class QueryPayload(BaseModel):
    question: str
    session_id: Optional[str] = "default_session"
    doc_id: Optional[str] = None

@app.get("/")
async def root():
    return {
        "status": "online",
        "system": "FinAssist AI Financial & Legal RAG Pipeline",
        "version": "1.0.0",
        "mode": "fully_offline"
    }

@app.get("/api/health")
async def health_check():
    """
    Checks the status of the active LLM provider (Groq cloud or Ollama local)
    and the persistent ChromaDB vector store.
    """
    is_groq = settings.LLM_PROVIDER == "groq" or (bool(settings.GROQ_API_KEY) and settings.LLM_PROVIDER != "ollama")

    provider_online = False
    provider_name = "groq" if is_groq else "ollama"
    target_llm = settings.GROQ_MODEL if is_groq else settings.LLM_MODEL
    ollama_info = {}

    if is_groq:
        provider_online = bool(settings.GROQ_API_KEY)
        ollama_info = {
            "online": False,
            "mode": "cloud_groq",
            "target_llm": settings.GROQ_MODEL,
            "target_embedding": settings.EMBEDDING_MODEL,
            "api_key_configured": bool(settings.GROQ_API_KEY)
        }
    else:
        ollama_online = False
        ollama_models = []
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                if resp.status_code == 200:
                    ollama_online = True
                    ollama_models = [m.get("name") for m in resp.json().get("models", [])]
        except Exception:
            ollama_online = False

        provider_online = ollama_online
        ollama_info = {
            "online": ollama_online,
            "url": settings.OLLAMA_BASE_URL,
            "target_llm": settings.LLM_MODEL,
            "target_embedding": settings.EMBEDDING_MODEL,
            "available_models": ollama_models
        }

    stats = vector_store_manager.get_stats()

    return {
        "status": "healthy" if provider_online else "degraded",
        "provider": provider_name,
        "provider_online": provider_online,
        "target_llm": target_llm,
        "ollama": ollama_info,
        "vector_store": stats
    }

@app.get("/api/documents")
async def list_documents():
    """
    Lists all indexed documents and their chunk distributions.
    """
    try:
        docs = vector_store_manager.list_documents()
        return {"documents": docs, "total_count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Multi-format document ingestion endpoint.
    Parses complex layouts (PDFs, DOCX, XLSX, CSV, TXT) via Docling and tabular analyzers,
    chunks semantically, and updates ChromaDB vectors.
    """
    ALLOWED_EXTS = {".pdf", ".docx", ".xlsx", ".xls", ".csv", ".txt", ".md"}
    results = []
    total_chunks_created = 0

    temp_dir = tempfile.mkdtemp()
    try:
        for file in files:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ALLOWED_EXTS:
                results.append({
                    "filename": file.filename,
                    "status": "rejected",
                    "reason": f"File type {ext} not supported. Allowed: {', '.join(ALLOWED_EXTS)}"
                })
                continue

            temp_file_path = os.path.join(temp_dir, file.filename)
            with open(temp_file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            try:
                # 1. Parse document layout
                extracted_md, metadata = parser_engine.parse_file(temp_file_path, file.filename)

                # 2. Chunk semantically
                chunks = parser_engine.chunk_document(extracted_md, metadata)

                # 3. Add to local vector store
                vector_store_manager.add_documents(chunks)
                total_chunks_created += len(chunks)

                results.append({
                    "filename": file.filename,
                    "doc_id": metadata["doc_id"],
                    "status": "success",
                    "chunks": len(chunks),
                    "char_count": metadata["char_count"],
                    "has_tables": metadata["has_tables"],
                    "parser": metadata.get("parser", "default")
                })
            except Exception as parse_err:
                results.append({
                    "filename": file.filename,
                    "status": "failed",
                    "error": str(parse_err)
                })

        return {
            "message": f"Processed {len(files)} file(s). Created {total_chunks_created} vectors.",
            "total_chunks_created": total_chunks_created,
            "details": results
        }
    finally:
        # Secure cleanup of temporary storage
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    """
    Deletes all chunks belonging to a document from ChromaDB.
    """
    try:
        deleted = vector_store_manager.delete_document(doc_id)
        return {"message": f"Deleted document {doc_id}", "chunks_removed": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query")
async def query_pipeline(payload: QueryPayload):
    """
    Real-time streaming query retrieval endpoint.
    Orchestrates query routing, semantic retrieval, deterministic prompt sequencing,
    and token-by-token generation with DeepSeek-R1 reasoning separation.
    """
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    generator = rag_pipeline.stream_query_pipeline(
        query=payload.question,
        session_id=payload.session_id or "default_session",
        doc_id=payload.doc_id
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/history/{session_id}")
async def get_session_history(session_id: str):
    """
    Fetches conversational turns for the specified session.
    """
    history = conversation_memory.get_or_create_session(session_id)
    return {"session_id": session_id, "messages": history}

@app.delete("/api/history/{session_id}")
async def clear_session_history(session_id: str):
    """
    Resets the session's conversational memory.
    """
    conversation_memory.clear_session(session_id)
    return {"message": f"Cleared session {session_id}"}

@app.post("/api/clear")
async def clear_all_vectors():
    """
    Purges all documents and vectors in the local Chroma database.
    """
    try:
        vector_store_manager.clear_all()
        return {"message": "Successfully cleared all vector embeddings and indexed documents."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
