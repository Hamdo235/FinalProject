import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from datetime import datetime

router = APIRouter(prefix="/stream", tags=["stream"])

_queue: asyncio.Queue = asyncio.Queue()

async def publish(event: dict):
    await _queue.put(event)

async def _event_generator():
    # initial hello
    hello = json.dumps({"type": "hello", "time": datetime.utcnow().isoformat()})
    yield f"data: {hello}\n\n"
    while True:
        item = await _queue.get()
        try:
            payload = json.dumps(item)
        except Exception:
            payload = json.dumps({"type":"error","detail":"unserializable"})
        yield f"data: {payload}\n\n"

@router.get("/alerts")
async def alerts_stream():
    return StreamingResponse(_event_generator(), media_type="text/event-stream")

async def publish_alert_created(alert_id: int, severity: str):
    await publish({
        "type": "alert.created",
        "id": alert_id,
        "severity": severity,
        "time": datetime.utcnow().isoformat(),
    })
