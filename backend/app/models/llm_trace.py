from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class LLMTrace(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    incident_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    prompt: str
    response: str
    confidence: float = 0.0
    citations_json: Optional[str] = None
