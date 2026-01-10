from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/health", tags=["health"]) 

@router.get("")
async def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}
