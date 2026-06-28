"""Shared authentication helpers."""
from __future__ import annotations

import hmac
import logging
from typing import Optional

from fastapi import HTTPException, Request

from .settings import settings

logger = logging.getLogger(__name__)


def require_admin_token(
    request: Optional[Request],
    body_token: Optional[str] = None,
    *,
    source: str = "Auth",
) -> None:
    """Enforce the admin token when one is configured server-side.

    The token may be supplied via the ``X-ADMIN-TOKEN`` header or a request
    body field. Comparison uses :func:`hmac.compare_digest` to avoid leaking
    the token through timing side-channels. When ``ADMIN_TOKEN`` is unset the
    check is skipped (dev convenience).
    """
    expected = settings.admin_token
    if not expected:
        return

    provided = ""
    if request is not None:
        provided = request.headers.get("X-ADMIN-TOKEN") or ""
    if not provided and body_token:
        provided = body_token

    if not hmac.compare_digest(provided, expected):
        client_ip = request.client.host if request and request.client else "unknown"
        logger.warning("[%s] Unauthorized access attempt from ip=%s", source, client_ip)
        raise HTTPException(status_code=401, detail="Unauthorized")
