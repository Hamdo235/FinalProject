from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.alert import Alert
from ..schemas.alert import AlertOut
from ..schemas.defense import DefenseActionOut
from ..services.defense import action_to_dict, get_latest_actions_for_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertOut])
def list_alerts(
    limit: int = 100,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_session),
) -> List[AlertOut]:
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit doit être entre 1 et 1000.")
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(limit)
    if status:
        stmt = stmt.where(Alert.status == status)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    results = db.exec(stmt).all()

    # Batch-load latest defense action for all alerts in a single IN-query (was N+1).
    alert_ids = [a.id for a in results if a.id is not None]
    latest_by_alert = get_latest_actions_for_alerts(db, alert_ids)

    payload: List[AlertOut] = []
    for a in results:
        latest = latest_by_alert.get(a.id) if a.id is not None else None
        defense = DefenseActionOut.from_dict(action_to_dict(latest)) if latest else None
        payload.append(AlertOut.model_validate({**a.model_dump(), "defense": defense}))
    return payload
