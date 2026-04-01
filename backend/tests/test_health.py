import pytest
from app.routers.health import health

@pytest.mark.anyio
async def test_health():
    data = await health()
    assert data.get("status") in ("ok", "degraded")
