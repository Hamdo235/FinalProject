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
from .endpoints.chat_store import router as chat_store_router
from .endpoints.assistant import router as assistant_router
from .db.session import engine
from .core.settings import settings
import time
from collections import defaultdict
from sqlmodel import SQLModel
# runtime metrics removed for simplicity

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

# runtime metrics middleware removed for minimal backend

# Démarrage – création des tables (SQLModel + SQLite)
@app.on_event("startup")
def on_startup():
    # Create tables
    from .models import alert as _a  # ensure models imported
    from .models import incident as _i
    from .models import llm_trace as _l
    from .models import ip_enrichment as _e
    from .models import label as _lbl
    from .models import chat as _chat
    SQLModel.metadata.create_all(bind=engine)

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
