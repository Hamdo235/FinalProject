"""Tests for the SSE publish scheduling helper.

Regression coverage for the bug where synchronous request handlers called
``asyncio.create_task`` in a threadpool worker (no running loop), so the
coroutine was silently dropped and defense events never reached SSE clients.
"""
import asyncio

import pytest

from app.services import sse


@pytest.fixture
def _subscriber():
    """Register a fresh SSE subscriber queue and clean it up afterwards."""
    q: asyncio.Queue = asyncio.Queue()
    sse._subscribers.add(q)
    try:
        yield q
    finally:
        sse._subscribers.discard(q)


@pytest.mark.anyio
async def test_schedule_publish_in_async_context_delivers(_subscriber):
    sse.set_main_loop(asyncio.get_running_loop())
    sse.schedule_publish(sse.publish_defense_changed("manual_block", {"ip": "1.2.3.4"}))
    event = await asyncio.wait_for(_subscriber.get(), timeout=1.0)
    assert event["type"] == "defense.changed"
    assert event["event"] == "manual_block"
    assert event["data"]["ip"] == "1.2.3.4"


@pytest.mark.anyio
async def test_schedule_publish_from_sync_thread_delivers(_subscriber):
    """A sync handler (threadpool, no running loop) must still publish."""
    sse.set_main_loop(asyncio.get_running_loop())
    # asyncio.to_thread runs schedule_publish in a worker thread without a
    # running loop, exactly like a synchronous FastAPI endpoint.
    await asyncio.to_thread(
        sse.schedule_publish,
        sse.publish_defense_changed("unblock", {"ip": "9.9.9.9"}),
    )
    event = await asyncio.wait_for(_subscriber.get(), timeout=1.0)
    assert event["event"] == "unblock"
    assert event["data"]["ip"] == "9.9.9.9"


def test_schedule_publish_without_loop_does_not_raise():
    """No running loop and no registered main loop: drop cleanly, no error."""
    saved = sse._main_loop
    sse.set_main_loop(None)
    try:
        # Must not raise nor emit a "coroutine was never awaited" warning.
        sse.schedule_publish(sse.publish_defense_changed("revoked", {"ip": "0.0.0.0"}))
    finally:
        sse.set_main_loop(saved)
