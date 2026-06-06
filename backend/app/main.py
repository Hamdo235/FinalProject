from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, Request
from starlette.responses import Response as StarletteResponse
import gzip as _gzip
from .routers.health import router as health_router
from .routers.ingest import router as ingest_router
from .routers.alerts import router as alerts_router
from .routers.incidents import router as incidents_router
from .routers.llm import router as llm_router
from .routers.llm_chat import router as llm_chat_router
from .routers.map import router as map_router
from .routers.demo import router as demo_router
from .services.sse import router as sse_router
from .routers.validation import router as validation_router
from .routers.metrics import router as metrics_router
from .routers.defense import router as defense_router
from .routers.chat_store import router as chat_store_router
from .routers.assistant import router as assistant_router
from .routers.transcribe import router as transcribe_router
from .routers.tts import router as tts_router
from .db.session import engine
from .core.settings import settings
from .services.defense import expire_actions_loop
from .services import ip_blacklist
from .middleware import (
    body_size_middleware,
    rate_limit_middleware,
    security_headers_middleware,
    defense_enforcement_middleware,
)
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from sqlmodel import SQLModel, Session as SQLModelSession
# runtime metrics removed for simplicity

logger = logging.getLogger(__name__)
_rag_executor: ThreadPoolExecutor | None = None
_warmup_executor: ThreadPoolExecutor | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: replaces deprecated on_event(startup/shutdown)."""
    # ── Startup ───────────────────────────────────────────────────────────
    # Créer les tables SQLite (rapide, synchrone)
    from .models import alert as _a  # noqa: F401
    from .models import incident as _i  # noqa: F401
    from .models import llm_trace as _l  # noqa: F401
    from .models import ip_enrichment as _e  # noqa: F401
    from .models import label as _lbl  # noqa: F401
    from .models import chat as _chat  # noqa: F401
    from .models import defense_action as _def  # noqa: F401
    SQLModel.metadata.create_all(bind=engine)

    # ── Optionnel : vider les tables au démarrage (CLEAR_DB_ON_START=true) ──
    if settings.clear_db_on_start:
        from sqlmodel import delete as _delete
        from .models.alert import Alert as _Alert
        from .models.incident import Incident as _Incident
        from .models.llm_trace import LLMTrace as _LLMTrace
        from .models.ip_enrichment import IPEnrichment as _IPEnrichment
        from .models.defense_action import DefenseAction as _DefenseAction
        try:
            with SQLModelSession(engine) as _db:
                for _model in (_LLMTrace, _DefenseAction, _IPEnrichment, _Incident, _Alert):
                    _db.exec(_delete(_model))
                _db.commit()
            logger.info("[Startup] CLEAR_DB_ON_START=true — toutes les tables vidées.")
        except Exception as _exc:
            logger.warning("[Startup] Impossible de vider la DB : %s", _exc)

    # Migration SQLite : ajouter les colonnes absentes sur defenseaction
    _new_cols = [
        ("approved_by",  "VARCHAR"),
        ("approved_at",  "DATETIME"),
        ("revoked_at",   "DATETIME"),
    ]
    try:
        with engine.connect() as conn:
            for col, typ in _new_cols:
                try:
                    conn.execute(
                        __import__("sqlalchemy").text(
                            f"ALTER TABLE defenseaction ADD COLUMN {col} {typ}"
                        )
                    )
                    conn.commit()
                    logger.info("[Migration] Colonne ajoutée : defenseaction.%s", col)
                except Exception:
                    pass  # colonne déjà présente
    except Exception as exc:
        logger.warning("[Migration] Impossible de migrer defenseaction : %s", exc)

    _llm_cols = [
        ("response_json",     "TEXT"),
        ("mitre_technique",   "VARCHAR"),
        ("rag_context_used",  "TEXT"),
        ("confidence_method", "VARCHAR"),
    ]
    try:
        with engine.connect() as conn:
            for col, typ in _llm_cols:
                try:
                    conn.execute(
                        __import__("sqlalchemy").text(
                            f"ALTER TABLE llmtrace ADD COLUMN {col} {typ}"
                        )
                    )
                    conn.commit()
                    logger.info("[Migration] Colonne ajoutée : llmtrace.%s", col)
                except Exception:
                    pass
    except Exception as exc:
        logger.warning("[Migration] Impossible de migrer llmtrace : %s", exc)

    try:
        with SQLModelSession(engine) as db:
            ip_blacklist.sync_from_db(db)
    except Exception as exc:
        logger.warning("[Startup] Blacklist sync failed: %s", exc)

    asyncio.create_task(ip_blacklist.expire_loop(60))
    asyncio.create_task(expire_actions_loop(60))

    from .services.llm_ollama import warmup_ollama
    asyncio.create_task(warmup_ollama())

    def _warmup_models():
        try:
            from .services.tts_service import _get_piper_voice
            _get_piper_voice()
        except Exception as exc:
            logger.warning("[Warmup] TTS: %s", exc)
        try:
            from .services.whisper_service import _get_model
            _get_model()
        except Exception as exc:
            logger.warning("[Warmup] Whisper: %s", exc)

    warmup_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="warmup")
    asyncio.get_running_loop().run_in_executor(warmup_executor, _warmup_models)

    from .services import rag_service
    global _rag_executor, _warmup_executor
    _warmup_executor = warmup_executor

    if not settings.rag_enabled:
        logger.info("[RAG] Désactivé (RAG_ENABLED=false)")
    else:
        rag_mode = settings.rag_init_mode.strip().lower()
        if rag_mode in {"off", "disabled"}:
            logger.info("[RAG] Désactivé (RAG_INIT_MODE=%s)", rag_mode)
        elif rag_mode == "lazy":
            logger.info("[RAG] Mode lazy actif: initialisation au premier appel")
        else:
            if rag_mode != "background":
                logger.warning("[RAG] Mode inconnu '%s', fallback en background", rag_mode)
            worker_count = max(1, settings.rag_init_max_workers)
            _rag_executor = ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="rag-init")
            loop = asyncio.get_running_loop()
            loop.run_in_executor(_rag_executor, lambda: rag_service.initialize())

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    if _rag_executor is not None:
        _rag_executor.shutdown(wait=False, cancel_futures=True)
        _rag_executor = None
    if _warmup_executor is not None:
        _warmup_executor.shutdown(wait=False, cancel_futures=True)
        _warmup_executor = None


class _SafeGZipMiddleware(BaseHTTPMiddleware):
    """GZip pour les réponses REST, transparent pour text/event-stream."""

    def __init__(self, app, minimum_size: int = 500) -> None:
        super().__init__(app)
        self.minimum_size = minimum_size

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            return response
        accept_enc = request.headers.get("accept-encoding", "")
        if "gzip" not in accept_enc:
            return response
        body = b""
        async for chunk in response.body_iterator:
            body += chunk if isinstance(chunk, bytes) else chunk.encode()
        if len(body) < self.minimum_size:
            return StarletteResponse(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
        compressed = _gzip.compress(body, compresslevel=6)
        headers = dict(response.headers)
        headers["content-encoding"] = "gzip"
        headers["content-length"] = str(len(compressed))
        headers.pop("transfer-encoding", None)
        return StarletteResponse(
            content=compressed,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )


# Application FastAPI principale
app = FastAPI(title="CyberSentinel-LLM", version="0.1.0", lifespan=lifespan)

# CORS – autoriser le frontend (origines configurables via env)
app.add_middleware(_SafeGZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sécurité — middlewares (extraits dans app/middleware/)
# Ordre d'enregistrement = inversé à l'exécution : le dernier ajouté est exécuté en premier.
# On veut: defense → rate_limit → body_size → security_headers (ce dernier enveloppe les réponses).
app.middleware("http")(security_headers_middleware)
app.middleware("http")(body_size_middleware)
app.middleware("http")(rate_limit_middleware)
app.middleware("http")(defense_enforcement_middleware)

# Page racine – lien rapide vers endpoints utiles
@app.get("/", response_class=HTMLResponse)
def root():
    return "<h3>CyberSentinel-LLM API</h3><p>See /health, /alerts, /stream/alerts</p>"

# Routes – exposer les fonctionnalités utilisées par le frontend
app.include_router(health_router)          # /health
app.include_router(ingest_router)          # /ingest (données de démo)
app.include_router(alerts_router)          # /alerts CRUD + flux
app.include_router(incidents_router)       # /incidents CRUD
app.include_router(llm_router)             # /llm/incidents/{id}/explain
app.include_router(llm_chat_router)        # /llm/chat (chat libre)
app.include_router(chat_store_router)      # /llm/conversations/* (persistance)
app.include_router(map_router)             # /map/points (carte)
app.include_router(demo_router)            # /demo/* (scénario démo)
app.include_router(sse_router)             # /stream/alerts (SSE)
app.include_router(validation_router)      # /validation/alerts/{id}
app.include_router(metrics_router)         # /metrics/model (indicateurs ML)
app.include_router(assistant_router)       # /llm/assistant/query (vue d'ensemble)
app.include_router(transcribe_router)      # /llm/transcribe (Whisper STT local)
app.include_router(tts_router)             # /llm/tts (espeak-ng TTS local)
app.include_router(defense_router)         # /defense/* (actions de defense applicative)
