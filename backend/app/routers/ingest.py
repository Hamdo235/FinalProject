from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from ..db.session import get_session
from ..models.alert import Alert
from ..models.ip_enrichment import IPEnrichment
from datetime import datetime, UTC
import json
import asyncio
import logging
from ..services.sse import publish_alert_created
from ..services.geoip import lookup_ip
from ..services.detection import score_with_isolation_forest
from ..services.defense import decide_defense_action, create_defense_action, action_to_dict
from ..core.settings import settings

router = APIRouter(prefix="/ingest", tags=["ingest"])
logger = logging.getLogger(__name__)

_MAX_BATCH_SIZE = 500


class LogRecord(BaseModel):
    """Schema for a single ingested log record.

    Permissive on extra fields (kept in features_json) but typed on the core
    columns used by the detector and persistence layers.
    """
    model_config = ConfigDict(extra="allow")

    source: str = Field(default="unknown", max_length=64)
    ip: Optional[str] = Field(default=None, max_length=45)  # IPv6 max length
    user: Optional[str] = Field(default=None, max_length=128)
    status: Optional[str] = Field(default=None, max_length=64)
    ts: Optional[str] = Field(default=None, max_length=64)
    rule: Optional[str] = Field(default=None, max_length=64)


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _to_alert(rec: Union[LogRecord, Dict[str, Any]], db: Session) -> Alert:
    rec_dict: Dict[str, Any] = (
        rec.model_dump() if isinstance(rec, LogRecord) else dict(rec)
    )
    source = str(rec_dict.get("source") or "unknown")
    ip = rec_dict.get("ip")
    user = rec_dict.get("user")
    # ML-based (with heuristic fallback inside)
    score, rule, severity = score_with_isolation_forest(rec_dict, db)
    ts = rec_dict.get("ts")
    try:
        ts_dt = datetime.fromisoformat(ts) if ts else _utcnow_naive()
    except (TypeError, ValueError):
        ts_dt = _utcnow_naive()
    features_json = json.dumps(rec_dict)
    return Alert(ts=ts_dt, source=source, ip=ip, user=user, rule=rule, severity=severity, features_json=features_json, score=score)


def _alert_payload(a: Alert) -> Dict[str, Any]:
    data = a.model_dump()
    if isinstance(data.get("ts"), datetime):
        data["ts"] = data["ts"].isoformat()
    return data


@router.post("/logs")
async def ingest_logs(
    payload: Union[LogRecord, List[LogRecord]],
    db: Session = Depends(get_session),
    request: Request = None,
):
    expected = settings.admin_token
    if expected:
        provided = request.headers.get("X-ADMIN-TOKEN") if request else None
        if provided != expected:
            client_ip = request.client.host if request and request.client else "unknown"
            logger.warning("[IngestAuth] Unauthorized ingest attempt from ip=%s", client_ip)
            raise HTTPException(status_code=401, detail="Unauthorized")

    items: List[LogRecord] = payload if isinstance(payload, list) else [payload]
    if len(items) > _MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Batch trop volumineux ({len(items)} items, max {_MAX_BATCH_SIZE}).",
        )
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
    except Exception as exc:
        logger.debug("[Ingest] GeoIP enrichment failed: %s", exc)
    # publish SSE events asynchronously
    for a in alerts:
        if a.id is not None:
            sse_payload = _alert_payload(a)
            sse_payload["defense"] = action_map.get(a.id)
            asyncio.create_task(publish_alert_created(sse_payload))
    return {"ingested": len(alerts)}
