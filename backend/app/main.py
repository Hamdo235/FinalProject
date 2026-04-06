from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .routers.health import router as health_router
from .routers.ingest import router as ingest_router
from .routers.alerts import router as alerts_router
from .routers.incidents import router as incidents_router
from .routers.llm import router as llm_router
from .endpoints.llm_chat import router as llm_chat_router
from .routers.map import router as map_router
from .routers.demo import router as demo_router
from .services.sse import router as sse_router
from .routers.validation import router as validation_router
from .routers.metrics import router as metrics_router
from .routers.defense import router as defense_router
from .endpoints.chat_store import router as chat_store_router
from .endpoints.assistant import router as assistant_router
from .db.session import engine
from .core.settings import settings
from .services.defense import defense_enforce_api, is_ip_blocked, expire_actions
import time
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from sqlmodel import SQLModel, Session as SQLModelSession
# runtime metrics removed for simplicity

logger = logging.getLogger(__name__)
_rag_executor: ThreadPoolExecutor | None = None

# Application FastAPI principale
app = FastAPI(title="CyberSentinel-LLM", version="0.1.0")

# CORS – autoriser le frontend (origines configurables via env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sécurité – limite simple sur la taille des requêtes
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    cl = request.headers.get("content-length")
    try:
        if cl is not None and int(cl) > settings.max_body_size_bytes:
            return JSONResponse({"detail": "Payload trop volumineux"}, status_code=413)
    except Exception:
        pass
    return await call_next(request)

# Sécurité – rate limiting simple par IP (fenêtre 60s)
_RL_BUCKET = defaultdict(lambda: {"count": 0, "reset": 0.0})

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    # In dev, the frontend may poll several endpoints and keep SSE open.
    # The simple bucket limiter can easily trigger false positives and break the UI.
    if settings.debug or settings.rate_limit_per_minute <= 0:
        return await call_next(request)
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}"
    now = time.time()
    bucket = _RL_BUCKET[key]
    if now > bucket["reset"]:
        bucket["count"], bucket["reset"] = 0, now + 60
    bucket["count"] += 1
    if bucket["count"] > settings.rate_limit_per_minute:
        return JSONResponse({"detail": "Trop de requêtes"}, status_code=429)
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(settings.rate_limit_per_minute)
    response.headers["X-RateLimit-Remaining"] = str(max(0, settings.rate_limit_per_minute - bucket["count"]))
    response.headers["X-RateLimit-Reset"] = str(int(bucket["reset"]))
    return response

# Sécurité – ajouter des en-têtes HTTP protecteurs
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
    return response


@app.middleware("http")
async def defense_enforcement(request: Request, call_next):
    if not defense_enforce_api():
        return await call_next(request)
    client_ip = request.client.host if request.client else None
    if not client_ip:
        return await call_next(request)
    try:
        with SQLModelSession(engine) as db:
            expire_actions(db)
            if is_ip_blocked(db, client_ip):
                return JSONResponse({"detail": "IP temporairement bloquee par defense applicative"}, status_code=403)
    except Exception:
        pass
    return await call_next(request)

# runtime metrics middleware removed for minimal backend

# Démarrage – création des tables (SQLModel + SQLite) + initialisation RAG différée
@app.on_event("startup")
async def on_startup():
    # Créer les tables SQLite (rapide, synchrone)
    from .models import alert as _a
    from .models import incident as _i
    from .models import llm_trace as _l
    from .models import ip_enrichment as _e
    from .models import label as _lbl
    from .models import chat as _chat
    from .models import defense_action as _def
    SQLModel.metadata.create_all(bind=engine)

    # Initialisation RAG configurable pour réduire la pression CPU/RAM en dev.
    from .services import rag_service
    global _rag_executor

    if not settings.rag_enabled:
        logger.info("[RAG] Désactivé (RAG_ENABLED=false)")
        return

    rag_mode = settings.rag_init_mode.strip().lower()
    if rag_mode in {"off", "disabled"}:
        logger.info("[RAG] Désactivé (RAG_INIT_MODE=%s)", rag_mode)
        return
    if rag_mode == "lazy":
        logger.info("[RAG] Mode lazy actif: initialisation au premier appel")
        return

    if rag_mode != "background":
        logger.warning("[RAG] Mode inconnu '%s', fallback en background", rag_mode)

    def _init_rag():
        rag_service.initialize()

    worker_count = max(1, settings.rag_init_max_workers)
    _rag_executor = ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="rag-init")
    loop = asyncio.get_running_loop()
    loop.run_in_executor(_rag_executor, _init_rag)


@app.on_event("shutdown")
async def on_shutdown():
    global _rag_executor
    if _rag_executor is not None:
        _rag_executor.shutdown(wait=False, cancel_futures=True)
        _rag_executor = None

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
app.include_router(defense_router)         # /defense/* (actions de defense applicative)
