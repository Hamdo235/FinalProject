"""DefenseAction wire schema (separate from the ORM model)."""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DefenseActionOut(BaseModel):
    id: Optional[int] = None
    alert_id: Optional[int] = None
    ip: Optional[str] = None
    action: str = Field(description="allow | monitor | review | block_temp")
    reason: Optional[str] = None
    confidence: float = 0.0
    mode: str = Field(description="off | monitor | assist | auto")
    expires_at: Optional[str] = None
    active: bool = False
    created_at: Optional[str] = None
    created_by: str = "system"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    revoked_at: Optional[str] = None
    iptables_command: Optional[str] = None
    iptables_unblock: Optional[str] = None

    @staticmethod
    def _iso(dt: Optional[datetime]) -> Optional[str]:
        return dt.isoformat() if dt else None

    @classmethod
    def from_dict(cls, d: dict) -> "DefenseActionOut":
        # Compatibility with existing service layer that returns plain dicts.
        return cls.model_validate(d)
