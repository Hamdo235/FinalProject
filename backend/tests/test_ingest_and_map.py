import pytest
from sqlmodel import Session, SQLModel
from app.db.session import engine
from app.routers.demo import demo_reset
from app.routers.ingest import ingest_logs
from app.routers.alerts import list_alerts
from app.routers.map import map_points

@pytest.mark.anyio
async def test_ingest_creates_alerts():
    SQLModel.metadata.create_all(bind=engine)
    with Session(engine) as db:
        demo_reset(db=db)
        payload = {"source": "ssh", "ip": "203.0.113.5", "user": "root", "status": "fail"}
        result = await ingest_logs(payload=payload, db=db)
        assert result.get("ingested") == 1
        alerts = list_alerts(db=db)
        assert isinstance(alerts, list)
        assert len(alerts) >= 1
        # basic properties
        a = alerts[0]
        assert a["source"] == "ssh"
        assert a["status"] in ("open", "closed")


@pytest.mark.anyio
async def test_map_points_without_geoip_returns_list():
    # Even without GeoIP DB, endpoint should return JSON array (possibly empty)
    with Session(engine) as db:
        data = map_points(db=db)
    assert isinstance(data, list)
