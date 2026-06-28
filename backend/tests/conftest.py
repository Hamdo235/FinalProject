"""Shared pytest configuration.

Redirects the whole test session to an isolated temporary SQLite database so
tests never read from or corrupt the development database in ``data/csllm.db``.
The ``DATABASE_URL`` override must be set *before* any ``app.*`` module is
imported (pytest loads this conftest before collecting test modules).
"""
import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.gettempdir()) / "csllm_test.db"
for _suffix in ("", "-wal", "-shm"):
    _p = Path(str(_TEST_DB) + _suffix)
    if _p.exists():
        _p.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

import pytest  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
def _create_test_schema():
    """Create all tables once for the test session."""
    # Import every model module so its table is registered on SQLModel.metadata.
    import app.models.alert  # noqa: F401
    import app.models.chat  # noqa: F401
    import app.models.defense_action  # noqa: F401
    import app.models.incident  # noqa: F401
    import app.models.ip_enrichment  # noqa: F401
    import app.models.label  # noqa: F401
    import app.models.llm_trace  # noqa: F401
    from app.db.session import engine

    SQLModel.metadata.create_all(bind=engine)
    yield
