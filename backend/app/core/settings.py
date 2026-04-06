from pathlib import Path
from pydantic import BaseModel
import os

BASE_DIR = Path(__file__).resolve().parents[2]
DB_DIR = BASE_DIR / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}

class Settings(BaseModel):
    app_name: str = "CyberSentinel-LLM"
    debug: bool = _env_bool("DEBUG", True)
    database_url: str = f"sqlite:///{DB_DIR / 'csllm.db'}"
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_url: str = os.getenv("OLLAMA_URL", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    max_body_size_bytes: int = int(os.getenv("MAX_BODY_SIZE_BYTES", "1048576"))  # 1 MiB par défaut
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT", "30"))
    rag_enabled: bool = _env_bool("RAG_ENABLED", True)
    rag_init_mode: str = os.getenv("RAG_INIT_MODE", "lazy")  # off | background | lazy
    rag_init_max_workers: int = int(os.getenv("RAG_INIT_MAX_WORKERS", "1"))

settings = Settings()
