from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Literal
import httpx
import asyncio
import os
import socket
from urllib.parse import urlparse
from fastapi.responses import StreamingResponse
import json
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from sqlalchemy import func
from ..db.session import get_session
from ..models.alert import Alert
from ..models.incident import Incident
from ..models.defense_action import DefenseAction
from ..core.settings import settings
from ..services import ip_blacklist
from ..services.defense import defense_mode

router = APIRouter(prefix="/llm", tags=["LLM"])

OLLAMA_URL = settings.ollama_url
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
OLLAMA_TIMEOUT = settings.ollama_timeout_seconds

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: str = "global"
    # Active le mode hybride: si la question concerne la plateforme,
    # on ajoute un contexte (alertes/incidents) au prompt système
    auto_tool: bool = True
    voice_mode: bool = False  # When True: short prompt + capped tokens for voice


def _summarize_alerts(db: Session, limit: int = 10, since: datetime | None = None) -> dict:
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(max(1, min(limit, 200)))
    if since:
        stmt = stmt.where(Alert.ts >= since)
    alerts = db.exec(stmt).all()
    counts = {"low": 0, "medium": 0, "high": 0}
    for a in alerts:
        sev = str(a.severity or "").lower()
        if sev in counts:
            counts[sev] += 1
    return {
        "total": len(alerts),
        "by_severity": counts,
        "examples": [
            {
                "id": a.id,
                "ts": str(a.ts),
                "source": a.source,
                "ip": a.ip,
                "rule": a.rule,
                "severity": a.severity,
                "score": round(float(a.score or 0), 2),
            }
            for a in alerts[:5]
        ],
    }


def _summarize_incidents(db: Session, limit: int = 5) -> dict:
    stmt = select(Incident).order_by(Incident.created_at.desc()).limit(max(1, min(limit, 100)))
    incs = db.exec(stmt).all()
    by_status = {}
    for i in incs:
        st = i.status or "unknown"
        by_status[st] = by_status.get(st, 0) + 1
    return {
        "total": len(incs),
        "by_status": by_status,
        "examples": [
            {
                "id": i.id,
                "created_at": str(i.created_at),
                "status": i.status,
                "risk": i.risk,
                "confidence": i.confidence,
                "summary": i.summary,
            }
            for i in incs[:5]
        ],
    }


def _build_platform_context(db: Session) -> str:
    """Snapshot temps réel de la plateforme — injecté dans chaque message."""
    now       = datetime.now(timezone.utc).replace(tzinfo=None)
    today     = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_hour = now - timedelta(hours=1)

    alerts_today     = _summarize_alerts(db, limit=100, since=today)
    alerts_last_hour = _summarize_alerts(db, limit=50,  since=last_hour)
    alerts_recent    = _summarize_alerts(db, limit=10)
    incs             = _summarize_incidents(db, limit=5)
    mode             = defense_mode()
    blocked          = ip_blacklist.count()

    total_alerts_db = db.exec(select(func.count()).select_from(Alert)).one()
    total_incs_db   = db.exec(select(func.count()).select_from(Incident)).one()

    active_blocks = db.exec(
        select(DefenseAction)
        .where(DefenseAction.active == True)  # noqa: E712
        .order_by(DefenseAction.created_at.desc())
        .limit(5)
    ).all()
    blocks_info = [{"ip": b.ip, "action": b.action, "reason": b.reason} for b in active_blocks]

    lines = [
        "=== ÉTAT TEMPS RÉEL DE LA PLATEFORME CYBERSENTINEL ===",
        f"Date/heure actuelle : {now.strftime('%Y-%m-%d %H:%M:%S')} UTC",
        f"Mode de défense actif : {mode}",
        f"IPs bloquées : {blocked}",
        "",
        f"--- Alertes (total en base : {total_alerts_db}) ---",
        f"Cette heure  : {alerts_last_hour['total']} | sévérités : {alerts_last_hour['by_severity']}",
        f"Aujourd'hui  : {alerts_today['total']} | sévérités : {alerts_today['by_severity']}",
        f"10 dernières : {alerts_recent['by_severity']}",
    ]
    if alerts_recent["examples"]:
        lines.append("Détail des 5 dernières alertes :")
        for a in alerts_recent["examples"]:
            lines.append(
                f"  [#{a['id']}] {a['ts']} | source:{a['source']} | IP:{a['ip']} "
                f"| règle:{a['rule']} | sévérité:{a['severity']} | score:{a['score']}"
            )

    lines += [
        "",
        f"--- Incidents (total en base : {total_incs_db}) ---",
        f"Récents : {incs['total']} | statuts : {incs['by_status']}",
    ]
    if incs["examples"]:
        lines.append("Détail des derniers incidents :")
        for i in incs["examples"]:
            lines.append(
                f"  [#{i['id']}] {i['created_at']} | statut:{i['status']} "
                f"| risque:{i['risk']} | confiance:{i['confidence']} | {i['summary']}"
            )

    if blocks_info:
        lines.append("")
        lines.append(f"--- Blocages actifs ({len(blocks_info)}) ---")
        for b in blocks_info:
            lines.append(f"  IP:{b['ip']} | action:{b['action']} | raison:{b['reason']}")

    lines.append("======================================================")
    return "\n".join(lines)


