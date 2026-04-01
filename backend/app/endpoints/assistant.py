from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from sqlmodel import Session, select
from ..db.session import get_session
from ..models.alert import Alert
from ..models.incident import Incident
from .llm_chat import MODEL
from ..core.settings import settings
import httpx
from datetime import datetime

router = APIRouter(prefix="/llm/assistant", tags=["LLM Assistant"]) 

class AssistantQuery(BaseModel):
    question: str
    max_alerts: int = 20
    max_incidents: int = 10


def _is_overview_question(text: str) -> bool:
    low = text.lower()
    keywords = [
        "attaque", "attaques", "alertes", "incidents", "récap", "resume", "résumé",
        "vue d'ensemble", "overview", "statut", "dernières", "récentes", "bilan",
    ]
    return any(k in low for k in keywords)


def _is_attack_alert(a: Alert) -> bool:
    sev = str(a.severity or "").lower()
    rule = str(a.rule or "").lower()
    if sev == "high":
        return True
    if rule.startswith("ml_") or "anomaly" in rule:
        return True
    if "failed" in rule or "bruteforce" in rule or "attack" in rule:
        return True
    return False


def _attack_explanation(a: Alert) -> str:
    rule = str(a.rule or "unknown")
    rule_low = rule.lower()
    if "failed" in rule_low:
        return "Multiples échecs d’authentification détectés, probable tentative d’accès non autorisé."
    if "anomaly" in rule_low or rule_low.startswith("ml_"):
        return "Comportement anormal détecté par le moteur ML par rapport au trafic habituel."
    if str(a.severity or "").lower() == "high":
        return "Événement classé critique selon les règles de corrélation et le score de risque."
    return "Activité suspecte récente à surveiller et à valider manuellement."


def _latest_attacks(db: Session, limit: int = 5) -> List[Dict[str, str]]:
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(200)
    rows = db.exec(stmt).all()
    picked: List[Dict[str, str]] = []
    for a in rows:
        if not _is_attack_alert(a):
            continue
        picked.append({
            "ts": a.ts.isoformat() if a.ts else "",
            "ip": a.ip or "unknown",
            "rule": a.rule or "unknown",
            "severity": a.severity or "unknown",
            "explanation": _attack_explanation(a),
        })
        if len(picked) >= max(1, min(limit, 5)):
            break
    return picked


def _summarize_alerts(db: Session, limit: int) -> dict:
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(limit)
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


def _summarize_incidents(db: Session, limit: int) -> dict:
    stmt = select(Incident).order_by(Incident.created_at.desc()).limit(limit)
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


@router.post("/query")
async def assistant_query(body: AssistantQuery, db: Session = Depends(get_session)):
    if not body.question or not body.question.strip():
        raise HTTPException(400, "question manquante")

    alerts_summary = _summarize_alerts(db, max(1, min(body.max_alerts, 100)))
    incidents_summary = _summarize_incidents(db, max(1, min(body.max_incidents, 100)))
    latest_attacks = _latest_attacks(db, limit=5)

    if _is_overview_question(body.question):
        if not latest_attacks:
            return {
                "response": "Aucune attaque récente détectée pour le moment.",
                "context_used": {
                    "alerts": alerts_summary,
                    "incidents": incidents_summary,
                    "latest_attacks": latest_attacks,
                },
            }

        lines = ["Top 5 des dernières attaques détectées :"]
        for idx, a in enumerate(latest_attacks, start=1):
            lines.append(
                f"{idx}. IP: {a['ip']} | Règle: {a['rule']} | Sévérité: {a['severity']} | Explication: {a['explanation']}"
            )
        return {
            "response": "\n".join(lines),
            "context_used": {
                "alerts": alerts_summary,
                "incidents": incidents_summary,
                "latest_attacks": latest_attacks,
            },
        }

    now = datetime.utcnow().isoformat()
    context = (
        "Contexte plateforme (temps UTC: {now}).\n"
        "Récapitulatif alertes (dernières {na}): total={ta}, par sévérité={sa}.\nExemples: {ea}.\n"
        "Récapitulatif incidents (derniers {ni}): total={ti}, par statut={si}.\nExemples: {ei}.\n"
    ).format(
        now=now,
        na=body.max_alerts,
        ta=alerts_summary["total"],
        sa=alerts_summary["by_severity"],
        ea=alerts_summary["examples"],
        ni=body.max_incidents,
        ti=incidents_summary["total"],
        si=incidents_summary["by_status"],
        ei=incidents_summary["examples"],
    )

    system_prompt = (
        "Tu es l’assistant d’analyse de CyberSentinel. \n"
        "Tu réponds en français, de manière claire et structurée. \n"
        "Tu n’exécutes jamais d’actions. \n"
        "Tu utilises le contexte fourni (alertes/incidents) pour répondre précisément à la question.\n"
        "Si une information n’est pas présente dans le contexte, dis-le poliment.\n"
        "Pour les demandes de vue d’ensemble, réponds en liste numérotée concise.\n"
    )

    messages_ollama = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": f"Contexte:\n{context}"},
        {"role": "user", "content": body.question.strip()},
    ]

    async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
        try:
            resp = await client.post(
                f"{settings.ollama_url}/api/chat",
                json={
                    "model": MODEL,
                    "messages": messages_ollama,
                    "stream": False,
                },
            )
            if resp.status_code != 200:
                raise HTTPException(502, {"code": "ollama_unavailable", "message": "Ollama indisponible"})
            data = resp.json()
            answer = data.get("message", {}).get("content", "")
        except httpx.ReadTimeout:
            raise HTTPException(504, {"code": "timeout", "message": "Délai dépassé lors de l'appel LLM"})
        except Exception as e:
            raise HTTPException(500, {"code": "llm_error", "message": f"Erreur LLM : {e}"})

    return {
        "response": answer,
        "context_used": {
            "alerts": alerts_summary,
            "incidents": incidents_summary,
        },
    }
