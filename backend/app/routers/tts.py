import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm", tags=["llm"])
_tts_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts")


class TTSRequest(BaseModel):
    text: str
    lang: str = "fr"


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text to WAV using piper (neural) or espeak-ng (fallback). Non-blocking."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide.")
    from app.services.tts_service import synthesize
    loop = asyncio.get_event_loop()
    wav = await loop.run_in_executor(_tts_executor, synthesize, req.text, req.lang)
    if not wav:
        raise HTTPException(status_code=503, detail="Synthèse vocale indisponible.")
    return Response(content=wav, media_type="audio/wav")
