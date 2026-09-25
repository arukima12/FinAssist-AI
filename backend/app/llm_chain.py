import json
import httpx
from typing import AsyncGenerator, Dict, Any, Optional, List

from app.config import settings
from app.query_router import query_router
from app.memory import conversation_memory
from app.vector_store import vector_store_manager

class FinancialRAGPipeline:
    """
    Enterprise-grade RAG orchestrator for dense financial and legal documents.
    Features:
    - Structured query routing
    - Conversational memory & query contextualization
    - Deterministic prompt sequencing & hallucination guardrails
    - Token-by-token streaming with real-time DeepSeek reasoning separation
    - Full offline local execution via Ollama + Cloud provider support (Groq/OpenAI) for Render/Vercel
    """

    SYSTEM_BASE_PROMPT = """You are FinAssist AI, an enterprise-grade financial and legal intelligence agent.
Your mission is to provide rigorous, accurate, and contextually grounded answers based EXCLUSIVELY on the verified document context provided below.

CRITICAL FINANCIAL & LEGAL COMPLIANCE RULES:
1. STRICT VERIFICATION: Answer using ONLY the provided verified context. If an answer, metric, percentage, or clause is NOT mentioned or cannot be derived mathematically from the context, explicitly state:
   "I cannot verify that specific metric from the uploaded documents."
2. ZERO HALLUCINATIONS: Never fabricate numbers, dates, contract parties, or covenants. Maintain absolute numerical and mathematical fidelity.
3. STRUCTURE & CLARITY: Present comparisons and multi-period financial tables in clean markdown tables. Clearly highlight units (e.g. Millions USD, %, bps).
4. CITATIONS: Whenever citing an important figure or legal restriction, reference the source document name and section indicated in the verified context.

Verified Document Context:
-------------------------
{context}
-------------------------

Conversation History:
{history}
"""

    @classmethod
    def _build_context_block(cls, retrieved_docs: List[Dict[str, Any]]) -> str:
        if not retrieved_docs:
            return "No matching document context found."

        context_snippets = []
        for i, item in enumerate(retrieved_docs, start=1):
            source = item["metadata"].get("source", "Document")
            chunk_idx = item["metadata"].get("chunk_index", 0)
            score_pct = item.get("relevance_pct", "N/A")
            snippet = (
                f"[Source #{i}: {source} | Chunk {chunk_idx} | Match Confidence: {score_pct}]\n"
                f"{item['content']}"
            )
            context_snippets.append(snippet)

        return "\n\n---\n\n".join(context_snippets)

    @classmethod
    async def stream_query_pipeline(
        cls,
        query: str,
        session_id: str = "default_session",
        doc_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Asynchronous generator streaming Server-Sent Events (SSE) / JSON lines.
        """
        # 1. Step 1: Memory & Contextualization
        contextualized_query = conversation_memory.contextualize_query(session_id, query)
        conversation_memory.add_user_message(session_id, query)

        # 2. Step 2: Structured Query Routing
        route_info = query_router.route_query(contextualized_query)
        yield f"data: {json.dumps({'type': 'route', 'data': route_info})}\n\n"

        # 3. Step 3: Semantic Retrieval with Vector Store
        top_k = route_info.get("recommended_k", settings.TOP_K)
        retrieved_docs = vector_store_manager.similarity_search_with_scores(
            query=contextualized_query,
            k=top_k,
            doc_id=doc_id
        )

        sources_payload = [
            {
                "id": idx,
                "source": d["metadata"].get("source", "Unknown"),
                "chunk_index": d["metadata"].get("chunk_index", 0),
                "score": d["score"],
                "relevance_pct": d["relevance_pct"],
                "content_preview": d["content"][:240] + ("..." if len(d["content"]) > 240 else "")
            }
            for idx, d in enumerate(retrieved_docs)
        ]
        yield f"data: {json.dumps({'type': 'sources', 'data': sources_payload})}\n\n"

        # If no documents are indexed or found
        if not retrieved_docs:
            no_docs_msg = (
                "No relevant document context found. Please ensure you have uploaded "
                "financial or legal source documents (such as 10-Ks, balance sheets, or contracts) "
                "before submitting analytical queries."
            )
            conversation_memory.add_ai_message(session_id, no_docs_msg, route=route_info["route"])
            yield f"data: {json.dumps({'type': 'content', 'delta': no_docs_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # 4. Step 4: Deterministic Prompt Sequencing
        context_str = cls._build_context_block(retrieved_docs)
        history_str = conversation_memory.get_formatted_history(session_id)
        if not history_str:
            history_str = "No prior messages in this session."

        system_prompt = cls.SYSTEM_BASE_PROMPT.format(
            context=context_str,
            history=history_str
        )
        if "system_instruction" in route_info:
            system_prompt += f"\nSpecialized Analysis Directive: {route_info['system_instruction']}\n"

        final_prompt = (
            f"{system_prompt}\n\n"
            f"User Question: {query}\n"
            f"Structured Financial Analysis:"
        )

        # 5. Step 5: Streaming Token Generator (Ollama or Cloud Fallback)
        full_reasoning = ""
        full_content = ""
        in_think_block = False
        tag_buffer = ""

        # Choose provider: Groq (if configured) or Ollama (default local offline)
        use_groq = settings.LLM_PROVIDER == "groq" or (bool(settings.GROQ_API_KEY) and settings.LLM_PROVIDER != "ollama")

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                if use_groq:
                    # Cloud Provider: Groq streaming
                    headers = {
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": settings.GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": query}
                        ],
                        "stream": True,
                        "temperature": route_info.get("temperature", 0.1)
                    }
                    async with client.stream(
                        "POST",
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=headers,
                        json=payload
                    ) as response:
                        if response.status_code != 200:
                            err_msg = f"Groq cloud inference error: HTTP {response.status_code}"
                            yield f"data: {json.dumps({'type': 'error', 'detail': err_msg})}\n\n"
                            return

                        async for line in response.aiter_lines():
                            if not line or not line.startswith("data:"):
                                continue
                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                token = chunk["choices"][0]["delta"].get("content", "")
                                if not token:
                                    continue
                                
                                # Process tags
                                tag_buffer += token
                                if "<think>" in tag_buffer:
                                    in_think_block = True
                                    tag_buffer = tag_buffer.replace("<think>", "")
                                if "</think>" in tag_buffer:
                                    parts = tag_buffer.split("</think>", 1)
                                    if parts[0]:
                                        full_reasoning += parts[0]
                                        yield f"data: {json.dumps({'type': 'reasoning', 'delta': parts[0]})}\n\n"
                                    in_think_block = False
                                    tag_buffer = parts[1]

                                if "<" not in tag_buffer:
                                    if in_think_block:
                                        full_reasoning += tag_buffer
                                        yield f"data: {json.dumps({'type': 'reasoning', 'delta': tag_buffer})}\n\n"
                                    else:
                                        full_content += tag_buffer
                                        yield f"data: {json.dumps({'type': 'content', 'delta': tag_buffer})}\n\n"
                                    tag_buffer = ""
                            except Exception:
                                continue

                else:
                    # Local Offline Provider: Ollama streaming
                    payload = {
                        "model": settings.LLM_MODEL,
                        "prompt": final_prompt,
                        "stream": True,
                        "options": {
                            "temperature": route_info.get("temperature", 0.1),
                            "top_p": 0.9,
                            "num_ctx": 4096
                        }
                    }
                    async with client.stream(
                        "POST",
                        f"{settings.OLLAMA_BASE_URL}/api/generate",
                        json=payload
                    ) as response:
                        if response.status_code != 200:
                            err_msg = f"Local Ollama inference failed with status {response.status_code}."
                            yield f"data: {json.dumps({'type': 'error', 'detail': err_msg})}\n\n"
                            return

                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            try:
                                chunk_json = json.loads(line)
                                token = chunk_json.get("response", "")
                                
                                # Handle <think> and </think> tags from DeepSeek-R1
                                tag_buffer += token

                                if "<think>" in tag_buffer:
                                    in_think_block = True
                                    tag_buffer = tag_buffer.replace("<think>", "")

                                if "</think>" in tag_buffer:
                                    parts = tag_buffer.split("</think>", 1)
                                    if parts[0]:
                                        full_reasoning += parts[0]
                                        yield f"data: {json.dumps({'type': 'reasoning', 'delta': parts[0]})}\n\n"
                                    in_think_block = False
                                    tag_buffer = parts[1]

                                if "<" not in tag_buffer:
                                    if in_think_block:
                                        full_reasoning += tag_buffer
                                        yield f"data: {json.dumps({'type': 'reasoning', 'delta': tag_buffer})}\n\n"
                                    else:
                                        full_content += tag_buffer
                                        yield f"data: {json.dumps({'type': 'content', 'delta': tag_buffer})}\n\n"
                                    tag_buffer = ""

                                if chunk_json.get("done", False):
                                    break
                            except Exception:
                                continue

            except Exception as stream_err:
                yield f"data: {json.dumps({'type': 'error', 'detail': str(stream_err)})}\n\n"
                return

        # Flush any trailing tokens in tag_buffer
        if tag_buffer:
            if in_think_block:
                full_reasoning += tag_buffer
                yield f"data: {json.dumps({'type': 'reasoning', 'delta': tag_buffer})}\n\n"
            else:
                full_content += tag_buffer
                yield f"data: {json.dumps({'type': 'content', 'delta': tag_buffer})}\n\n"

        # Record AI turn in conversation memory
        conversation_memory.add_ai_message(session_id, full_content, route=route_info["route"])

        # Send completion event
        yield f"data: {json.dumps({'type': 'done', 'reasoning': full_reasoning, 'content': full_content})}\n\n"

rag_pipeline = FinancialRAGPipeline()
