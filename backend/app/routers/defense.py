from datetime import datetime, timedelta, UTC
from typing import Any, Dict, List, Optional
import asyncio
import ipaddress
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlmodel import select

from ..db.session import get_session
from ..models.defense_action import DefenseAction
from ..schemas.defense import DefenseActionOut
from ..services.defense import (
    action_to_dict,
    defense_mode,
    expire_actions,
    get_active_block_for_ip,
)
from ..services import ip_blacklist
from ..services.sse import publish_defense_changed
from ..core.settings import settings

logger = logging.getLogger(__name__)


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


router = APIRouter(prefix="/defense", tags=["defense"])


class ApproveBody(BaseModel):
    approved_by: str = "Analyste SOC"
    token: Optional[str] = None


class ManualBlockBody(BaseModel):
    ip: str
    reason: str = "Blocage manuel"
    ttl_minutes: int = 30
    approved_by: str = "Analyste SOC"
    token: Optional[str] = None


_TTL_MIN = 1
_TTL_MAX = 24 * 60  # 24 hours


def _require_admin_token(request: Request, body_token: Optional[str] = None) -> None:
    expected = settings.admin_token
    if not expected:
        # Compatibilité dev: si aucun token n'est configuré, on n'impose pas le contrôle.
        return
    provided = request.headers.get("X-ADMIN-TOKEN") or (body_token or "")
    if provided != expected:
        client_ip = request.client.host if request and request.client else "unknown"
        logger.warning("[DefenseAuth] Unauthorized access attempt from ip=%s", client_ip)
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/actions", response_model=List[DefenseActionOut])
def list_actions(
    limit: int = 100,
    active: Optional[bool] = None,
    ip: Optional[str] = None,
    db: Session = Depends(get_session),
) -> List[DefenseActionOut]:
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit doit être entre 1 et 1000.")
    # Expiration is handled by the background `expire_actions_loop` task.
    stmt = select(DefenseAction).order_by(DefenseAction.created_at.desc()).limit(limit)
    if active is not None:
        stmt = stmt.where(DefenseAction.active == active)
    if ip:
        stmt = stmt.where(DefenseAction.ip == ip)
    items = db.exec(stmt).all()
    return [DefenseActionOut.from_dict(action_to_dict(i)) for i in items]


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
async def approve_action(
    action_id: int,
    body: ApproveBody = ApproveBody(),
    db: Session = Depends(get_session),
    request: Request = None,
):
    _require_admin_token(request, body.token)
    item = db.get(DefenseAction, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Defense action not found")
    if item.action == "block_temp" and item.active:
        if not getattr(item, "approved_by", None):
            now = _utcnow_naive()
            item.approved_by = body.approved_by
            item.approved_at = now
            item.created_by = "human"
            db.add(item)
            db.commit()
            db.refresh(item)
        if item.ip:
            ip_blacklist.add_ip(
                ip=item.ip,
                expires_at=item.expires_at,
                reason=item.reason or "Blocage re-synchronisé",
                approved_by=item.approved_by or body.approved_by,
                action_id=item.id,
            )
        result = action_to_dict(item)
        try:
            asyncio.create_task(publish_defense_changed("approved", result))
        except RuntimeError:
            pass
        return {"ok": True, "action": result, "message": f"IP {item.ip} confirmée bloquée par {item.approved_by}", "iptables_command": result["iptables_command"], "iptables_unblock": result["iptables_unblock"]}
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
    try:
        asyncio.create_task(publish_defense_changed("approved", result))
    except RuntimeError:
        pass
    return {
        "ok": True,
        "action": result,
        "message": f"IP {item.ip} bloquée jusqu'à {expire_str}",
        "iptables_command": result["iptables_command"],
        "iptables_unblock": result["iptables_unblock"],
    }


@router.post("/actions/{action_id}/revoke")
async def revoke_action(action_id: int, db: Session = Depends(get_session), request: Request = None):
    _require_admin_token(request)
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

    result = action_to_dict(item)
    try:
        asyncio.create_task(publish_defense_changed("revoked", result))
    except RuntimeError:
        pass
    return {
        "ok": True,
        "action": result,
        "message": f"Blocage de l'IP {item.ip} révoqué.",
    }


@router.post("/block-manual")
async def manual_block(body: ManualBlockBody, db: Session = Depends(get_session), request: Request = None):
    """Blocage manuel d'une IP par l'analyste (sans alerte existante)."""
    _require_admin_token(request, body.token)
    try:
        ipaddress.ip_address(body.ip)
    except ValueError:
        logger.warning("[Defense] Invalid IP in manual block request: %s", body.ip)
        raise HTTPException(status_code=400, detail="Invalid IP address")
    if body.ttl_minutes < _TTL_MIN or body.ttl_minutes > _TTL_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"ttl_minutes doit être entre {_TTL_MIN} et {_TTL_MAX}.",
        )

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
    try:
        asyncio.create_task(publish_defense_changed("manual_block", result))
    except RuntimeError:
        pass
    return {
        "ok": True,
        "action": result,
        "message": f"IP {body.ip} bloquée manuellement pour {body.ttl_minutes} min.",
        "iptables_command": result["iptables_command"],
        "iptables_unblock": result["iptables_unblock"],
    }


