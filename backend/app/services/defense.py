from __future__ import annotations

from datetime import datetime, timedelta, UTC
from typing import Any, Dict, Optional
import os

from sqlmodel import select
from sqlalchemy.orm import Session

from ..models.alert import Alert
from ..models.defense_action import DefenseAction


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def defense_mode() -> str:
    mode = os.getenv("DEFENSE_MODE", "assist").strip().lower()
    if mode not in {"off", "monitor", "assist", "auto"}:
        return "assist"
    return mode


def defense_enforce_api() -> bool:
    return _env_bool("DEFENSE_ENFORCE_API", False)


def _auto_block_threshold() -> float:
    try:
        return float(os.getenv("DEFENSE_AUTO_BLOCK_THRESHOLD", "0.85"))
    except Exception:
        return 0.85


def _review_threshold() -> float:
    try:
        return float(os.getenv("DEFENSE_REVIEW_THRESHOLD", "0.6"))
    except Exception:
        return 0.6


def _block_ttl_minutes() -> int:
    try:
        return max(1, int(os.getenv("DEFENSE_BLOCK_TTL_MINUTES", "30")))
    except Exception:
        return 30


def _is_known_rule(rule: Optional[str]) -> bool:
    if not rule:
        return False
    return not str(rule).startswith("ml_")


def decide_defense_action(alert: Alert) -> Dict[str, Any]:
    mode = defense_mode()
    score = float(alert.score or 0.0)
    severity = str(alert.severity or "medium").lower()
    known_rule = _is_known_rule(alert.rule)

    if mode == "off":
        return {
            "mode": mode,
            "action": "allow",
            "reason": "defense_off",
            "confidence": score,
            "active": False,
            "requires_approval": False,
            "ttl_minutes": 0,
        }

    if mode == "monitor":
        return {
            "mode": mode,
            "action": "monitor",
            "reason": "monitor_only",
            "confidence": score,
            "active": False,
            "requires_approval": False,
            "ttl_minutes": 0,
        }

    auto_thr = _auto_block_threshold()
    review_thr = _review_threshold()

    if known_rule and (severity == "high" or score >= auto_thr):
        return {
            "mode": mode,
            "action": "block_temp",
            "reason": f"known_attack:{alert.rule}",
            "confidence": score,
            "active": True,
            "requires_approval": False,
            "ttl_minutes": _block_ttl_minutes(),
        }

    if mode == "auto" and score >= auto_thr:
        return {
            "mode": mode,
            "action": "block_temp",
            "reason": f"high_confidence:{alert.rule or 'anomaly'}",
            "confidence": score,
            "active": True,
            "requires_approval": False,
            "ttl_minutes": _block_ttl_minutes(),
        }

    if score >= review_thr:
        return {
            "mode": mode,
            "action": "review",
            "reason": f"needs_review:{alert.rule or 'suspicious'}",
            "confidence": score,
            "active": False,
            "requires_approval": True,
            "ttl_minutes": 0,
        }

    return {
        "mode": mode,
        "action": "monitor",
        "reason": "low_risk",
        "confidence": score,
        "active": False,
        "requires_approval": False,
        "ttl_minutes": 0,
    }


def create_defense_action(db: Session, alert: Alert, decision: Dict[str, Any], created_by: str = "system") -> DefenseAction:
    expires_at = None
    ttl = int(decision.get("ttl_minutes") or 0)
    if ttl > 0 and decision.get("action") == "block_temp":
        expires_at = _utcnow_naive() + timedelta(minutes=ttl)

    item = DefenseAction(
        alert_id=alert.id,
        ip=alert.ip,
        action=str(decision.get("action") or "monitor"),
        reason=str(decision.get("reason") or ""),
        confidence=float(decision.get("confidence") or 0.0),
        mode=str(decision.get("mode") or defense_mode()),
        expires_at=expires_at,
        active=bool(decision.get("active", False)),
        created_by=created_by,
    )
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except Exception:
        # Defense layer must stay additive: if persistence is unavailable,
        # keep ingest path functional and return transient action metadata.
        db.rollback()
        try:
            db.expunge(item)
        except Exception:
            pass
    return item


def expire_actions(db: Session) -> int:
    now = _utcnow_naive()
    stmt = select(DefenseAction).where(DefenseAction.active == True).where(DefenseAction.expires_at.is_not(None))
    try:
        rows = db.exec(stmt).all()
    except Exception:
        return 0
    count = 0
    for row in rows:
        if row.expires_at is not None and row.expires_at <= now:
            row.active = False
            db.add(row)
            count += 1
    if count > 0:
        try:
            db.commit()
        except Exception:
            db.rollback()
            return 0
    return count


def get_latest_action_for_alert(db: Session, alert_id: int) -> Optional[DefenseAction]:
    stmt = (
        select(DefenseAction)
        .where(DefenseAction.alert_id == alert_id)
        .order_by(DefenseAction.created_at.desc())
        .limit(1)
    )
    try:
        return db.exec(stmt).first()
    except Exception:
        return None


def get_active_block_for_ip(db: Session, ip: Optional[str]) -> Optional[DefenseAction]:
    if not ip:
        return None
    expire_actions(db)
    stmt = (
        select(DefenseAction)
        .where(DefenseAction.ip == ip)
        .where(DefenseAction.active == True)
        .where(DefenseAction.action == "block_temp")
        .order_by(DefenseAction.created_at.desc())
        .limit(1)
    )
    try:
        return db.exec(stmt).first()
    except Exception:
        return None


def is_ip_blocked(db: Session, ip: Optional[str]) -> bool:
    return get_active_block_for_ip(db, ip) is not None


def action_to_dict(item: DefenseAction) -> Dict[str, Any]:
    ip = item.ip
    return {
        "id": item.id,
        "alert_id": item.alert_id,
        "ip": ip,
        "action": item.action,
        "reason": item.reason,
        "confidence": item.confidence,
        "mode": item.mode,
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "active": item.active,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "created_by": item.created_by,
        "approved_by": getattr(item, "approved_by", None),
        "approved_at": item.approved_at.isoformat() if getattr(item, "approved_at", None) else None,
        "revoked_at": item.revoked_at.isoformat() if getattr(item, "revoked_at", None) else None,
        "iptables_command": f"iptables -A INPUT -s {ip} -j DROP" if ip else None,
        "iptables_unblock": f"iptables -D INPUT -s {ip} -j DROP" if ip else None,
    }
