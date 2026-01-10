from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.incident import Incident
from ..models.alert import Alert
import json

router = APIRouter(prefix="/incidents", tags=["incidents"])

@router.get("", response_model=List[Incident])
def list_incidents(limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_session)):
    stmt = select(Incident).order_by(Incident.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Incident.status == status)
    return db.exec(stmt).all()

@router.get("/{incident_id}", response_model=Incident)
def get_incident(incident_id: int, db: Session = Depends(get_session)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc

@router.post("/from-alerts", response_model=Incident)
def create_incident_from_alerts(alert_ids: List[int], db: Session = Depends(get_session)):
    alerts = [db.get(Alert, i) for i in alert_ids]
    alerts = [a for a in alerts if a is not None]
    if not alerts:
        raise HTTPException(status_code=400, detail="No valid alerts provided")
    summary = f"Incident créé à partir de {len(alerts)} alerte(s)."
    inc = Incident(summary=summary, related_alerts_json=json.dumps(alert_ids), risk="medium", confidence=0.5)
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return inc
