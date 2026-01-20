from __future__ import annotations
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation.id", index=True)
    role: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
