#!/usr/bin/env python
import os
import json
from pathlib import Path
import numpy as np
from sqlmodel import Session, create_engine, select
from sklearn.metrics import f1_score

from app.models.alert import Alert
from app.models.label import AlertLabel

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
OUTPUT_PATH = Path(os.getenv("MODEL_CONFIG_OUT", "./model_config.json"))


def fetch_labeled_scores(session: Session):
    stmt = select(AlertLabel.alert_id, AlertLabel.label).order_by(
        AlertLabel.alert_id, AlertLabel.noted_at.desc()
    )
    latest = {}
    for aid, lbl in session.exec(stmt).all():
        if aid not in latest:
            latest[aid] = lbl
    X, y = [], []
    for aid, lbl in latest.items():
        a = session.get(Alert, aid)
        if not a:
            continue
        if lbl not in ("true_attack", "false_positive"):
            continue
        X.append(float(a.score))
        y.append(1 if lbl == "true_attack" else 0)
    return np.array(X, dtype=float), np.array(y, dtype=int)


def pick_best_threshold(scores: np.ndarray, y_true: np.ndarray):
    if len(scores) == 0 or len(np.unique(y_true)) < 2:
        return 0.6, None
    candidates = np.unique(np.clip(scores, 0.0, 1.0))
    if len(candidates) > 200:
        candidates = np.linspace(scores.min(), scores.max(), 200)
    best_f1, best_thr = -1.0, 0.6
    for thr in candidates:
        y_pred = (scores >= thr).astype(int)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        if f1 > best_f1:
            best_f1, best_thr = f1, float(thr)
    return best_thr, best_f1


def main():
    engine = create_engine(DB_URL)
    with Session(engine) as s:
        scores, y_true = fetch_labeled_scores(s)
    thr, best_f1 = pick_best_threshold(scores, y_true)
    cfg = {
        "score_threshold": float(thr),
        "samples": int(len(scores)),
        "best_f1": None if best_f1 is None else float(best_f1),
    }
    OUTPUT_PATH.write_text(json.dumps(cfg, indent=2))
    print(f"Wrote {OUTPUT_PATH} with score_threshold={thr} using {len(scores)} labeled samples.")
    print("To redeploy safely:")
    print(f"  export SCORE_THRESHOLD={thr}")
    print("  # restart uvicorn or your service")


if __name__ == "__main__":
    main()
