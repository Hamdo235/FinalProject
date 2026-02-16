from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Literal
import httpx
import os
from fastapi.responses import StreamingResponse
import json
from sqlmodel import Session, select
from ..db.session import get_session
from ..models.alert import Alert
from ..models.incident import Incident
from ..core.settings import settings

router = APIRouter(prefix="/llm", tags=["LLM"])

OLLAMA_URL = settings.ollama_url
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
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

def _is_overview_question(text: str) -> bool:
    low = text.lower()
    keywords = [
        "attaque", "alertes", "incidents", "récap", "resume", "résumé",
        "vue d'ensemble", "overview", "statut", "dernières", "récentes", "bilan",
    ]
    return any(k in low for k in keywords)


def _summarize_alerts(db: Session, limit: int = 8) -> dict:
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(max(1, min(limit, 100)))
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
                "ts": a.ts,
                "source": a.source,
                "ip": a.ip,
                "rule": a.rule,
                "severity": a.severity,
                "score": a.score,
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
                "created_at": i.created_at,
                "status": i.status,
                "risk": i.risk,
                "confidence": i.confidence,
                "summary": i.summary,
            }
            for i in incs[:5]
        ],
    }


@router.post("/chat")
async def chat(req: ChatRequest, stream: bool = False, db: Session = Depends(get_session)):
    """
    Endpoint de chat global (conversation libre) avec un prompt système explicatif.
    """
    # Prompt système pour cadrer le LLM
    system_prompt = (
        "Tu es l’assistant d’analyse de CyberSentinel. "
        "Tu peux répondre de manière conversationnelle aux salutations et questions générales. "
        "Ta mission principale reste l’explication des alertes, incidents et métriques de sécurité. "
        "Tu ne dois jamais proposer ni exécuter d’actions automatiques. "
        "Sois poli, clair et concis."
    )
    # Construire le payload pour Ollama
    messages_ollama = [{"role": "system", "content": system_prompt}]

    # Mode hybride: si activé et dernière question liée à la plateforme,
    # ajouter un contexte synthétique à partir de la base.
    if req.auto_tool and req.messages:
        last_user = None
        for m in reversed(req.messages):
            if m.role == "user":
                last_user = m.content
                break
        if last_user and _is_overview_question(last_user):
            alerts_summary = _summarize_alerts(db, limit=8)
            incidents_summary = _summarize_incidents(db, limit=5)
            context = (
                f"Contexte plateforme. Récap alertes: total={alerts_summary['total']}, par sévérité={alerts_summary['by_severity']}. "
                f"Exemples: {alerts_summary['examples']}. "
                f"Récap incidents: total={incidents_summary['total']}, par statut={incidents_summary['by_status']}. "
                f"Exemples: {incidents_summary['examples']}."
            )
            messages_ollama.append({"role": "system", "content": f"Contexte:\n{context}"})

    messages_ollama.extend([{"role": m.role, "content": m.content} for m in req.messages])

    if not stream:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            try:
                resp = await client.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={
                        "model": MODEL,
                        "messages": messages_ollama,
                        "stream": False,
                    },
                )
                if resp.status_code != 200:
                    raise HTTPException(502, {"code": "ollama_unavailable", "message": "Ollama indisponible"})
                data = resp.json()
                return {"response": data.get("message", {}).get("content", "")}
            except httpx.ReadTimeout:
                raise HTTPException(504, {"code": "timeout", "message": "Délai dépassé lors de l'appel LLM"})
            except Exception as e:
                raise HTTPException(500, {"code": "llm_error", "message": f"Erreur LLM : {e}"})

    # Streaming SSE
    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_URL}/api/chat",
                    json={"model": MODEL, "messages": messages_ollama, "stream": True},
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
        except Exception as e:
            yield "event: error\n"
            yield f"data: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
