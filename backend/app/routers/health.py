from fastapi import APIRouter
from datetime import datetime
from ..db.session import get_session
from sqlmodel import Session
import httpx
import os

router = APIRouter(prefix="/health", tags=["health"]) 

@router.get("")
async def health():
    status = {"status": "ok", "time": datetime.utcnow().isoformat()}
    # DB check
    try:
        from ..models.alert import Alert  # noqa: F401
        # open/close session
        for _ in get_session():
            break
        status["db"] = "ok"
    except Exception as e:
        status["db"] = f"error: {e}"
        status["status"] = "degraded"

    # Ollama check
    base = os.getenv("OLLAMA_URL", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{base}/api/tags")
            status["ollama"] = "ok" if resp.status_code == 200 else f"error: {resp.status_code}"
            if resp.status_code != 200:
                status["status"] = "degraded"
    except Exception as e:
        status["ollama"] = f"error: {e}"
        status["status"] = "degraded"
    return status
