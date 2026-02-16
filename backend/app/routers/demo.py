from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlmodel import delete
from ..db.session import get_session
from ..models.alert import Alert
from ..models.incident import Incident
from ..models.llm_trace import LLMTrace
from ..models.ip_enrichment import IPEnrichment
from datetime import datetime
import json
from ..services.geoip import lookup_ip
import asyncio
from ..services.sse import publish_alert_created

router = APIRouter(prefix="/demo", tags=["demo"])


def _alert_payload(a: Alert) -> dict:
    data = a.dict()
    if isinstance(data.get("ts"), datetime):
        data["ts"] = data["ts"].isoformat()
    return data

_DEMO_GEOIP_FALLBACK = {
    "8.8.8.8": {"country": "US", "lat": 37.751, "lon": -97.822},
    "1.1.1.1": {"country": "AU", "lat": -33.494, "lon": 143.2104},
    "203.0.113.5": {"country": "JP", "lat": 35.6762, "lon": 139.6503},
}

@router.post("/generate")
async def demo_generate(db: Session = Depends(get_session)):
    # Generate a few SSH logs as alerts
    now = datetime.utcnow().isoformat()
    samples = [
        {"ts": now, "source": "ssh", "ip": "8.8.8.8", "user": "root", "status": "fail"},
        {"ts": now, "source": "ssh", "ip": "1.1.1.1", "user": "admin", "status": "fail"},
        {"ts": now, "source": "ssh", "ip": "203.0.113.5", "user": "user", "status": "success"},
    ]
    created = 0
    created_alerts = []
    for rec in samples:
        rule = "ssh_failed_login" if rec.get("status") == "fail" else "ssh_login"
        severity = "high" if rec.get("status") == "fail" else "low"
        score = 0.8 if rec.get("status") == "fail" else 0.2
        a = Alert(
            ts=datetime.fromisoformat(rec["ts"]),
            source=rec["source"],
            ip=rec.get("ip"),
            user=rec.get("user"),
            rule=rule,
            severity=severity,
            features_json=json.dumps(rec),
            score=score,
        )
        db.add(a)
        created_alerts.append(a)
        created += 1
    db.commit()
    for a in created_alerts:
        db.refresh(a)
    # Refresh to ensure IDs are present
    try:
        # Reload last inserted alerts for SSE publish
        for a in created_alerts:
            if a and a.id:
                asyncio.create_task(publish_alert_created(_alert_payload(a)))
    except Exception:
        pass
    # Best-effort GeoIP enrichment for the IPs we just inserted
    try:
        ips = {rec.get("ip") for rec in samples if rec.get("ip")}
        for ip in ips:
            existing = db.get(IPEnrichment, ip)
            country, lat, lon = lookup_ip(ip)
            if (lat is None or lon is None) and ip in _DEMO_GEOIP_FALLBACK:
                fb = _DEMO_GEOIP_FALLBACK[ip]
                country = country or fb.get("country")
                lat = lat if lat is not None else fb.get("lat")
                lon = lon if lon is not None else fb.get("lon")
            if existing:
                updated = False
                if existing.country is None and country is not None:
                    existing.country = country; updated = True
                if (existing.lat is None or existing.lon is None) and (lat is not None and lon is not None):
                    existing.lat = lat; existing.lon = lon; updated = True
                if updated:
                    db.add(existing)
            else:
                db.add(IPEnrichment(ip=ip, country=country, lat=lat, lon=lon))
        db.commit()
    except Exception:
        pass
    return {"created": created}

@router.post("/reset")
def demo_reset(db: Session = Depends(get_session)):
    # wipe incidents and alerts and llm traces and enrichment
    db.exec(delete(LLMTrace))
    db.exec(delete(Incident))
    db.exec(delete(Alert))
    db.exec(delete(IPEnrichment))
    db.commit()
    return {"reset": True}
