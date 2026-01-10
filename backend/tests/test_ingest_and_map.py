from fastapi.testclient import TestClient
from app.main import app

def reset_demo(client: TestClient):
    client.post("/demo/reset")

def test_ingest_creates_alerts():
    client = TestClient(app)
    reset_demo(client)
    payload = {"source": "ssh", "ip": "203.0.113.5", "user": "root", "status": "fail"}
    r = client.post("/ingest/logs", json=payload)
    assert r.status_code == 200
    assert r.json().get("ingested") == 1
    # list alerts
    r2 = client.get("/alerts")
    assert r2.status_code == 200
    alerts = r2.json()
    assert isinstance(alerts, list)
    assert len(alerts) >= 1
    # basic properties
    a = alerts[0]
    assert a["source"] == "ssh"
    assert a["status"] in ("open", "closed")


def test_map_points_without_geoip_returns_list(client: TestClient | None = None):
    # Even without GeoIP DB, endpoint should return JSON array (possibly empty)
    client = client or TestClient(app)
    r = client.get("/map/points")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
