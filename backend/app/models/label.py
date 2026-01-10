from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class AlertLabel(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    alert_id: int = Field(index=True, foreign_key="alert.id")
    label: str = Field(index=True)  # "true_attack" | "false_positive"
    noted_at: datetime = Field(default_factory=datetime.utcnow, index=True)
