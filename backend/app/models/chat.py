from __future__ import annotations
from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, UTC


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    created_at: datetime = Field(default_factory=_utcnow_naive, index=True)

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation.id", index=True)
    role: str
    content: str
    created_at: datetime = Field(default_factory=_utcnow_naive, index=True)
