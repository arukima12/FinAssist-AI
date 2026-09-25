import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # LLM Provider: "ollama" (default local offline) or "groq" (cloud Render deploy) or "openai_compatible"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")

    # Ollama Local Server
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-r1:1.5b")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-minilm")

    # Cloud Providers for Render / Vercel cloud deployment
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "deepseek-r1-distill-llama-70b")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    # ChromaDB Persistence
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", str(BASE_DIR / "chroma_db"))
    COLLECTION_NAME: str = os.getenv("COLLECTION_NAME", "finassist_documents")

    # Text Splitting & RAG Retrieval
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    TOP_K: int = int(os.getenv("TOP_K", "4"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.45"))

    # Server & Port (Supports Render's dynamic $PORT)
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "*")

    class Config:
        env_file = str(BASE_DIR / ".env")
        extra = "allow"

settings = Settings()
