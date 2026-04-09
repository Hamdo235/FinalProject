"""
Liste noire d'IPs en mémoire — O(1) lookup, synchronisée avec la DB au démarrage.
Évite une requête SQLite à chaque requête HTTP entrante.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, UTC
from threading import Lock
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_lock = Lock()


@dataclass
class BlockEntry:
    ip: str
    expires_at: Optional[datetime]
    reason: str
    approved_by: str
    action_id: Optional[int]
    blocked_at: datetime = field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


_blacklist: Dict[str, BlockEntry] = {}


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def add_ip(
    ip: str,
    expires_at: Optional[datetime],
    reason: str,
    approved_by: str,
    action_id: Optional[int] = None,
) -> None:
    with _lock:
        _blacklist[ip] = BlockEntry(
            ip=ip,
            expires_at=expires_at,
            reason=reason,
            approved_by=approved_by,
            action_id=action_id,
        )
    logger.info("[Blacklist] IP ajoutée : %s (expire: %s)", ip, expires_at)


def remove_ip(ip: str) -> None:
    with _lock:
        removed = _blacklist.pop(ip, None)
    if removed:
        logger.info("[Blacklist] IP retirée : %s", ip)


def is_blocked(ip: str) -> bool:
    with _lock:
        entry = _blacklist.get(ip)
    if entry is None:
        return False
    if entry.expires_at is not None and entry.expires_at <= _utcnow():
        with _lock:
            _blacklist.pop(ip, None)
        logger.info("[Blacklist] IP expirée, retirée automatiquement : %s", ip)
        return False
    return True


def get_blocked_entry(ip: str) -> Optional[Dict[str, Any]]:
    with _lock:
        entry = _blacklist.get(ip)
    if entry is None:
        return None
    if entry.expires_at is not None and entry.expires_at <= _utcnow():
        with _lock:
            _blacklist.pop(ip, None)
        return None
    return _entry_to_dict(entry)


def get_all() -> List[Dict[str, Any]]:
    now = _utcnow()
    with _lock:
        expired = [ip for ip, e in _blacklist.items() if e.expires_at is not None and e.expires_at <= now]
        for ip in expired:
            del _blacklist[ip]
        result = [_entry_to_dict(e) for e in _blacklist.values()]
    return result


def count() -> int:
    with _lock:
        return len(_blacklist)


def _entry_to_dict(entry: BlockEntry) -> Dict[str, Any]:
    return {
        "ip": entry.ip,
        "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
        "reason": entry.reason,
        "approved_by": entry.approved_by,
        "action_id": entry.action_id,
        "blocked_at": entry.blocked_at.isoformat(),
        "iptables_command": f"iptables -A INPUT -s {entry.ip} -j DROP",
        "iptables_unblock": f"iptables -D INPUT -s {entry.ip} -j DROP",
    }


def sync_from_db(db: Any) -> None:
    """Charge les blocages actifs depuis la DB au démarrage."""
    try:
        from sqlmodel import select
        from ..models.defense_action import DefenseAction

        now = _utcnow()
        stmt = (
            select(DefenseAction)
            .where(DefenseAction.active == True)
            .where(DefenseAction.action == "block_temp")
        )
        rows = db.exec(stmt).all()
        loaded = 0
        for row in rows:
            if row.ip is None:
                continue
            if row.expires_at is not None and row.expires_at <= now:
                row.active = False
                db.add(row)
                continue
            add_ip(
                ip=row.ip,
                expires_at=row.expires_at,
                reason=row.reason or "Blocage restauré depuis la DB",
                approved_by=row.approved_by or row.created_by or "system",
                action_id=row.id,
            )
            loaded += 1
        db.commit()
        logger.info("[Blacklist] %d IP(s) chargée(s) depuis la DB au démarrage.", loaded)
    except Exception as exc:
        logger.warning("[Blacklist] Impossible de synchroniser depuis la DB : %s", exc)


async def expire_loop(interval_seconds: int = 60) -> None:
    """Tâche asyncio : retire les IPs expirées toutes les `interval_seconds` secondes."""
    while True:
        await asyncio.sleep(interval_seconds)
        now = _utcnow()
        with _lock:
            expired = [ip for ip, e in _blacklist.items() if e.expires_at is not None and e.expires_at <= now]
            for ip in expired:
                del _blacklist[ip]
        if expired:
            logger.info("[Blacklist] %d IP(s) expirée(s) purgée(s) : %s", len(expired), expired)
