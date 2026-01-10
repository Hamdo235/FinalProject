from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=datetime.utcnow, index=True)
    source: str = Field(index=True)
    ip: Optional[str] = Field(default=None, index=True)
    user: Optional[str] = None
    rule: Optional[str] = Field(default=None, index=True)
    severity: str = Field(default="medium")
    features_json: Optional[str] = None
    score: float = 0.0
    status: str = Field(default="open", index=True)
