"""Body-size limit middleware.

Rejects requests whose Content-Length exceeds settings.max_body_size_bytes.
Audio uploads (/llm/transcribe) are exempted to allow larger voice clips.
"""
from __future__ import annotations
import logging
from fastapi import Request
from fastapi.responses import JSONResponse

from ..core.settings import settings

logger = logging.getLogger(__name__)


async def body_size_middleware(request: Request, call_next):
    if request.url.path == "/llm/transcribe":
        return await call_next(request)
    cl = request.headers.get("content-length")
    try:
        if cl is not None and int(cl) > settings.max_body_size_bytes:
            return JSONResponse({"detail": "Payload trop volumineux"}, status_code=413)
    except (TypeError, ValueError) as exc:
        logger.debug("[BodySize] Invalid content-length header (%s)", exc)
    return await call_next(request)
