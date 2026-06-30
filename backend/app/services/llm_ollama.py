import os
import json
import logging
import httpx
from typing import Optional, Tuple
from ..core.settings import settings
from . import rag_service

logger = logging.getLogger(__name__)

OLLAMA_BASE = settings.ollama_base_url
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

PROMPT_TEMPLATE = """Tu es un expert SOC (Security Operations Center) spécialisé en cybersécurité.

Contexte MITRE ATT&CK récupéré automatiquement :
{rag_context}

Incident à analyser :
{incident_summary}

Alertes associées : {alert_ids}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après :
{{
  "severity_score": <entier entre 0 et 10>,
  "attack_type": "<nom court de l'attaque en français>",
  "mitre_technique": "<ID technique ex: T1110.001>",
  "mitre_name": "<nom de la technique MITRE>",
  "explanation": "<explication claire en français, 2-3 phrases>",
  "recommended_actions": ["<action 1>", "<action 2>", "<action 3>"],
  "confidence_score": <float entre 0.0 et 1.0>,
  "confidence_justification": "<pourquoi ce score de confiance>"
}}"""

PROMPT_FALLBACK = """Tu es un expert SOC. Analyse cet incident et réponds en JSON uniquement.

Incident : {incident_summary}

JSON attendu :
{{
  "severity_score": 5,
  "attack_type": "Activité suspecte",
  "mitre_technique": "T1110",
  "mitre_name": "Brute Force",
  "explanation": "Activité suspecte détectée sur le réseau.",
  "recommended_actions": ["Bloquer l'IP source", "Vérifier les logs", "Alerter l'équipe"],
  "confidence_score": 0.4,
  "confidence_justification": "Analyse dégradée sans contexte RAG complet"
}}"""

_FALLBACK_JSON = {
    "severity_score": 5,
    "attack_type": "Activité suspecte",
    "mitre_technique": "T1110",
    "mitre_name": "Brute Force",
    "explanation": "Analyse indisponible (Ollama non joignable ou erreur de parsing).",
    "recommended_actions": [
        "Bloquer l'IP source manuellement",
        "Vérifier les logs système",
        "Alerter l'équipe de sécurité",
    ],
    "confidence_score": 0.2,
    "confidence_justification": "Fallback statique — Ollama indisponible ou réponse invalide",
}


def _parse_json_response(text: str) -> Optional[dict]:
    """Tente d'extraire un objet JSON depuis la réponse LLM."""
    text = text.strip()
    # Tentative directe
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Chercher un bloc JSON entre accolades
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
    return None


async def _call_ollama(prompt: str, timeout: float = 180.0) -> Optional[str]:
    """Appelle Ollama en mode JSON forcé. Retourne le texte brut ou None."""
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "keep_alive": -1,
        "options": {
            "temperature": 0.1,
            "num_predict": 500,
            "num_ctx": 2048,
            "num_thread": 8,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{OLLAMA_BASE}/api/generate", json=payload)
            r.raise_for_status()
            return r.json().get("response", "")
    except Exception as exc:
        logger.warning("[LLM] Erreur appel Ollama : %s", exc)
        return None


async def ollama_explain_incident(
    summary: str,
    alert_ids: str,
    ml_score: float = 0.5,
    db=None,
) -> Tuple[str, float, dict]:
    """
    Analyse un incident avec contexte RAG + Ollama.

    Retourne :
      - response_text : JSON brut retourné par Ollama (str)
      - confidence_final : score de confiance pondéré (float)
      - parsed_json : dictionnaire structuré de la réponse
    """
    # 1. Récupérer le contexte RAG + score en une seule requête (1 embedding au lieu de 2)
    rag_context, rag_score = rag_service.retrieve_context_and_score(summary, k=3)
    logger.info("[LLM] RAG score: %.4f", rag_score)

    # 2. Construire le prompt enrichi
    prompt = PROMPT_TEMPLATE.format(
        rag_context=rag_context,
        incident_summary=summary,
        alert_ids=alert_ids,
    )

    # 3. Premier appel Ollama
    raw = await _call_ollama(prompt, timeout=180.0)
    parsed = _parse_json_response(raw) if raw else None

    # 4. Retry avec prompt simplifié si parsing échoue
    if parsed is None:
        logger.warning("[LLM] Parsing JSON échoué — retry avec prompt simplifié")
        fallback_prompt = PROMPT_FALLBACK.format(incident_summary=summary)
        raw = await _call_ollama(fallback_prompt, timeout=120.0)
        parsed = _parse_json_response(raw) if raw else None

    # 5. Fallback statique si retry échoue
    if parsed is None:
        logger.error("[LLM] Retry échoué — utilisation du fallback statique")
        parsed = _FALLBACK_JSON.copy()
        raw = json.dumps(parsed, ensure_ascii=False)
        confidence_method = "fallback"
    else:
        confidence_method = "rag_weighted"

    # 6. Calculer le score de confiance pondéré
    score_llm = float(parsed.get("confidence_score", 0.5))
    confidence_final = round(
        (ml_score * 0.4) + (rag_score * 0.3) + (0.3 * score_llm),
        4,
    )

    # Injecter la méthode de calcul dans le JSON retourné
    parsed["_confidence_method"] = confidence_method
    parsed["_rag_score"] = rag_score
    parsed["_ml_score"] = ml_score

    response_text = raw or json.dumps(parsed, ensure_ascii=False)
    return response_text, confidence_final, parsed


async def warmup_ollama() -> None:
    """Charge le modèle en RAM au démarrage pour éviter la latence au premier appel."""
    payload = {
        "model": MODEL,
        "prompt": "ok",
        "stream": False,
        "keep_alive": -1,
        "options": {"num_predict": 1},
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(f"{OLLAMA_BASE}/api/generate", json=payload)
            r.raise_for_status()
            logger.info("[LLM] Modèle '%s' chargé en RAM (warm-up OK).", MODEL)
    except Exception as exc:
        logger.warning("[LLM] Warm-up ignoré (Ollama indisponible) : %s", exc)
