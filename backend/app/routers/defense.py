from datetime import datetime, timedelta, UTC
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import select

from ..db.session import get_session
from ..models.defense_action import DefenseAction
from ..services.defense import (
    action_to_dict,
    defense_mode,
    expire_actions,
    get_active_block_for_ip,
)


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

router = APIRouter(prefix="/defense", tags=["defense"])


@router.get("/actions")
def list_actions(
    limit: int = 100,
    active: Optional[bool] = None,
    ip: Optional[str] = None,
    db: Session = Depends(get_session),
):
    expire_actions(db)
    stmt = select(DefenseAction).order_by(DefenseAction.created_at.desc()).limit(limit)
    if active is not None:
        stmt = stmt.where(DefenseAction.active == active)
    if ip:
        stmt = stmt.where(DefenseAction.ip == ip)
    items = db.exec(stmt).all()
    return [action_to_dict(i) for i in items]


@router.get("/status/{ip}")
def defense_status(ip: str, db: Session = Depends(get_session)):
    blocked = get_active_block_for_ip(db, ip)
    return {
        "ip": ip,
        "mode": defense_mode(),
        "blocked": blocked is not None,
        "block": action_to_dict(blocked) if blocked else None,
    }


@router.post("/actions/{action_id}/approve")
def approve_action(action_id: int, db: Session = Depends(get_session)):
    item = db.get(DefenseAction, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Defense action not found")
    if item.action not in {"review", "monitor"}:
        return {"ok": True, "action": action_to_dict(item)}
    item.action = "block_temp"
    item.active = True
    item.created_by = "human"
    if item.expires_at is None:
        item.expires_at = _utcnow_naive() + timedelta(minutes=30)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"ok": True, "action": action_to_dict(item)}


@router.post("/actions/{action_id}/revoke")
def revoke_action(action_id: int, db: Session = Depends(get_session)):
    item = db.get(DefenseAction, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Defense action not found")
    item.active = False
    item.created_by = "human"
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"ok": True, "action": action_to_dict(item)}


@router.post("/expire")
def run_expire(db: Session = Depends(get_session)):
    count = expire_actions(db)
    return {"expired": count}