@router.post("/unblock/{ip}")
async def unblock_ip_direct(ip: str, db: Session = Depends(get_session), request: Request = None):
    """Débloque une IP directement par son adresse."""
    _require_admin_token(request)
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        logger.warning("[Defense] Invalid IP in unblock request: %s", ip)
        raise HTTPException(status_code=400, detail="Invalid IP address")
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
    try:
        asyncio.create_task(
            publish_defense_changed("unblock", {"ip": ip, "id": item.id if item else None})
        )
    except RuntimeError:
        pass
    return {"ok": True, "message": f"IP {ip} débloquée.", "ip": ip}


@router.post("/actions/{action_id}/auto-decide")
async def auto_decide(
    action_id: int,
    db: Session = Depends(get_session),
    request: Request = None,
):
    """
    Appelé par le frontend quand le délai analyste expire sans réponse humaine.
    Le LLM analyse le contexte de l'alerte et prend une décision autonome :
    block → approuve l'action, allow → révoque l'action.
    """
    item = db.get(DefenseAction, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Defense action not found")
    if item.approved_by or item.approved_at or item.revoked_at:
        return {"ok": True, "already_decided": True, "action": action_to_dict(item)}

    # ── Construire le prompt LLM ──
    score_10 = round(float(item.confidence or 0) * 10, 1)
    prompt = f"""Tu es un analyste SOC autonome. Un incident a dépassé le délai de supervision humaine.
Tu dois décider immédiatement : BLOQUER ou AUTORISER l'IP source.

Données de l'alerte :
- IP source     : {item.ip or "inconnue"}
- Règle détectée: {item.reason or "inconnue"}
- Score ML      : {score_10}/10
- Action initiale suggérée : {item.action}

Réponds UNIQUEMENT avec un objet JSON valide sans texte avant ni après :
{{
  "decision": "block" ou "allow",
  "confidence": <float entre 0.0 et 1.0>,
  "reasoning": "<explication courte en français, 1-2 phrases>"
}}"""

    llm_decision = "block"
    llm_confidence = float(item.confidence or 0.5)
    llm_reasoning = "Décision automatique par défaut (LLM indisponible)."

    try:
        import httpx, json as _json
        from ..core.settings import settings as _s
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{_s.ollama_base_url}/api/generate",
                json={"model": "qwen2.5:1.5b", "prompt": prompt, "stream": False},
            )
            if resp.status_code == 200:
                raw = resp.json().get("response", "")
                start = raw.find("{")
                end   = raw.rfind("}") + 1
                if start != -1 and end > start:
                    parsed = _json.loads(raw[start:end])
                    llm_decision   = str(parsed.get("decision", "block")).lower().strip()
                    llm_confidence = float(parsed.get("confidence", llm_confidence))
                    llm_reasoning  = str(parsed.get("reasoning", llm_reasoning))
    except Exception as exc:
        logger.warning("[AutoDecide] LLM call failed for action %s: %s", action_id, exc)
        # Fallback heuristic: score >= 0.7 → block
        llm_decision = "block" if float(item.confidence or 0) >= 0.7 else "allow"

    actor = f"LLM SOC IA (auto — {llm_decision.upper()})"
    now = _utcnow_naive()

    if llm_decision == "block":
        item.action     = "block_temp"
        item.active     = True
        item.created_by = "system"
        item.approved_by = actor
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
                reason=item.reason or f"Auto-bloqué par LLM : {llm_reasoning}",
                approved_by=actor,
                action_id=item.id,
            )
        result = action_to_dict(item)
        try:
            asyncio.create_task(publish_defense_changed("auto_block", result))
        except RuntimeError:
            pass
        return {
            "ok": True,
            "decision": "block",
            "actor": actor,
            "reasoning": llm_reasoning,
            "confidence": llm_confidence,
            "action": result,
            "iptables_command": result.get("iptables_command"),
        }
    else:
        item.active     = False
        item.revoked_at = now
        item.approved_by = actor
        db.add(item)
        db.commit()
        db.refresh(item)
        if item.ip:
            ip_blacklist.remove_ip(item.ip)
        result = action_to_dict(item)
        try:
            asyncio.create_task(publish_defense_changed("auto_allow", result))
        except RuntimeError:
            pass
        return {
            "ok": True,
            "decision": "allow",
            "actor": actor,
            "reasoning": llm_reasoning,
            "confidence": llm_confidence,
            "action": result,
        }


@router.post("/expire")
def run_expire(db: Session = Depends(get_session), request: Request = None):
    _require_admin_token(request)
    count = expire_actions(db)
    return {"expired": count}
