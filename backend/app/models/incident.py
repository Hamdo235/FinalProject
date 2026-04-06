from typing import Optional
from datetime import datetime, UTC
from sqlmodel import SQLModel, Field


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

class Incident(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_utcnow_naive, index=True)
    status: str = Field(default="open", index=True)
    summary: Optional[str] = None
    risk: Optional[str] = Field(default="medium")
    confidence: float = 0.0
    related_alerts_json: Optional[str] = None
