from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class Incident(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    status: str = Field(default="open", index=True)
    summary: Optional[str] = None
    risk: Optional[str] = Field(default="medium")
    confidence: float = 0.0
    related_alerts_json: Optional[str] = None
