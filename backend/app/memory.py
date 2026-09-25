from typing import List, Dict, Any, Optional
from datetime import datetime

class ConversationMemory:
    """
    In-memory conversational agent memory buffer supporting multi-turn dialogue,
    session management, and contextualized query rewriting for financial RAG.
    """
    def __init__(self, max_history_turns: int = 6):
        self.sessions: Dict[str, List[Dict[str, Any]]] = {}
        self.max_history_turns = max_history_turns

    def get_or_create_session(self, session_id: str) -> List[Dict[str, Any]]:
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        return self.sessions[session_id]

    def add_user_message(self, session_id: str, text: str) -> None:
        session = self.get_or_create_session(session_id)
        session.append({
            "role": "user",
            "content": text,
            "timestamp": datetime.now().isoformat()
        })
        # Keep within window
        if len(session) > self.max_history_turns * 2:
            self.sessions[session_id] = session[-self.max_history_turns * 2:]

    def add_ai_message(self, session_id: str, text: str, route: Optional[str] = None) -> None:
        session = self.get_or_create_session(session_id)
        session.append({
            "role": "assistant",
            "content": text,
            "route": route,
            "timestamp": datetime.now().isoformat()
        })

    def get_formatted_history(self, session_id: str) -> str:
        """
        Formats conversational turns into clean text buffer for prompt injection.
        """
        session = self.sessions.get(session_id, [])
        if not session:
            return ""

        formatted_turns = []
        for msg in session[-self.max_history_turns * 2:]:
            speaker = "Human" if msg["role"] == "user" else "FinAssist AI"
            formatted_turns.append(f"{speaker}: {msg['content']}")

        return "\n".join(formatted_turns)

    def contextualize_query(self, session_id: str, current_query: str) -> str:
        """
        Synthesizes conversation history with the current user query to resolve pronouns
        or implicit temporal references (e.g. 'What about 2022?' -> '2022 operating income').
        """
        session = self.sessions.get(session_id, [])
        if not session or len(session) < 2:
            return current_query

        # Look at the last user message for anchor subjects
        last_user_msg = ""
        for msg in reversed(session):
            if msg["role"] == "user":
                last_user_msg = msg["content"]
                break

        # If current query is brief / follow-up, blend last query topic
        words = current_query.strip().split()
        pronouns_or_brief = any(p in current_query.lower() for p in ["it", "that", "those", "this", "compare", "how about", "what about"]) or len(words) <= 4

        if pronouns_or_brief and last_user_msg:
            return f"{last_user_msg} {current_query}"

        return current_query

    def clear_session(self, session_id: str) -> bool:
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

# Global conversation memory manager
conversation_memory = ConversationMemory()
