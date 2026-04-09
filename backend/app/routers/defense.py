from datetime import datetime, timedelta, UTC
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
from ..services import ip_blacklist


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


router = APIRouter(prefix="/defense", tags=["defense"])


class ApproveBody(BaseModel):
    approved_by: str = "Analyste SOC"


class ManualBlockBody(BaseModel):
    ip: str
    reason: str = "Blocage manuel"
    ttl_minutes: int = 30
    approved_by: str = "Analyste SOC"


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
    blocked_mem = ip_blacklist.is_blocked(ip)
    blocked_db = get_active_block_for_ip(db, ip)
    return {
        "ip": ip,
        "mode": defense_mode(),
        "blocked": blocked_mem or blocked_db is not None,
        "in_memory_blacklist": blocked_mem,
        "block": action_to_dict(blocked_db) if blocked_db else ip_blacklist.get_blocked_entry(ip),
    }


@router.get("/blocked")
def get_blocked_ips() -> List[Dict[str, Any]]:
    """Retourne toutes les IPs actuellement bloquées (lecture mémoire O(1))."""
    return ip_blacklist.get_all()


@router.post("/actions/{action_id}/approve")
def approve_action(
    action_id: int,
    body: ApproveBody = ApproveBody(),
    db: Session = Depends(get_session),
):
    item = db.get(DefenseAction, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Defense action not found")
    if item.action == "block_temp" and item.active:
        if item.ip:
            ip_blacklist.add_ip(
                ip=item.ip,
                expires_at=item.expires_at,
                reason=item.reason or "Blocage existant re-synchronisé",
                approved_by=item.approved_by or body.approved_by,
                action_id=item.id,
            )
        return {"ok": True, "action": action_to_dict(item), "message": "Déjà bloqué"}
    now = _utcnow_naive()
    item.action = "block_temp"
    item.active = True
    item.created_by = "human"
    item.approved_by = body.approved_by
    item.approved_at = now
    if item.expires_at is None:
        item.expires_at = now + timedelta(minutes=30)
    db.add(item)
    db.commit()
    db.refresh(item)

    if item.ip:
        ip_blacklist.add_ip(
            ip=item.ip,
            expires_at=item.expires_at,
            reason=item.reason or f"Approuvé par {body.approved_by}",
            approved_by=body.approved_by,
            action_id=item.id,
        )

    result = action_to_dict(item)
    expire_str = item.expires_at.strftime("%H:%M:%S") if item.expires_at else "indéfini"
    return {
        "ok": True,
        "action": result,
        "message": f"IP {item.ip} bloquée jusqu'à {expire_str}",
        "iptables_command": result["iptables_command"],
        "iptables_unblock": result["iptables_unblock"],
    }


@router.post("/actions/{action_id}/revoke")
def revoke_action(action_id: int, db: Session = Depends(get_session)):
    item = db.get(DefenseAction, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Defense action not found")
    now = _utcnow_naive()
    item.active = False
    item.created_by = "human"
    item.revoked_at = now
    db.add(item)
    db.commit()
    db.refresh(item)

    if item.ip:
        ip_blacklist.remove_ip(item.ip)

    return {
        "ok": True,
        "action": action_to_dict(item),
        "message": f"Blocage de l'IP {item.ip} révoqué.",
    }


@router.post("/block-manual")
def manual_block(body: ManualBlockBody, db: Session = Depends(get_session)):
    """Blocage manuel d'une IP par l'analyste (sans alerte existante)."""
    now = _utcnow_naive()
    expires_at = now + timedelta(minutes=body.ttl_minutes)

    item = DefenseAction(
        ip=body.ip,
        action="block_temp",
        reason=body.reason,
        confidence=1.0,
        mode=defense_mode(),
        expires_at=expires_at,
        active=True,
        created_by="human",
        approved_by=body.approved_by,
        approved_at=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    ip_blacklist.add_ip(
        ip=body.ip,
        expires_at=expires_at,
        reason=body.reason,
        approved_by=body.approved_by,
        action_id=item.id,
    )

    result = action_to_dict(item)
    return {
        "ok": True,
        "action": result,
        "message": f"IP {body.ip} bloquée manuellement pour {body.ttl_minutes} min.",
        "iptables_command": result["iptables_command"],
        "iptables_unblock": result["iptables_unblock"],
    }


@router.post("/unblock/{ip}")
def unblock_ip_direct(ip: str, db: Session = Depends(get_session)):
    """Débloque une IP directement par son adresse."""
    ip_blacklist.remove_ip(ip)
    stmt = (
        select(DefenseAction)
        .where(DefenseAction.ip == ip)
        .where(DefenseAction.active == True)
        .order_by(DefenseAction.created_at.desc())
        .limit(1)
    )
    item = db.exec(stmt).first()
    if item:
        item.active = False
        item.revoked_at = _utcnow_naive()
        db.add(item)
        db.commit()
    return {"ok": True, "message": f"IP {ip} débloquée.", "ip": ip}


@router.post("/expire")
def run_expire(db: Session = Depends(get_session)):
    count = expire_actions(db)
    return {"expired": count}
