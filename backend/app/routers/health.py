from fastapi import APIRouter
from datetime import datetime
from ..db.session import get_session
from sqlmodel import Session
import httpx
import asyncio
import socket
from urllib.parse import urlparse
from ..core.settings import settings

router = APIRouter(prefix="/health", tags=["health"]) 


def _is_reachable(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=1.0):
            return True
    except Exception:
        return False


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
    base = settings.ollama_url
    if not _is_reachable(base):
        status["ollama"] = "error: unreachable"
        status["status"] = "degraded"
        return status
    try:
        timeout = httpx.Timeout(connect=1.0, read=2.0, write=2.0, pool=1.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await asyncio.wait_for(client.get(f"{base}/api/tags"), timeout=3.0)
            status["ollama"] = "ok" if resp.status_code == 200 else f"error: {resp.status_code}"
            if resp.status_code != 200:
                status["status"] = "degraded"
    except asyncio.TimeoutError:
        status["ollama"] = "error: timeout"
        status["status"] = "degraded"
    except Exception as e:
        status["ollama"] = f"error: {e}"
        status["status"] = "degraded"
    return status
