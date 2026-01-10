from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import select
from ..db.session import get_session
from ..models.incident import Incident
from ..models.llm_trace import LLMTrace
from ..services.llm_ollama import ollama_explain_incident
import json

router = APIRouter(prefix="/llm", tags=["llm"])

@router.post("/incidents/{incident_id}/explain")
async def explain_incident(incident_id: int, db: Session = Depends(get_session)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    # Prepare context for the prompt
    alert_ids = []
    try:
        if inc.related_alerts_json:
            alert_ids = json.loads(inc.related_alerts_json)
    except Exception:
        alert_ids = []
    text, conf = await ollama_explain_incident(inc.summary or "Incident sans résumé", str(alert_ids))
    trace = LLMTrace(incident_id=incident_id, prompt="(voir service)", response=text, confidence=conf)
    db.add(trace)
    # Optionally update incident confidence field
    inc.confidence = conf
    db.add(inc)
    db.commit()
    db.refresh(trace)
    return {"incident_id": incident_id, "response": text, "confidence": conf, "trace_id": trace.id}
