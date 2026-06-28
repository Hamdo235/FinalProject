"""Tests for the per-IP fixed-window rate-limit middleware."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.settings import settings
from app.middleware.rate_limit import _BUCKET, rate_limit_middleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(rate_limit_middleware)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return app


@pytest.fixture(autouse=True)
def _reset_buckets():
    _BUCKET.clear()
    yield
    _BUCKET.clear()


def test_disabled_in_debug(monkeypatch):
    monkeypatch.setattr(settings, "debug", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 1)
    client = TestClient(_build_app())
    # Many requests, never throttled because debug bypasses the limiter.
    for _ in range(5):
        assert client.get("/ping").status_code == 200


def test_throttles_after_limit(monkeypatch):
    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 3)
    client = TestClient(_build_app())

    for _ in range(3):
        assert client.get("/ping").status_code == 200
    # 4th request within the same window is rejected.
    r = client.get("/ping")
    assert r.status_code == 429


def test_exposes_rate_limit_headers(monkeypatch):
    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 10)
    client = TestClient(_build_app())
    r = client.get("/ping")
    assert r.headers["X-RateLimit-Limit"] == "10"
    assert int(r.headers["X-RateLimit-Remaining"]) == 9
    assert "X-RateLimit-Reset" in r.headers


def test_disabled_when_limit_non_positive(monkeypatch):
    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 0)
    client = TestClient(_build_app())
    for _ in range(5):
        assert client.get("/ping").status_code == 200
