from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class IPEnrichment(SQLModel, table=True):
    ip: str = Field(primary_key=True)
    country: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    asn: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
