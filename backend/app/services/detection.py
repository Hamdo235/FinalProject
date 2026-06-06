from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, UTC
import json
import math
import os
import time
from threading import Lock
from dataclasses import dataclass, field

from sqlmodel import select
from sqlalchemy.orm import Session
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
import numpy as np

from ..models.alert import Alert

# ---------------------------------------------------------------------------
# Modèle cache — évite de ré-entraîner IsolationForest/LOF à chaque ingest
# ---------------------------------------------------------------------------
_MODEL_CACHE_TTL = 30  # secondes

@dataclass
class _ModelCache:
    iforest: IsolationForest
    lof: LocalOutlierFactor
    n_samples: int
    trained_at: float = field(default_factory=time.monotonic)

    def is_fresh(self, n_samples: int) -> bool:
        same_size = self.n_samples == n_samples
        not_expired = (time.monotonic() - self.trained_at) < _MODEL_CACHE_TTL
        return same_size and not_expired

_cache: Optional[_ModelCache] = None
_cache_lock = Lock()

# Simple feature extraction for SSH-like records
# Features: [is_ssh, is_fail, hour_sin, hour_cos, ip_fail_count_60m]

def _features_from_record(rec: Dict[str, Any], db: Session) -> Tuple[np.ndarray, Dict[str, Any]]:
    now = datetime.now(UTC).replace(tzinfo=None)
    source = str(rec.get("source", "unknown")).lower()
    is_ssh = 1.0 if source == "ssh" else 0.0
    status = str(rec.get("status", "")).lower()
    is_fail = 1.0 if status == "fail" else 0.0
    ts = rec.get("ts")
    try:
        ts_dt = datetime.fromisoformat(ts) if ts else now
    except (TypeError, ValueError):
        ts_dt = now
    hour = ts_dt.hour + ts_dt.minute/60.0
    hour_sin = math.sin(2*math.pi*hour/24.0)
    hour_cos = math.cos(2*math.pi*hour/24.0)

    ip = rec.get("ip")
    ip_fail_count = 0.0
    if ip:
        since = now - timedelta(minutes=60)
        q = select(Alert).where(Alert.ip == ip).where(Alert.ts >= since)
        rows = db.exec(q).all()
        for a in rows:
            try:
                f = json.loads(a.features_json or "{}")
                if str(f.get("status", "")).lower() == "fail":
                    ip_fail_count += 1.0
            except (TypeError, json.JSONDecodeError):
                pass

    x = np.array([is_ssh, is_fail, hour_sin, hour_cos, ip_fail_count], dtype=float)
    extra = {
        "is_ssh": is_ssh,
        "is_fail": is_fail,
        "hour": hour,
        "ip_fail_count_60m": ip_fail_count,
    }
    return x, extra


def _build_training_matrix(db: Session, limit: int = 200) -> np.ndarray:
    """Construit la matrice d'entraînement SANS requête DB par ligne.

    On extrait les features directement depuis features_json (déjà stocké).
    ip_fail_count_60m est approché par is_fail * 2 pour les records historiques
    (évite 200 requêtes SQL supplémentaires par ingest).
    """
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(limit)
    rows = db.exec(stmt).all()
    X: List[np.ndarray] = []
    for a in rows:
        try:
            rec = json.loads(a.features_json or "{}")
        except (TypeError, json.JSONDecodeError):
            rec = {}
        source = str(rec.get("source", "")).lower()
        is_ssh  = 1.0 if source == "ssh" else 0.0
        status  = str(rec.get("status", "")).lower()
        is_fail = 1.0 if status == "fail" else 0.0
        ts_raw = rec.get("ts")
        try:
            ts_dt = datetime.fromisoformat(ts_raw) if ts_raw else (a.ts or datetime.now(UTC).replace(tzinfo=None))
        except (TypeError, ValueError):
            ts_dt = a.ts or datetime.now(UTC).replace(tzinfo=None)
        hour     = ts_dt.hour + ts_dt.minute / 60.0
        hour_sin = math.sin(2 * math.pi * hour / 24.0)
        hour_cos = math.cos(2 * math.pi * hour / 24.0)
        # ip_fail_count approximé — évite N requêtes supplémentaires
        ip_fail_approx = is_fail * 2.0
        X.append(np.array([is_ssh, is_fail, hour_sin, hour_cos, ip_fail_approx], dtype=float))
    if not X:
        return np.zeros((0, 5), dtype=float)
    return np.vstack(X)


