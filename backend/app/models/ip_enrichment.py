from typing import Optional
from datetime import datetime, UTC
from sqlmodel import SQLModel, Field


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

class IPEnrichment(SQLModel, table=True):
    ip: str = Field(primary_key=True)
    country: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    asn: Optional[str] = None
    updated_at: datetime = Field(default_factory=_utcnow_naive)
