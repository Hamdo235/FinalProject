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
        created += 1
    db.commit()
    # Refresh to ensure IDs are present
    try:
        # Reload last inserted alerts for SSE publish
        for rec in samples:
            rule = "ssh_failed_login" if rec.get("status") == "fail" else "ssh_login"
            a = db.query(Alert).filter(Alert.rule == rule, Alert.ip == rec.get("ip")).order_by(Alert.id.desc()).first()
            if a and a.id:
                asyncio.create_task(publish_alert_created(a.id, a.severity))
    except Exception:
        pass
    # Best-effort GeoIP enrichment for the IPs we just inserted
    try:
        ips = {rec.get("ip") for rec in samples if rec.get("ip")}
        for ip in ips:
            existing = db.get(IPEnrichment, ip)
            country, lat, lon = lookup_ip(ip)
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