def _heuristic_fallback(extra: Dict[str, Any]) -> Tuple[float, str, str]:
    is_fail = extra["is_fail"]
    ip_fail = extra["ip_fail_count_60m"]
    score = 0.2 + 0.5 * is_fail + min(ip_fail, 5.0) * 0.05
    score = max(0.0, min(1.0, score))
    rule = "ssh_failed_login" if is_fail >= 0.5 else "ssh_login"
    severity = "high" if score >= 0.75 else ("medium" if score >= 0.4 else "low")
    return float(score), rule, severity


def _get_or_train_models(X: np.ndarray) -> _ModelCache:
    """Retourne les modèles entraînés depuis le cache ou les ré-entraîne."""
    global _cache
    n = X.shape[0]
    with _cache_lock:
        if _cache is not None and _cache.is_fresh(n):
            return _cache
        k_neighbors = min(20, max(5, n // 10))
        clf = IsolationForest(contamination="auto", random_state=42, n_estimators=100)
        clf.fit(X)
        lof = LocalOutlierFactor(n_neighbors=k_neighbors, novelty=True)
        lof.fit(X)
        _cache = _ModelCache(iforest=clf, lof=lof, n_samples=n)
        return _cache


def _score_iforest(x: np.ndarray, cache: _ModelCache) -> float:
    df = cache.iforest.decision_function([x])[0]
    prob_normal = 1.0 / (1.0 + math.exp(-4.0 * df))
    return float(1.0 - prob_normal)


def _score_lof(x: np.ndarray, cache: _ModelCache) -> float:
    try:
        raw = cache.lof.score_samples(x.reshape(1, -1))[0]  # negative LOF score
        # score_samples: inlier ≈ -1.0, outlier << -1.0
        # Map to [0,1]: 0 = normal (LOF≈1), 1 = anomaly (LOF>>1)
        anomaly = max(0.0, min(1.0, max(0.0, -raw - 1.0) / 3.0))
        return float(anomaly)
    except Exception:
        return 0.5


def score_with_isolation_forest(rec: Dict[str, Any], db: Session) -> Tuple[float, str, str]:
    """
    Returns (score_0_1, rule, severity)
    Fallback to heuristic if not enough data to fit the model.
    """
    x, extra = _features_from_record(rec, db)
    X = _build_training_matrix(db, limit=200)
    # Need at least 20 samples to fit stable models
    if X.shape[0] < 20:
        return _heuristic_fallback(extra)

    detector = os.getenv("DETECTOR", "iforest").lower()  # iforest | lof | hybrid
    try:
        thr = float(os.getenv("SCORE_THRESHOLD", "0.6"))
    except Exception:
        thr = 0.6
    try:
        models = _get_or_train_models(X)
        if detector == "iforest":
            s = _score_iforest(x, models)
            rule = "ml_iforest_anomaly" if s >= thr else None
        elif detector == "lof":
            s = _score_lof(x, models)
            rule = "ml_lof_anomaly" if s >= thr else None
        else:  # hybrid
            s_if = _score_iforest(x, models)
            s_lof = _score_lof(x, models)
            s = max(s_if, s_lof)
            rule = ("ml_iforest_anomaly" if s == s_if else "ml_lof_anomaly") if s >= thr else None
        severity = "high" if s >= 0.8 else ("medium" if s >= 0.5 else "low")
        return float(s), rule, severity
    except Exception:
        return _heuristic_fallback(extra)
