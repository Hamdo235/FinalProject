from __future__ import annotations
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
import json
import math
import os

from sqlmodel import select
from sqlalchemy.orm import Session
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
import numpy as np

from ..models.alert import Alert

# Simple feature extraction for SSH-like records
# Features: [is_ssh, is_fail, hour_sin, hour_cos, ip_fail_count_60m]

def _features_from_record(rec: Dict[str, Any], db: Session) -> Tuple[np.ndarray, Dict[str, Any]]:
    now = datetime.utcnow()
    source = str(rec.get("source", "unknown")).lower()
    is_ssh = 1.0 if source == "ssh" else 0.0
    status = str(rec.get("status", "")).lower()
    is_fail = 1.0 if status == "fail" else 0.0
    ts = rec.get("ts")
    try:
        ts_dt = datetime.fromisoformat(ts) if ts else now
    except Exception:
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
            except Exception:
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
    # Use last N alerts as background data
    stmt = select(Alert).order_by(Alert.ts.desc()).limit(limit)
    rows = db.exec(stmt).all()
    X: List[np.ndarray] = []
    for a in rows:
        try:
            rec = json.loads(a.features_json or "{}")
        except Exception:
            rec = {}
        x, _ = _features_from_record(rec, db)
        X.append(x)
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


def _score_iforest(x: np.ndarray, X: np.ndarray) -> float:
    clf = IsolationForest(contamination="auto", random_state=42, n_estimators=100)
    clf.fit(X)
    df = clf.decision_function([x])[0]
    k = 4.0
    prob_normal = 1.0 / (1.0 + math.exp(-k * df))
    return float(1.0 - prob_normal)


def _score_lof(x: np.ndarray, X: np.ndarray) -> float:
    # LocalOutlierFactor only computes scores for the fit data by default.
    # Workaround: fit on background, then compute kneighbors and derive a relative score for x
    # Simpler approach: fit LOF on background + x and read the last score_ (approximation)
    try:
        X_aug = np.vstack([X, x.reshape(1, -1)])
        lof = LocalOutlierFactor(n_neighbors=min(20, max(5, len(X_aug) // 10)), novelty=False)
        scores = -lof.fit_predict(X_aug), lof.negative_outlier_factor_
        # negative_outlier_factor_: the lower, the more abnormal; map to 0..1
        nof = lof.negative_outlier_factor_
        val = float(nof[-1])  # value for x
        # Normalize using min/max of the batch
        vmin = float(nof.min())
        vmax = float(nof.max())
        if vmax - vmin < 1e-9:
            return 0.5
        norm = (val - vmin) / (vmax - vmin)  # 0 (most abnormal) .. 1 (most normal)
        return float(1.0 - norm)
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
        if detector == "iforest":
            s = _score_iforest(x, X)
            rule = "ml_iforest_anomaly" if s >= thr else None
        elif detector == "lof":
            s = _score_lof(x, X)
            rule = "ml_lof_anomaly" if s >= thr else None
        else:  # hybrid
            s_if = _score_iforest(x, X)
            s_lof = _score_lof(x, X)
            s = max(s_if, s_lof)
            rule = ("ml_iforest_anomaly" if s == s_if else "ml_lof_anomaly") if s >= thr else None
        severity = "high" if s >= 0.8 else ("medium" if s >= 0.5 else "low")
        return float(s), rule, severity
    except Exception:
        return _heuristic_fallback(extra)
