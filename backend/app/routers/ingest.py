from fastapi import APIRouter, Depends
from typing import Any, Dict, List, Union
from sqlalchemy.orm import Session
from ..db.session import get_session
from ..models.alert import Alert
from ..models.ip_enrichment import IPEnrichment
from datetime import datetime, UTC
import json
import asyncio
from ..services.sse import publish_alert_created
from ..services.geoip import lookup_ip
from ..services.detection import score_with_isolation_forest
from ..services.defense import decide_defense_action, create_defense_action, action_to_dict

router = APIRouter(prefix="/ingest", tags=["ingest"])

LogRecord = Dict[str, Any]


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _to_alert(rec: LogRecord, db: Session) -> Alert:
    source = str(rec.get("source", "unknown"))
    ip = rec.get("ip")
    user = rec.get("user")
    # ML-based (with heuristic fallback inside)
    score, rule, severity = score_with_isolation_forest(rec, db)
    ts = rec.get("ts")
    try:
        ts_dt = datetime.fromisoformat(ts) if ts else _utcnow_naive()
    except (TypeError, ValueError):
        ts_dt = _utcnow_naive()
    features_json = json.dumps(rec)
    return Alert(ts=ts_dt, source=source, ip=ip, user=user, rule=rule, severity=severity, features_json=features_json, score=score)


def _alert_payload(a: Alert) -> Dict[str, Any]:
    data = a.model_dump()
    if isinstance(data.get("ts"), datetime):
        data["ts"] = data["ts"].isoformat()
    return data


@router.post("/logs")
async def ingest_logs(payload: Union[LogRecord, List[LogRecord]], db: Session = Depends(get_session)):
    items: List[LogRecord] = payload if isinstance(payload, list) else [payload]
    alerts: List[Alert] = [_to_alert(rec, db) for rec in items]
    action_map: Dict[int, Dict[str, Any]] = {}
    for a in alerts:
        db.add(a)
    db.commit()
    for a in alerts:
        db.refresh(a)
        decision = decide_defense_action(a)
        action = create_defense_action(db, a, decision)
        if a.id is not None:
            action_map[a.id] = action_to_dict(action)
    # GeoIP enrichment (best effort)
    try:
        ips = {a.ip for a in alerts if a.ip}
        for ip in ips:
            existing = db.get(IPEnrichment, ip)
            country, lat, lon = lookup_ip(ip)  # may return Nones if DB absent
            if existing:
                # update only if we can improve data
                updated = False
                if existing.country is None and country is not None:
                    existing.country = country; updated = True
                if (existing.lat is None or existing.lon is None) and (lat is not None and lon is not None):
                    existing.lat = lat; existing.lon = lon; updated = True
                if updated:
                    db.add(existing)
            else:
                enr = IPEnrichment(ip=ip, country=country, lat=lat, lon=lon)
                db.add(enr)
        db.commit()
    except Exception:
        pass
    # publish SSE events asynchronously
    for a in alerts:
        if a.id is not None:
            payload = _alert_payload(a)
            payload["defense"] = action_map.get(a.id)
            asyncio.create_task(publish_alert_created(payload))
    return {"ingested": len(alerts)}
