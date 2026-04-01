from fastapi import APIRouter, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.alert import Alert
from ..services.defense import get_latest_action_for_alert, action_to_dict

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("")
def list_alerts(
    limit: int = 100,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_session),
):
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(limit)
    if status:
        stmt = stmt.where(Alert.status == status)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    results = db.exec(stmt).all()
    payload = []
    for a in results:
        item = a.model_dump()
        latest = get_latest_action_for_alert(db, a.id or 0)
        item["defense"] = action_to_dict(latest) if latest else None
        payload.append(item)
    return payload
