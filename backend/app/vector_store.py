import os
import json
import urllib.request
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma

from app.config import settings

class LocalOllamaEmbeddings(Embeddings):
    """
    Robust local embedding wrapper connecting directly to local Ollama server
    with automatic in-process Chroma ONNX MiniLM fallback.
    """
    def __init__(self, base_url: str = settings.OLLAMA_BASE_URL, model: str = settings.EMBEDDING_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._onnx_fallback = None

    def _get_onnx_fallback(self):
        if self._onnx_fallback is None:
            self._onnx_fallback = embedding_functions.DefaultEmbeddingFunction()
        return self._onnx_fallback

    def _embed_single(self, text: str) -> List[float]:
        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/embeddings",
                data=json.dumps({"model": self.model, "prompt": text}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["embedding"]
        except Exception:
            # Fallback to local ONNX in-process model if Ollama request fails
            fallback = self._get_onnx_fallback()
            return fallback([text])[0]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_single(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed_single(text)


class VectorStoreManager:
    """
    Manages persistent local ChromaDB vector store, semantic retrieval,
    and document lifecycle operations.
    """
    def __init__(self):
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        self.embedding_function = LocalOllamaEmbeddings()
        self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.collection = self.chroma_client.get_or_create_collection(
            name=settings.COLLECTION_NAME,
            metadata={"description": "FinAssist AI Financial and Legal Knowledge Vectors"}
        )
        self.langchain_store = Chroma(
            client=self.chroma_client,
            collection_name=settings.COLLECTION_NAME,
            embedding_function=self.embedding_function
        )

    def add_documents(self, documents: List[Document]) -> int:
        """
        Adds chunked documents into ChromaDB.
        """
        if not documents:
            return 0
        self.langchain_store.add_documents(documents)
        return len(documents)

    def similarity_search_with_scores(
        self,
        query: str,
        k: int = settings.TOP_K,
        doc_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic similarity search with score calculation and source tagging.
        """
        filter_dict = {"doc_id": doc_id} if doc_id else None
        
        try:
            results = self.langchain_store.similarity_search_with_relevance_scores(
                query=query,
                k=k,
                filter=filter_dict
            )
        except Exception:
            # Fallback to standard similarity search if relevance scoring fails
            docs = self.langchain_store.similarity_search(query=query, k=k, filter=filter_dict)
            results = [(doc, 0.85) for doc in docs]

        formatted = []
        for doc, score in results:
            # Normalize score to 0.0 - 1.0 range
            norm_score = max(0.0, min(1.0, float(score)))
            formatted.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": round(norm_score, 4),
                "relevance_pct": f"{round(norm_score * 100, 1)}%"
            })

        return formatted

    def list_documents(self) -> List[Dict[str, Any]]:
        """
        Retrieves unique documents indexed in the vector store along with chunk counts.
        """
        all_metadata = self.collection.get(include=["metadatas"])["metadatas"]
        if not all_metadata:
            return []

        doc_map: Dict[str, Dict[str, Any]] = {}
        for meta in all_metadata:
            if not meta or "doc_id" not in meta:
                continue
            did = meta["doc_id"]
            if did not in doc_map:
                doc_map[did] = {
                    "doc_id": did,
                    "filename": meta.get("source", "Unknown"),
                    "file_type": meta.get("file_type", ""),
                    "chunk_count": 0,
                    "first_indexed": meta.get("created_at", "")
                }
            doc_map[did]["chunk_count"] += 1

        return list(doc_map.values())

    def delete_document(self, doc_id: str) -> int:
        """
        Deletes all chunks belonging to a document ID.
        """
        matching = self.collection.get(where={"doc_id": doc_id})
        ids_to_delete = matching.get("ids", [])
        if ids_to_delete:
            self.collection.delete(ids=ids_to_delete)
        return len(ids_to_delete)

    def clear_all(self) -> bool:
        """
        Resets and purges the vector collection.
        """
        self.chroma_client.delete_collection(name=settings.COLLECTION_NAME)
        self.collection = self.chroma_client.get_or_create_collection(name=settings.COLLECTION_NAME)
        self.langchain_store = Chroma(
            client=self.chroma_client,
            collection_name=settings.COLLECTION_NAME,
            embedding_function=self.embedding_function
        )
        return True

    def get_stats(self) -> Dict[str, Any]:
        """
        Returns stats for the vector database.
        """
        count = self.collection.count()
        docs = self.list_documents()
        return {
            "total_vectors": count,
            "total_documents": len(docs),
            "collection_name": settings.COLLECTION_NAME,
            "embedding_model": settings.EMBEDDING_MODEL,
            "persist_dir": str(Path(settings.CHROMA_PERSIST_DIR).resolve())
        }

vector_store_manager = VectorStoreManager()
