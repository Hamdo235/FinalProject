import os
import httpx
from typing import Optional, Tuple
from ..core.settings import settings

OLLAMA_BASE = settings.ollama_base_url
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

PROMPT_TEMPLATE = (
    "Vous êtes un assistant SOC. Expliquez l'incident suivant en français de façon claire, "
    "listez 2-3 actions possibles (sans exécuter), et donnez un score_de_confiance entre 0 et 1.\n"
    "Incident: {incident_summary}\n"
    "Alertes liées (ids): {alert_ids}\n"
    "Contrainte: Répondez en 120-200 mots maximum.\n"
)

async def ollama_explain_incident(summary: str, alert_ids: str) -> Tuple[str, float]:
    prompt = PROMPT_TEMPLATE.format(incident_summary=summary, alert_ids=alert_ids)
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(f"{OLLAMA_BASE}/api/generate", json=payload)
            r.raise_for_status()
            data = r.json()
            text: str = data.get("response", "")
    except Exception:
        # Stub in case Ollama is not running
        text = (
            "Explication (stub): activité suspecte détectée. Actions proposées: bloquer IP, "
            "enquêter sur l'hôte, forcer rotation des mots de passe. Score_de_confiance: 0.5."
        )
    # Heuristique simple pour extraire/assigner une confiance
    conf: float = 0.5
    lowered = text.lower()
    for token, val in [("0.8", 0.8), ("0.7", 0.7), ("0.6", 0.6), ("0.9", 0.9)]:
        if token in lowered:
            conf = val
            break
    return text, conf
