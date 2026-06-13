"""Tests unitaires pour le service ip_blacklist (mémoire O(1)).

Couvre :
- add_ip / is_blocked / remove_ip
- Expiration automatique : une IP expirée n'est plus bloquée
- get_all() purge les entrées expirées
- get_blocked_entry() retourne None si expirée
- count() est exact
- Thread-safety : pas de crash lors d'accès concurrents (smoke test)
"""
from datetime import datetime, timedelta, UTC
from threading import Thread

import pytest

from app.services import ip_blacklist


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@pytest.fixture(autouse=True)
def clean_blacklist():
    """Remet la blacklist à zéro avant chaque test."""
    ip_blacklist._blacklist.clear()
    yield
    ip_blacklist._blacklist.clear()


# ── Opérations de base ────────────────────────────────────────────────────────


def test_add_and_is_blocked():
    ip_blacklist.add_ip("10.0.0.1", expires_at=None, reason="test", approved_by="pytest")
    assert ip_blacklist.is_blocked("10.0.0.1") is True


def test_unknown_ip_not_blocked():
    assert ip_blacklist.is_blocked("192.168.99.99") is False


def test_remove_ip():
    ip_blacklist.add_ip("10.0.0.2", expires_at=None, reason="test", approved_by="pytest")
    ip_blacklist.remove_ip("10.0.0.2")
    assert ip_blacklist.is_blocked("10.0.0.2") is False


def test_remove_nonexistent_ip_is_noop():
    ip_blacklist.remove_ip("99.99.99.99")  # ne doit pas lever d'exception


def test_count():
    assert ip_blacklist.count() == 0
    ip_blacklist.add_ip("10.0.0.3", expires_at=None, reason="r", approved_by="p")
    ip_blacklist.add_ip("10.0.0.4", expires_at=None, reason="r", approved_by="p")
    assert ip_blacklist.count() == 2


# ── Expiration automatique ────────────────────────────────────────────────────


def test_expired_ip_not_blocked():
    past = _utcnow() - timedelta(seconds=1)
    ip_blacklist.add_ip("10.0.1.1", expires_at=past, reason="expired", approved_by="pytest")
    assert ip_blacklist.is_blocked("10.0.1.1") is False


def test_future_expiry_still_blocked():
    future = _utcnow() + timedelta(hours=1)
    ip_blacklist.add_ip("10.0.1.2", expires_at=future, reason="valid", approved_by="pytest")
    assert ip_blacklist.is_blocked("10.0.1.2") is True


def test_get_all_purges_expired():
    past = _utcnow() - timedelta(seconds=1)
    future = _utcnow() + timedelta(hours=1)
    ip_blacklist.add_ip("10.0.2.1", expires_at=past,   reason="old", approved_by="p")
    ip_blacklist.add_ip("10.0.2.2", expires_at=future, reason="ok",  approved_by="p")

    result = ip_blacklist.get_all()
    ips = [e["ip"] for e in result]
    assert "10.0.2.1" not in ips
    assert "10.0.2.2" in ips


def test_get_blocked_entry_expired_returns_none():
    past = _utcnow() - timedelta(seconds=1)
    ip_blacklist.add_ip("10.0.3.1", expires_at=past, reason="x", approved_by="p")
    assert ip_blacklist.get_blocked_entry("10.0.3.1") is None


def test_get_blocked_entry_returns_dict():
    ip_blacklist.add_ip("10.0.3.2", expires_at=None, reason="r", approved_by="admin")
    entry = ip_blacklist.get_blocked_entry("10.0.3.2")
    assert entry is not None
    assert entry["ip"] == "10.0.3.2"
    assert "iptables_command" in entry
    assert "iptables_unblock" in entry


# ── action_id tracking ────────────────────────────────────────────────────────


def test_action_id_stored():
    ip_blacklist.add_ip("10.0.4.1", expires_at=None, reason="r", approved_by="p", action_id=42)
    entry = ip_blacklist.get_blocked_entry("10.0.4.1")
    assert entry is not None
    assert entry["action_id"] == 42


# ── Thread-safety smoke test ──────────────────────────────────────────────────


def test_concurrent_add_remove_no_crash():
    errors = []

    def _worker(i: int):
        try:
            ip = f"172.16.{i}.1"
            ip_blacklist.add_ip(ip, expires_at=None, reason="concurrent", approved_by="t")
            ip_blacklist.is_blocked(ip)
            ip_blacklist.remove_ip(ip)
        except Exception as exc:
            errors.append(exc)

    threads = [Thread(target=_worker, args=(i,)) for i in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == [], f"Erreurs de concurrence : {errors}"
