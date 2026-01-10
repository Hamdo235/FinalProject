from fastapi import APIRouter, Depends, HTTPException
from typing import List, Literal
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.alert import Alert
from ..models.label import AlertLabel

router = APIRouter(prefix="/validation", tags=["validation"])

LabelType = Literal["true_attack", "false_positive"]

@router.post("/alerts/{alert_id}")
def label_alert(alert_id: int, label: LabelType, db: Session = Depends(get_session)):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.add(AlertLabel(alert_id=alert_id, label=label))
    db.commit()
    return {"ok": True}

@router.get("/alerts/{alert_id}", response_model=List[AlertLabel])
def get_labels(alert_id: int, db: Session = Depends(get_session)):
    stmt = select(AlertLabel).where(AlertLabel.alert_id == alert_id).order_by(AlertLabel.noted_at.desc())
    return db.exec(stmt).all()
