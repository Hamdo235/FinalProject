from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from ..core.settings import settings
from sqlmodel import Session as SQLModelSession

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    poolclass=StaticPool if settings.database_url.startswith("sqlite") else None,
)

def get_session():
    with SQLModelSession(engine) as session:
        yield session
