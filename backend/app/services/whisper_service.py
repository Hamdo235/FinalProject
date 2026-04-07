import io
import logging
import numpy as np

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        logger.info("[Whisper] Chargement du modèle base (première utilisation)…")
        _model = WhisperModel("base", device="cpu", compute_type="int8")
        logger.info("[Whisper] Modèle prêt.")
    return _model


def transcribe_wav(wav_bytes: bytes) -> str:
    """Transcribe raw WAV bytes (PCM 16-bit mono) using faster-whisper tiny.
    Uses soundfile to decode → numpy array so ffmpeg is NOT required.
    """
    import soundfile as sf

    model = _get_model()
    buf = io.BytesIO(wav_bytes)
    try:
        audio, sample_rate = sf.read(buf, dtype="float32", always_2d=False)
    except Exception as exc:
        logger.error("[Whisper] Lecture audio échouée : %s", exc)
        return ""

    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    if sample_rate != 16000:
        # Resample to 16 kHz (required by Whisper)
        import scipy.signal as sps
        num_samples = int(len(audio) * 16000 / sample_rate)
        audio = sps.resample(audio, num_samples).astype(np.float32)

    segments, _ = model.transcribe(audio, language="fr", beam_size=5)
    text = " ".join(seg.text for seg in segments).strip()
    logger.info("[Whisper] Transcription : %r", text)
    return text
