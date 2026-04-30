"""Alert wire schema (separate from the ORM model)."""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .defense import DefenseActionOut


class AlertOut(BaseModel):
    id: Optional[int] = None
    ts: datetime
    source: str
    ip: Optional[str] = None
    user: Optional[str] = None
    rule: Optional[str] = None
    severity: str = "medium"
    features_json: Optional[str] = None
    score: float = 0.0
    status: str = "open"
    defense: Optional[DefenseActionOut] = Field(
        default=None,
        description="Latest defense action attached to this alert, if any.",
    )

    model_config = {"from_attributes": True}
