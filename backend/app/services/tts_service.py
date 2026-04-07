import io
import logging
import os
import subprocess
import tempfile
import wave
from pathlib import Path
from threading import Lock

import httpx

logger = logging.getLogger(__name__)

# ── Piper neural TTS ──────────────────────────────────────────────────────────
MODEL_DIR  = Path.home() / ".local" / "share" / "piper"
MODEL_NAME = "fr_FR-upmc-medium"
MODEL_BASE = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
    "/fr/fr_FR/upmc/medium"
)

_piper_voice = None
_piper_lock  = Lock()


def _download_if_missing(filename: str) -> Path:
    dest = MODEL_DIR / filename
    if dest.exists():
        return dest
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{MODEL_BASE}/{filename}"
    logger.info("[TTS] Téléchargement %s …", filename)
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        with client.stream("GET", url) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=65536):
                    f.write(chunk)
    logger.info("[TTS] %s prêt.", filename)
    return dest


def _get_piper_voice():
    global _piper_voice
    with _piper_lock:
        if _piper_voice is not None:
            return _piper_voice
        try:
            onnx = _download_if_missing(f"{MODEL_NAME}.onnx")
            _download_if_missing(f"{MODEL_NAME}.onnx.json")
            from piper.voice import PiperVoice
            logger.info("[TTS] Chargement modèle piper %s …", MODEL_NAME)
            _piper_voice = PiperVoice.load(str(onnx))
            logger.info("[TTS] Modèle piper prêt.")
            return _piper_voice
        except Exception as exc:
            logger.warning("[TTS] Piper indisponible (%s) — fallback espeak-ng", exc)
            return None


def _synthesize_piper(text: str) -> bytes:
    voice = _get_piper_voice()
    if voice is None:
        return b""
    try:
        # piper-tts >= 1.4 API: synthesize() returns Iterable[AudioChunk]
        chunks = list(voice.synthesize(text))
        if not chunks:
            return b""
        sr = chunks[0].sample_rate
        sw = chunks[0].sample_width
        sc = chunks[0].sample_channels
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(sc)
            wf.setsampwidth(sw)
            wf.setframerate(sr)
            for chunk in chunks:
                wf.writeframes(chunk.audio_int16_bytes)
        wav_bytes = buf.getvalue()
        logger.debug("[TTS] Piper: %d chunks, %d bytes WAV", len(chunks), len(wav_bytes))
        return wav_bytes
    except Exception as exc:
        logger.warning("[TTS] Piper synthèse échouée (%s) — fallback espeak-ng", exc)
        return b""


# ── espeak-ng fallback ────────────────────────────────────────────────────────
def _synthesize_espeak(text: str, lang: str = "fr") -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    try:
        subprocess.run(
            ["espeak-ng", "-v", lang, "-s", "145", "-w", tmp, text],
            check=True, capture_output=True,
        )
        with open(tmp, "rb") as f:
            return f.read()
    except Exception as exc:
        logger.error("[TTS] espeak-ng erreur : %s", exc)
        return b""
    finally:
        try: os.unlink(tmp)
        except OSError: pass


# ── Public API ────────────────────────────────────────────────────────────────
def synthesize(text: str, lang: str = "fr") -> bytes:
    """Return WAV bytes for *text* using piper (neural) or espeak-ng (fallback)."""
    if not text.strip():
        return b""
    wav = _synthesize_piper(text)
    if not wav:
        wav = _synthesize_espeak(text, lang)
    return wav
