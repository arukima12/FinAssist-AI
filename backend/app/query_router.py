import re
from enum import Enum
from typing import Dict, Any

class QueryRoute(str, Enum):
    FINANCIAL_TABLE = "FINANCIAL_TABLE_ANALYSIS"
    LEGAL_COMPLIANCE = "LEGAL_COMPLIANCE"
    DOCUMENT_SUMMARY = "DOCUMENT_SUMMARY"
    GENERAL_QA = "GENERAL_QA"

class QueryRouter:
    """
    Structured query routing engine for financial and legal RAG pipelines.
    Routes queries to specialized prompt directives and retrieval parameters.
    """

    FINANCIAL_KEYWORDS = [
        "ebitda", "revenue", "margin", "income", "profit", "loss", "balance sheet",
        "cash flow", "asset", "liability", "debt", "equity", "eps", "operating expense",
        "capex", "dividend", "valuation", "fiscal", "q1", "q2", "q3", "q4", "yoy",
        "growth", "ratio", "amortization", "depreciation", "cagr", "gross margin",
        "shares", "earnings", "roi", "roe", "liquidity", "working capital", "guidance"
    ]

    LEGAL_KEYWORDS = [
        "covenant", "indemnity", "indemnification", "breach", "governing law",
        "jurisdiction", "termination", "liability", "warranty", "representation",
        "confidentiality", "arbitration", "intellectual property", "compliance",
        "regulatory", "sanction", "default", "waiver", "severability", "force majeure",
        "statute", "obligation", "dispute", "clause", "agreement", "party"
    ]

    SUMMARY_KEYWORDS = [
        "summary", "summarize", "overview", "briefing", "key takeaways",
        "executive summary", "highlights", "main points", "synthesize", "abstract"
    ]

    @classmethod
    def route_query(cls, query: str) -> Dict[str, Any]:
        """
        Classifies incoming query into optimal analytical route.
        """
        q_lower = query.lower()

        # Check for summary intent
        if any(re.search(rf"\b{re.escape(kw)}\b", q_lower) for kw in cls.SUMMARY_KEYWORDS):
            return {
                "route": QueryRoute.DOCUMENT_SUMMARY.value,
                "label": "Executive Document Summary",
                "icon": "FileText",
                "recommended_k": 5,
                "temperature": 0.2,
                "system_instruction": (
                    "Synthesize an executive briefing from the verified document context. "
                    "Structure your answer with clear high-level bullet points, highlighting key numbers and core conclusions."
                )
            }

        # Check for financial metrics & tables
        fin_matches = sum(1 for kw in cls.FINANCIAL_KEYWORDS if re.search(rf"\b{re.escape(kw)}\b", q_lower))
        legal_matches = sum(1 for kw in cls.LEGAL_KEYWORDS if re.search(rf"\b{re.escape(kw)}\b", q_lower))

        if fin_matches > 0 and fin_matches >= legal_matches:
            return {
                "route": QueryRoute.FINANCIAL_TABLE.value,
                "label": "Financial Table & Metric Analysis",
                "icon": "TrendingUp",
                "recommended_k": 4,
                "temperature": 0.1,
                "system_instruction": (
                    "Perform rigorous financial analysis on the verified document context. "
                    "Extract exact figures, currency denominations, and reporting periods. "
                    "Where applicable, present data in clean markdown tables. Show mathematical derivations clearly."
                )
            }

        if legal_matches > 0:
            return {
                "route": QueryRoute.LEGAL_COMPLIANCE.value,
                "label": "Legal Clause & Compliance Verification",
                "icon": "Scale",
                "recommended_k": 4,
                "temperature": 0.1,
                "system_instruction": (
                    "Perform precise legal clause extraction and compliance analysis on the verified context. "
                    "Quote verbatim clauses where critical, highlighting explicit conditions, thresholds, exceptions, and obligations."
                )
            }

        # Fallback General Financial/Legal QA
        return {
            "route": QueryRoute.GENERAL_QA.value,
            "label": "Verified Document QA",
            "icon": "HelpCircle",
            "recommended_k": 3,
            "temperature": 0.2,
            "system_instruction": (
                "Answer the user query accurately and concisely using strictly the verified document context."
            )
        }

query_router = QueryRouter()
