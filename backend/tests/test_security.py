"""Tests de non-régression pour les fixes de sécurité (audit avril 2026).

Couvre :
- Protection admin token sur /demo/reset, /demo/generate, /defense/unblock
- Validation TTL sur /defense/block-manual
- Limite de taille de batch sur /ingest/logs
- LogRecord accepte les champs additionnels (extra='allow')
"""
import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_dev():
    """Backend en mode dev (pas de ADMIN_TOKEN) → endpoints démo ouverts."""
    os.environ.pop("ADMIN_TOKEN", None)
    # Force re-import to pick up env change
    from app.core.settings import settings
    settings.admin_token = ""
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client_prod(monkeypatch):
    """Backend avec ADMIN_TOKEN → endpoints démo protégés."""
    monkeypatch.setenv("ADMIN_TOKEN", "test-token-xyz")
    from app.core.settings import settings
    monkeypatch.setattr(settings, "admin_token", "test-token-xyz")
    from app.main import app
    with TestClient(app) as c:
        yield c


def test_demo_endpoints_open_in_dev(client_dev):
    """Mode dev (pas de token) : /demo/* doivent rester accessibles."""
    r = client_dev.post("/demo/generate")
    assert r.status_code == 200
    r = client_dev.post("/demo/reset")
    assert r.status_code == 200


def test_demo_endpoints_require_token_in_prod(client_prod):
    """Production avec token : sans header → 401."""
    assert client_prod.post("/demo/reset").status_code == 401
    assert client_prod.post("/demo/generate").status_code == 401


def test_demo_endpoints_accept_correct_token(client_prod):
    """Production avec bon token → 200."""
    headers = {"X-ADMIN-TOKEN": "test-token-xyz"}
    assert client_prod.post("/demo/reset", headers=headers).status_code == 200
    assert client_prod.post("/demo/generate", headers=headers).status_code == 200


def test_defense_unblock_requires_token(client_prod):
    """/defense/unblock doit exiger le token admin."""
    r = client_prod.post("/defense/unblock/1.2.3.4")
    assert r.status_code == 401
    r = client_prod.post(
        "/defense/unblock/1.2.3.4",
        headers={"X-ADMIN-TOKEN": "test-token-xyz"},
    )
    assert r.status_code == 200


def test_block_manual_validates_ttl_too_high(client_dev):
    """ttl_minutes au-delà de 24h doit être rejeté."""
    r = client_dev.post(
        "/defense/block-manual",
        json={"ip": "1.2.3.4", "ttl_minutes": 99999},
    )
    assert r.status_code == 400
    assert "ttl_minutes" in r.json()["detail"].lower()


def test_block_manual_validates_ttl_zero(client_dev):
    """ttl_minutes=0 doit être rejeté (sinon blocage déjà expiré)."""
    r = client_dev.post(
        "/defense/block-manual",
        json={"ip": "1.2.3.4", "ttl_minutes": 0},
    )
    assert r.status_code == 400


def test_block_manual_accepts_valid_ttl(client_dev):
    """ttl_minutes dans [1, 1440] doit passer."""
    r = client_dev.post(
        "/defense/block-manual",
        json={"ip": "10.0.0.42", "ttl_minutes": 60, "reason": "test"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_ingest_rejects_oversized_batch(client_dev):
    """/ingest/logs avec >500 items doit être refusé (413)."""
    payload = [{"source": "ssh", "ip": "1.2.3.4"} for _ in range(501)]
    r = client_dev.post("/ingest/logs", json=payload)
    assert r.status_code == 413


def test_ingest_accepts_extra_fields(client_dev):
    """LogRecord(extra='allow') : les champs custom passent."""
    r = client_dev.post(
        "/ingest/logs",
        json={"source": "ssh", "ip": "8.8.8.8", "custom_field": "x"},
    )
    assert r.status_code == 200
    assert r.json().get("ingested") == 1


def test_ingest_validates_field_lengths(client_dev):
    """Les chaînes trop longues doivent être rejetées par Pydantic."""
    long = "a" * 1000
    r = client_dev.post(
        "/ingest/logs",
        json={"source": long, "ip": "1.1.1.1"},
    )
    # Pydantic rejette au niveau du body parsing (422)
    assert r.status_code in (400, 422)


def test_defense_rejects_wrong_token(client_prod):
    """Un mauvais token doit renvoyer 401 (comparaison constante-temps)."""
    r = client_prod.post(
        "/defense/unblock/1.2.3.4",
        headers={"X-ADMIN-TOKEN": "mauvais-token"},
    )
    assert r.status_code == 401


def test_defense_accepts_token_via_body(client_prod):
    """Le token peut être fourni dans le corps de la requête."""
    r = client_prod.post(
        "/defense/block-manual",
        json={"ip": "5.6.7.8", "ttl_minutes": 10, "token": "test-token-xyz"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_ingest_requires_token_in_prod(client_prod):
    """/ingest/logs doit exiger le token admin en production."""
    payload = {"source": "ssh", "ip": "1.2.3.4"}
    assert client_prod.post("/ingest/logs", json=payload).status_code == 401
    r = client_prod.post(
        "/ingest/logs",
        json=payload,
        headers={"X-ADMIN-TOKEN": "test-token-xyz"},
    )
    assert r.status_code == 200


def test_require_admin_token_skipped_when_unset(monkeypatch):
    """Sans ADMIN_TOKEN configuré, le contrôle est ignoré (mode dev)."""
    from app.core import security
    from app.core.settings import settings

    monkeypatch.setattr(settings, "admin_token", "")
    # Ne doit pas lever, même sans requête.
    security.require_admin_token(None)
