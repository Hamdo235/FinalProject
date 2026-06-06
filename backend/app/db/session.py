from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from ..core.settings import settings
from sqlmodel import Session as SQLModelSession

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    poolclass=StaticPool if settings.database_url.startswith("sqlite") else None,
)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA cache_size=-32000")
        cur.execute("PRAGMA temp_store=MEMORY")
        cur.close()

def get_session():
    with SQLModelSession(engine) as session:
        yield session
