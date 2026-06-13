"""Tests de non-régression pour la couche défense.

Couvre :
- decide_defense_action() : tous les modes (off, monitor, assist, auto)
- Seuils : score élevé → block_temp, moyen → review, faible → monitor
- known_rule vs ml_ rule
- create_defense_action() : persistance en DB
- expire_actions() : passage à active=False quand expires_at est dépassé
- Endpoint POST /defense/actions/{id}/approve
- Endpoint POST /defense/actions/{id}/auto-decide (Ollama mocké)
"""
import os
from datetime import datetime, timedelta, UTC
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.db.session import engine
from app.models.alert import Alert
from app.models.defense_action import DefenseAction
from app.services.defense import (
    create_defense_action,
    decide_defense_action,
    expire_actions,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _make_alert(
    ip: str = "1.2.3.4",
    score: float = 0.5,
    severity: str = "medium",
    rule: str = "ssh_brute_force",
) -> Alert:
    return Alert(
        source="ssh",
        ip=ip,
        rule=rule,
        score=score,
        severity=severity,
        status="open",
        ts=_utcnow_naive(),
    )


@pytest.fixture(autouse=True)
def clean_db():
    SQLModel.metadata.create_all(bind=engine)
    yield
    with Session(engine) as db:
        db.exec(__import__("sqlmodel").delete(DefenseAction))
        db.exec(__import__("sqlmodel").delete(Alert))
        db.commit()


@pytest.fixture
def db():
    with Session(engine) as s:
        yield s


@pytest.fixture
def client():
    os.environ.pop("ADMIN_TOKEN", None)
    from app.core.settings import settings
    settings.admin_token = ""
    from app.main import app
    with TestClient(app) as c:
        yield c


# ── decide_defense_action ─────────────────────────────────────────────────────


def test_mode_off_always_allows(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "off")
    alert = _make_alert(score=0.99, severity="high")
    d = decide_defense_action(alert)
    assert d["action"] == "allow"
    assert d["active"] is False


def test_mode_monitor_never_blocks(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "monitor")
    alert = _make_alert(score=0.99, severity="high")
    d = decide_defense_action(alert)
    assert d["action"] == "monitor"
    assert d["active"] is False


def test_known_rule_high_severity_blocks(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    alert = _make_alert(score=0.5, severity="high", rule="ssh_brute_force")
    d = decide_defense_action(alert)
    assert d["action"] == "block_temp"
    assert d["active"] is True
    assert "known_attack" in d["reason"]


def test_ml_rule_not_treated_as_known(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    monkeypatch.setenv("DEFENSE_AUTO_BLOCK_THRESHOLD", "0.85")
    # score below auto threshold, ml_ rule → should not be treated as known_rule
    alert = _make_alert(score=0.7, severity="medium", rule="ml_anomaly_123")
    d = decide_defense_action(alert)
    assert d["action"] in ("review", "monitor")
    assert d["action"] != "block_temp" or d.get("reason", "").startswith("high_confidence")


def test_high_score_in_auto_mode_blocks(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "auto")
    monkeypatch.setenv("DEFENSE_AUTO_BLOCK_THRESHOLD", "0.85")
    alert = _make_alert(score=0.95, severity="medium", rule="ml_anomaly")
    d = decide_defense_action(alert)
    assert d["action"] == "block_temp"
    assert d["active"] is True


def test_medium_score_triggers_review(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    monkeypatch.setenv("DEFENSE_AUTO_BLOCK_THRESHOLD", "0.85")
    monkeypatch.setenv("DEFENSE_REVIEW_THRESHOLD", "0.6")
    alert = _make_alert(score=0.7, severity="medium", rule="ml_anomaly")
    d = decide_defense_action(alert)
    assert d["action"] == "review"
    assert d["requires_approval"] is True


def test_low_score_monitors(monkeypatch):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    monkeypatch.setenv("DEFENSE_REVIEW_THRESHOLD", "0.6")
    alert = _make_alert(score=0.3, severity="low", rule="ml_anomaly")
    d = decide_defense_action(alert)
    assert d["action"] == "monitor"
    assert d["active"] is False


# ── create_defense_action & expire_actions ────────────────────────────────────


def test_create_and_persist_action(monkeypatch, db):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    alert = Alert(source="test", ip="5.5.5.5", score=0.9, severity="high",
                  rule="ssh_brute_force", status="open", ts=_utcnow_naive())
    db.add(alert)
    db.commit()
    db.refresh(alert)

    decision = decide_defense_action(alert)
    action = create_defense_action(db, alert, decision)

    assert action.id is not None
    assert action.ip == "5.5.5.5"
    assert action.action == decision["action"]


def test_expire_actions_deactivates_expired(monkeypatch, db):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    alert = Alert(source="test", ip="6.6.6.6", score=0.9, severity="high",
                  rule="ssh_brute_force", status="open", ts=_utcnow_naive())
    db.add(alert)
    db.commit()
    db.refresh(alert)

    past = _utcnow_naive() - timedelta(minutes=5)
    action = DefenseAction(
        alert_id=alert.id,
        ip="6.6.6.6",
        action="block_temp",
        confidence=0.9,
        mode="assist",
        active=True,
        expires_at=past,
        created_by="system",
    )
    db.add(action)
    db.commit()

    expired = expire_actions(db)
    assert expired == 1

    db.refresh(action)
    assert action.active is False


def test_expire_actions_keeps_future_actions(monkeypatch, db):
    monkeypatch.setenv("DEFENSE_MODE", "assist")
    alert = Alert(source="test", ip="7.7.7.7", score=0.9, severity="high",
                  rule="ssh_brute_force", status="open", ts=_utcnow_naive())
    db.add(alert)
    db.commit()
    db.refresh(alert)

    future = _utcnow_naive() + timedelta(hours=1)
    action = DefenseAction(
        alert_id=alert.id,
        ip="7.7.7.7",
        action="block_temp",
        confidence=0.9,
        mode="assist",
        active=True,
        expires_at=future,
        created_by="system",
    )
    db.add(action)
    db.commit()

    expired = expire_actions(db)
    assert expired == 0

    db.refresh(action)
    assert action.active is True


# ── Endpoint /approve ─────────────────────────────────────────────────────────


def test_approve_action_adds_to_blacklist(client):
    alert_resp = client.post(
        "/ingest/logs",
        json={"source": "test", "ip": "9.9.9.9", "score": 0.75},
    )
    assert alert_resp.status_code == 200

    actions_resp = client.get("/defense/actions")
    assert actions_resp.status_code == 200
    actions = actions_resp.json()
    assert len(actions) >= 1
    action_id = actions[0]["id"]

    approve_resp = client.post(
        f"/defense/actions/{action_id}/approve",
        json={"approved_by": "Analyste Test"},
    )
    assert approve_resp.status_code == 200
    data = approve_resp.json()
    assert data.get("ok") is True


def test_approve_nonexistent_action_returns_404(client):
    r = client.post("/defense/actions/999999/approve", json={"approved_by": "test"})
    assert r.status_code == 404


# ── Endpoint /auto-decide (Ollama mocké) ─────────────────────────────────────


def test_auto_decide_already_decided_returns_flag(client):
    """Une action déjà approuvée retourne already_decided sans appeler le LLM."""
    from app.db.session import engine
    from sqlmodel import Session

    with Session(engine) as db:
        alert = Alert(source="test", ip="11.11.11.11", score=0.9, severity="high",
                      rule="ssh_brute_force", status="open", ts=_utcnow_naive())
        db.add(alert)
        db.commit()
        db.refresh(alert)

        action = DefenseAction(
            alert_id=alert.id, ip="11.11.11.11", action="block_temp",
            confidence=0.9, mode="assist", active=True,
            expires_at=_utcnow_naive() + timedelta(hours=1),
            created_by="system",
            approved_by="Analyste SOC",
            approved_at=_utcnow_naive(),
        )
        db.add(action)
        db.commit()
        db.refresh(action)
        action_id = action.id

    r = client.post(f"/defense/actions/{action_id}/auto-decide")
    assert r.status_code == 200
    assert r.json().get("already_decided") is True


def test_auto_decide_fallback_on_llm_failure(client, monkeypatch):
    """Quand Ollama est injoignable, le fallback heuristique s'applique (score ≥ 0.7 → block)."""
    with Session(engine) as db:
        alert = Alert(source="test", ip="12.12.12.12", score=0.9, severity="high",
                      rule="ssh_brute_force", status="open", ts=_utcnow_naive())
        db.add(alert)
        db.commit()
        db.refresh(alert)
        action = DefenseAction(
            alert_id=alert.id, ip="12.12.12.12", action="review",
            confidence=0.9, mode="assist", active=False,
            created_by="system",
        )
        db.add(action)
        db.commit()
        db.refresh(action)
        action_id = action.id

    import httpx

    async def _raise(*args, **kwargs):
        raise httpx.ConnectError("Ollama down")

    with patch("httpx.AsyncClient.post", side_effect=_raise):
        r = client.post(f"/defense/actions/{action_id}/auto-decide")

    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["decision"] == "block"  # score=0.9 ≥ 0.7 → block


def test_auto_decide_llm_allow_decision(client):
    """Quand le LLM retourne 'allow', l'action est révoquée."""
    with Session(engine) as db:
        alert = Alert(source="test", ip="13.13.13.13", score=0.3, severity="low",
                      rule="ml_anomaly", status="open", ts=_utcnow_naive())
        db.add(alert)
        db.commit()
        db.refresh(alert)
        action = DefenseAction(
            alert_id=alert.id, ip="13.13.13.13", action="review",
            confidence=0.3, mode="assist", active=False,
            created_by="system",
        )
        db.add(action)
        db.commit()
        db.refresh(action)
        action_id = action.id

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "response": '{"decision": "allow", "confidence": 0.3, "reasoning": "Faible risque détecté."}'
    }

    async def _mock_post(*args, **kwargs):
        return mock_response

    with patch("httpx.AsyncClient.post", side_effect=_mock_post):
        r = client.post(f"/defense/actions/{action_id}/auto-decide")

    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["decision"] == "allow"
