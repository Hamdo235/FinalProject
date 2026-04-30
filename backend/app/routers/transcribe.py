import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from ..core.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Receive a WAV audio file and return the French transcription via Whisper tiny."""
    try:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Fichier audio vide.")
        if len(data) > settings.max_audio_size_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Fichier audio trop volumineux (max {settings.max_audio_size_bytes} octets).",
            )
        from app.services.whisper_service import transcribe_wav
        text = transcribe_wav(data)
        return {"text": text}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[Transcribe] Erreur : %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
