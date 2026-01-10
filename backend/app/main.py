from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from .routers.health import router as health_router
from .routers.ingest import router as ingest_router
from .routers.alerts import router as alerts_router
from .routers.incidents import router as incidents_router
from .routers.llm import router as llm_router
from .routers.map import router as map_router
from .routers.demo import router as demo_router
from .services.sse import router as sse_router
from .routers.validation import router as validation_router
from .routers.metrics import router as metrics_router
from .db.session import engine
from sqlmodel import SQLModel

app = FastAPI(title="CyberSentinel-LLM", version="0.1.0")

# CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # Create tables
    from .models import alert as _a  # ensure models imported
    from .models import incident as _i
    from .models import llm_trace as _l
    from .models import ip_enrichment as _e
    from .models import label as _lbl
    SQLModel.metadata.create_all(bind=engine)

@app.get("/", response_class=HTMLResponse)
def root():
    return "<h3>CyberSentinel-LLM API</h3><p>See /health, /alerts, /stream/alerts</p>"

app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(alerts_router)
app.include_router(incidents_router)
app.include_router(llm_router)
app.include_router(map_router)
app.include_router(demo_router)
app.include_router(sse_router)
app.include_router(validation_router)
app.include_router(metrics_router)
