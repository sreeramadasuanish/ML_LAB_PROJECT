"""Isolation Forest baseline for unusual transaction-spend detection."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import pandas as pd
from sklearn.ensemble import IsolationForest


def _anomaly_features(
    transactions: Iterable[Mapping[str, Any]] | pd.DataFrame,
) -> pd.DataFrame:
    frame = pd.DataFrame(transactions).copy()
    missing = {"amount", "date"} - set(frame.columns)
    if missing:
        raise ValueError(f"Missing anomaly feature columns: {sorted(missing)}")
    if frame.empty:
        raise ValueError("At least one transaction is required")
    amount = pd.to_numeric(frame["amount"], errors="raise")
    if (amount < 0).any():
        raise ValueError("transaction amounts must be non-negative")
    dates = pd.to_datetime(frame["date"], errors="raise")
    return pd.DataFrame(
        {
            "amount": amount,
            "day_of_month": dates.dt.day.astype(float),
        },
        index=frame.index,
    )


def fit_anomaly_detector(
    transactions: Iterable[Mapping[str, Any]] | pd.DataFrame,
    contamination: float = 0.05,
    random_state: int = 42,
) -> IsolationForest:
    """Fit a global spend detector; category-specific baselines are not used."""
    if not 0.0 < contamination <= 0.5:
        raise ValueError("contamination must be in (0, 0.5]")
    features = _anomaly_features(transactions)
    if len(features) < 2:
        raise ValueError("At least two transactions are required to fit")
    detector = IsolationForest(
        contamination=contamination,
        random_state=random_state,
    )
    detector.fit(features)
    return detector


def score_anomalies(
    detector: IsolationForest,
    transactions: Iterable[Mapping[str, Any]] | pd.DataFrame,
) -> pd.DataFrame:
    """Return original transaction columns with anomaly flag and score."""
    frame = pd.DataFrame(transactions).copy()
    features = _anomaly_features(frame)
    frame["is_anomaly"] = detector.predict(features) == -1
    frame["anomaly_score"] = -detector.score_samples(features)
    return frame
