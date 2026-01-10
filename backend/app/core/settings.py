from pathlib import Path
from pydantic import BaseModel
import os

BASE_DIR = Path(__file__).resolve().parents[2]
DB_DIR = BASE_DIR / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    app_name: str = "CyberSentinel-LLM"
    debug: bool = True
    database_url: str = f"sqlite:///{DB_DIR / 'csllm.db'}"
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

settings = Settings()