def _is_ollama_reachable(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=1.0):
            return True
    except Exception:
        return False


@router.post("/chat")
async def chat(req: ChatRequest, stream: bool = False, db: Session = Depends(get_session)):
    """
    Endpoint de chat global (conversation libre) avec un prompt système explicatif.
    """
    # Contexte plateforme — injecté dans CHAQUE message
    platform_ctx = _build_platform_context(db)

    if req.voice_mode:
        system_prompt = (
            "Tu es l'assistant vocal de CyberSentinel, une plateforme SOC de cybersécurité.\n"
            "Tu as accès en temps réel aux alertes, incidents et blocages de la plateforme.\n"
            "Les données du contexte sont des FAITS réels enregistrés par la plateforme : "
            "parle-en avec certitude (ex: 'Le système a détecté', 'La plateforme a bloqué').\n"
            "N'utilise JAMAIS 'probablement', 'il est possible que', 'il semble que' "
            "pour décrire des données présentes dans le contexte.\n"
            "Réponds en 1 à 2 phrases courtes, en français, de façon naturelle.\n"
            "Pas de listes, pas de markdown, pas de code."
        )
    else:
        system_prompt = (
            "Tu es l'assistant d'analyse de CyberSentinel, une plateforme SOC de cybersécurité.\n"
            "Tu as accès en temps réel aux données de la plateforme : alertes, incidents, "
            "mode de défense et IPs bloquées.\n"
            "RÈGLE IMPORTANTE : les données du contexte sont des FAITS certains, "
            "enregistrés et mesurés par la plateforme. "
            "Parle-en avec assurance : dis 'Le système a détecté', 'La plateforme a bloqué', "
            "'Le score ML est de X', 'L'alerte #N indique'. "
            "N'utilise JAMAIS 'probablement', 'peut-être', 'il est possible que', "
            "'il semble que' pour décrire des faits déjà présents dans le contexte.\n"
            "Tu peux utiliser 'probablement' uniquement pour des déductions ou hypothèses "
            "qui vont AU-DELÀ des données du contexte.\n"
            "Tu ne dois jamais exécuter d'actions automatiques sans confirmation explicite.\n"
            "Réponds en français, de façon claire et concise."
        )

    ollama_options = (
        {"num_thread": 8, "num_predict": 100, "num_ctx": 1536, "temperature": 0.7}
        if req.voice_mode else
        {"num_thread": 8, "num_predict": 400, "num_ctx": 2048, "temperature": 0.3}
    )

    messages_ollama = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": platform_ctx},
    ]
    messages_ollama.extend([{"role": m.role, "content": m.content} for m in req.messages])

    if not stream:
        if not _is_ollama_reachable(OLLAMA_URL):
            raise HTTPException(502, {"code": "ollama_unavailable", "message": "Ollama indisponible"})
        timeout = httpx.Timeout(connect=3.0, read=OLLAMA_TIMEOUT, write=10.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                resp = await client.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={
                        "model": MODEL,
                        "messages": messages_ollama,
                        "stream": False,
                        "keep_alive": -1,
                        "options": ollama_options,
                    },
                )
                if resp.status_code != 200:
                    raise HTTPException(502, {"code": "ollama_unavailable", "message": "Ollama indisponible"})
                data = resp.json()
                return {"response": data.get("message", {}).get("content", "")}
            except httpx.ConnectError:
                raise HTTPException(502, {"code": "ollama_unavailable", "message": "Ollama indisponible"})
            except httpx.ConnectTimeout:
                raise HTTPException(504, {"code": "timeout", "message": "Connexion au LLM expirée"})
            except httpx.ReadTimeout:
                raise HTTPException(504, {"code": "timeout", "message": "Délai dépassé lors de l'appel LLM"})
            except Exception as e:
                raise HTTPException(500, {"code": "llm_error", "message": f"Erreur LLM : {e}"})

    # Streaming SSE
    async def event_generator():
        try:
            if not _is_ollama_reachable(OLLAMA_URL):
                yield "event: error\n"
                yield "data: Ollama indisponible\n\n"
                return
            timeout = httpx.Timeout(connect=3.0, read=60.0, write=10.0, pool=5.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_URL}/api/chat",
                    json={"model": MODEL, "messages": messages_ollama, "stream": True, "keep_alive": -1, "options": ollama_options},
                ) as resp:
                    if resp.status_code != 200:
                        yield "event: error\n"
                        yield "data: Ollama indisponible\n\n"
                        return
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except Exception:
                            continue
                        msg = data.get("message", {})
                        token = msg.get("content", "")
                        if token:
                            yield f"data: {token}\n\n"
                        if data.get("done"):
                            yield "event: done\n"
                            yield "data: end\n\n"
                            return
        except (asyncio.TimeoutError, httpx.TimeoutException):
            yield "event: error\n"
            yield "data: timeout\n\n"
        except httpx.ConnectError:
            yield "event: error\n"
            yield "data: Ollama indisponible\n\n"
        except Exception as e:
            yield "event: error\n"
            yield f"data: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
