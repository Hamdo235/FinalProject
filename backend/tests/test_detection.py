"""Tests for the anomaly-scoring service.

Focus on the deterministic paths: the heuristic fallback (used when there is
not enough history to fit the ML models) and the public scoring contract.
"""
from sqlmodel import Session, SQLModel

from app.db.session import engine
from app.routers.demo import demo_reset
from app.services.detection import _heuristic_fallback, score_with_isolation_forest


def test_heuristic_failed_login_is_high_severity():
    score, rule, severity = _heuristic_fallback(
        {"is_fail": 1.0, "ip_fail_count_60m": 5.0}
    )
    assert rule == "ssh_failed_login"
    assert severity == "high"
    assert 0.0 <= score <= 1.0


def test_heuristic_successful_login_is_low_severity():
    score, rule, severity = _heuristic_fallback(
        {"is_fail": 0.0, "ip_fail_count_60m": 0.0}
    )
    assert rule == "ssh_login"
    assert severity == "low"
    assert score == 0.2


def test_heuristic_score_is_clamped_to_unit_interval():
    score, _rule, _sev = _heuristic_fallback(
        {"is_fail": 1.0, "ip_fail_count_60m": 9999.0}
    )
    assert 0.0 <= score <= 1.0


def test_heuristic_score_increases_with_failure_count():
    low, *_ = _heuristic_fallback({"is_fail": 1.0, "ip_fail_count_60m": 0.0})
    high, *_ = _heuristic_fallback({"is_fail": 1.0, "ip_fail_count_60m": 4.0})
    assert high > low


def test_score_falls_back_to_heuristic_on_empty_db():
    """With <20 historical alerts the service must use the heuristic path."""
    SQLModel.metadata.create_all(bind=engine)
    with Session(engine) as db:
        demo_reset(db=db)  # wipe alerts so the training matrix is too small
        score, rule, severity = score_with_isolation_forest(
            {"source": "ssh", "status": "fail", "ip": "203.0.113.9"}, db
        )
    assert rule == "ssh_failed_login"
    assert severity in ("low", "medium", "high")
    assert 0.0 <= score <= 1.0
