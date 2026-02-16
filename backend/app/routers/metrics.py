from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlmodel import select
from sqlalchemy import func
from typing import List, Tuple
import numpy as np
from sklearn.metrics import roc_auc_score, precision_recall_fscore_support
import os

from ..db.session import get_session
from ..models.alert import Alert
from ..models.label import AlertLabel

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _load_threshold() -> float:
    t = os.getenv("SCORE_THRESHOLD", "0.6")
    try:
        return float(t)
    except Exception:
        return 0.6


@router.get("/model")
def model_metrics(db: Session = Depends(get_session)):
    # latest label per alert (stable)
    subq = (
        select(AlertLabel.alert_id, func.max(AlertLabel.noted_at).label("max_noted_at"))
        .group_by(AlertLabel.alert_id)
        .subquery()
    )
    stmt = (
        select(AlertLabel.alert_id, AlertLabel.label)
        .join(
            subq,
            (AlertLabel.alert_id == subq.c.alert_id)
            & (AlertLabel.noted_at == subq.c.max_noted_at),
        )
    )
    rows = db.exec(stmt).all()
    if not rows:
        return {"samples": 0, "message": "No labeled alerts yet"}

    pairs: List[Tuple[float, int]] = []
    for aid, lbl in rows:
        a = db.get(Alert, aid)
        if a is None:
            continue
        if lbl not in ("true_attack", "false_positive"):
            continue
        y = 1 if lbl == "true_attack" else 0
        pairs.append((float(a.score), y))

    if not pairs:
        return {"samples": 0, "message": "No valid pairs"}

    scores = np.array([p[0] for p in pairs], dtype=float)
    y_true = np.array([p[1] for p in pairs], dtype=int)

    roc = None
    try:
        if len(np.unique(y_true)) == 2:
            roc = float(roc_auc_score(y_true, scores))
    except Exception:
        roc = None

    thr = _load_threshold()
    y_pred = (scores >= thr).astype(int)

    prec, rec, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    return {
        "samples": int(len(scores)),
        "threshold": float(thr),
        "roc_auc": roc,
        "precision": float(prec),
        "recall": float(rec),
        "f1": float(f1),
        "positives": int(y_true.sum()),
        "negatives": int((1 - y_true).sum()),
    }
