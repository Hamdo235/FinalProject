from typing import Optional
from datetime import datetime, UTC
from sqlmodel import SQLModel, Field


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

class LLMTrace(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    incident_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=_utcnow_naive)
    prompt: str
    response: str
    confidence: float = 0.0
    citations_json: Optional[str] = None
    response_json: Optional[str] = None       # JSON complet de la réponse LLM
    mitre_technique: Optional[str] = None     # ex: "T1110.001"
    rag_context_used: Optional[str] = None    # contexte MITRE injecté dans le prompt
    confidence_method: Optional[str] = None   # "rag_weighted" ou "fallback"
