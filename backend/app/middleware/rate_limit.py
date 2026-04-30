"""Per-IP fixed-window rate limit middleware.

Bucket entries are kept in memory; a periodic GC purges expired buckets so
that the structure cannot grow unbounded on long-running instances.

Disabled in dev (settings.debug) or when settings.rate_limit_per_minute <= 0.
"""
from __future__ import annotations
import time
from collections import defaultdict
from typing import Dict, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

from ..core.settings import settings


_BUCKET: Dict[str, Dict[str, float]] = defaultdict(lambda: {"count": 0, "reset": 0.0})
_LAST_GC: float = 0.0
_GC_INTERVAL: float = 300.0  # seconds
_MAX_BUCKETS: int = 10_000


def _gc(now: float) -> None:
    """Purge expired buckets to bound memory growth on long-running instances."""
    global _LAST_GC
    if now - _LAST_GC < _GC_INTERVAL:
        return
    _LAST_GC = now
    expired = [k for k, b in _BUCKET.items() if now > b["reset"] + 60]
    for k in expired:
        _BUCKET.pop(k, None)
    if len(_BUCKET) > _MAX_BUCKETS:
        oldest = sorted(_BUCKET.items(), key=lambda kv: kv[1]["reset"])[: len(_BUCKET) - _MAX_BUCKETS]
        for k, _ in oldest:
            _BUCKET.pop(k, None)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def rate_limit_middleware(request: Request, call_next):
    # In dev, the frontend may poll several endpoints and keep SSE open.
    # The simple bucket limiter can easily trigger false positives and break the UI.
    if settings.debug or settings.rate_limit_per_minute <= 0:
        return await call_next(request)

    key = _client_key(request)
    now = time.time()
    _gc(now)
    bucket = _BUCKET[key]
    if now > bucket["reset"]:
        bucket["count"], bucket["reset"] = 0, now + 60
    bucket["count"] += 1
    if bucket["count"] > settings.rate_limit_per_minute:
        return JSONResponse({"detail": "Trop de requêtes"}, status_code=429)

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(settings.rate_limit_per_minute)
    response.headers["X-RateLimit-Remaining"] = str(max(0, settings.rate_limit_per_minute - int(bucket["count"])))
    response.headers["X-RateLimit-Reset"] = str(int(bucket["reset"]))
    return response


def _bucket_snapshot() -> Tuple[int, int]:
    """Test/diagnostics helper: returns (current_size, last_gc_age_seconds)."""
    age = int(time.time() - _LAST_GC) if _LAST_GC else -1
    return len(_BUCKET), age
