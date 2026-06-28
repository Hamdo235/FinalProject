import asyncio
import json
import logging
from collections.abc import Coroutine
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from datetime import datetime, UTC
from typing import Optional, Set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["stream"])

_subscribers: Set[asyncio.Queue] = set()
_QUEUE_MAXSIZE = 256

# Main event loop captured at startup so that synchronous request handlers
# (which run in a threadpool without a running loop) can still publish events.
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Register the application's main event loop (called during startup)."""
    global _main_loop
    _main_loop = loop


def schedule_publish(coro: Coroutine) -> None:
    """Schedule an SSE-publishing coroutine from a sync or async context.

    Synchronous FastAPI endpoints run in a threadpool worker that has no
    running event loop, so ``asyncio.create_task`` raises ``RuntimeError`` and
    the coroutine is dropped (never awaited). This helper falls back to the
    main loop captured at startup so events are published in every context.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None:
        loop.create_task(coro)
        return

    if _main_loop is not None and _main_loop.is_running():
        asyncio.run_coroutine_threadsafe(coro, _main_loop)
        return

    # No loop available (e.g. unit-testing the handler directly): close the
    # coroutine so it does not emit a "coroutine was never awaited" warning.
    coro.close()
    logger.debug("[SSE] No event loop available; event dropped.")


def _safe_put(q: asyncio.Queue, event: dict) -> None:
    try:
        q.put_nowait(event)
        return
    except asyncio.QueueFull:
        # Drop oldest item and retry once
        try:
            _ = q.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass

async def publish(event: dict):
    # Fan-out to all active subscribers; drop if none connected.
    if not _subscribers:
        return
    for q in list(_subscribers):
        _safe_put(q, event)

_HEARTBEAT_INTERVAL = 15.0  # seconds — keep proxies alive and detect dead clients


async def _event_generator():
    # initial hello
    hello = json.dumps({"type": "hello", "time": datetime.now(UTC).isoformat()})
    yield f"data: {hello}\n\n"
    q: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
    _subscribers.add(q)
    try:
        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=_HEARTBEAT_INTERVAL)
            except asyncio.TimeoutError:
                # Send a comment-only line: clients ignore it but TCP/proxies see traffic.
                yield ": heartbeat\n\n"
                continue
            try:
                payload = json.dumps(item)
            except (TypeError, ValueError):
                payload = json.dumps({"type": "error", "detail": "unserializable"})
            yield f"data: {payload}\n\n"
    finally:
        _subscribers.discard(q)

@router.get("/alerts")
async def alerts_stream():
    return StreamingResponse(_event_generator(), media_type="text/event-stream")

async def publish_alert_created(alert: dict):
    await publish({
        "type": "alert.created",
        "data": alert,
        "time": datetime.now(UTC).isoformat(),
    })


async def publish_defense_changed(event: str, action: dict | None = None):
    """Publish defense action lifecycle events (created/approved/revoked/expired/manual_block/unblock).

    Keeps the frontend in sync without forcing it to poll /defense/actions every few seconds.
    """
    await publish({
        "type": "defense.changed",
        "event": event,
        "data": action,
        "time": datetime.now(UTC).isoformat(),
    })
