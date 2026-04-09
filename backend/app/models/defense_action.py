from typing import Optional
from datetime import datetime, UTC
from sqlmodel import SQLModel, Field


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class DefenseAction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    alert_id: Optional[int] = Field(default=None, foreign_key="alert.id", index=True)
    ip: Optional[str] = Field(default=None, index=True)
    action: str = Field(default="monitor", index=True)  # allow | monitor | review | block_temp
    reason: Optional[str] = None
    confidence: float = 0.0
    mode: str = Field(default="assist", index=True)  # off | monitor | assist | auto
    expires_at: Optional[datetime] = Field(default=None, index=True)
    active: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=_utcnow_naive, index=True)
    created_by: str = Field(default="system", index=True)  # system | human
    approved_by: Optional[str] = Field(default=None, index=False)
    approved_at: Optional[datetime] = Field(default=None, index=False)
    revoked_at: Optional[datetime] = Field(default=None, index=False)
