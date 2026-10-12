"""Confidence-based prediction routing and cached transaction classification."""

from __future__ import annotations

from typing import Any

import pandas as pd

from MLproject.features import prepare_features
from MLproject.jaccard_cache import JaccardCache

AUTO_CATEGORIZE_THRESHOLD = 0.85
SOFT_SUGGEST_THRESHOLD = 0.70


def route_prediction(category: str, confidence: float) -> dict[str, Any]:
    """Map a classifier confidence to the required user-review action."""
    if not 0.0 <= confidence <= 1.0:
        raise ValueError("confidence must be between 0 and 1")

    if confidence >= AUTO_CATEGORIZE_THRESHOLD:
        action = "auto_categorize"
    elif confidence >= SOFT_SUGGEST_THRESHOLD:
        action = "soft_suggest"
    else:
        action = "unverified"
    return {
        "category": category,
        "confidence": confidence,
        "action": action,
    }


def classify_transaction(
    model: Any,
    transaction: dict[str, Any],
    cache: JaccardCache[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Classify one transaction, reusing sufficiently similar cached results.

    Cache keys include the amount band and day-of-month as well as normalized
    text so a text match cannot silently reuse a prediction made with different
    non-text model features.
    """
    features = prepare_features([transaction])
    row = features.iloc[0]
    cache_key = (
        f"{row['text']} amount_{row['amount_range']} day_{int(row['day_of_month'])}"
    )
    if cache is not None:
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return {**cached_result, "cache_hit": True}

    probabilities = model.predict_proba(features)[0]
    best_index = int(probabilities.argmax())
    category = str(model.classes_[best_index])
    result = route_prediction(category, float(probabilities[best_index]))
    result["cache_hit"] = False
    if cache is not None:
        cache.set(cache_key, result)
    return result
