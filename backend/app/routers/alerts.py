from fastapi import APIRouter, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.alert import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[Alert])
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
    return results
