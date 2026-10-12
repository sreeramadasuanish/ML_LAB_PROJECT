from __future__ import annotations

import numpy as np
import pytest

from MLproject.anomaly import fit_anomaly_detector, score_anomalies
from MLproject.features import prepare_features
from MLproject.generate_data import generate_synthetic_transactions
from MLproject.jaccard_cache import JaccardCache, jaccard_similarity
from MLproject.preprocess import normalize_description
from MLproject.router import classify_transaction, route_prediction
from MLproject.train import train_model


def test_preprocessing_masks_handles_numbers_and_known_names() -> None:
    result = normalize_description(
        "UPI-SWIGGY-9876543210-Rahul-paytm@ybl!",
        known_names=("Rahul",),
    )
    assert result == "upi swiggy <NUM> <NAME> <HANDLE>"


def test_preprocessing_keeps_merchant_names_and_masks_long_ids() -> None:
    assert normalize_description("UPI-SWIGGY-123456789012") == "upi swiggy <NUM>"


def test_jaccard_similarity_and_cache_threshold() -> None:
    assert jaccard_similarity("upi swiggy payment", "upi swiggy payment") == 1.0
    assert jaccard_similarity("upi swiggy", "upi amazon") == pytest.approx(1 / 3)

    cache: JaccardCache[str] = JaccardCache(threshold=0.5)
    cache.set("upi swiggy payment", "Food & Dining")
    assert cache.get("upi swiggy payments") == "Food & Dining"
    assert cache.get("electricity bill") is None


def test_feature_preparation_extracts_amount_band_and_day() -> None:
    features = prepare_features(
        [
            {"description": "UPI-SWIGGY-123456", "amount": amount, "date": "2025-06-17"}
            for amount in (100, 650, 3_000, 7_000, 12_000)
        ]
    )
    assert features.iloc[0]["text"] == "upi swiggy <NUM>"
    assert features.iloc[1]["amount_range"] == "500_to_1999"
    assert features["amount_range"].nunique() == 5
    assert features["day_of_month"].eq(17.0).all()


@pytest.mark.parametrize(
    ("confidence", "expected"),
    [
        (0.85, "auto_categorize"),
        (0.70, "soft_suggest"),
        (0.6999, "unverified"),
    ],
)
def test_confidence_router_thresholds(confidence: float, expected: str) -> None:
    assert route_prediction("Food & Dining", confidence)["action"] == expected


def test_training_metrics_model_persistence_and_cached_prediction(tmp_path) -> None:
    transactions = generate_synthetic_transactions(n_samples=180)
    model_path = tmp_path / "model.joblib"
    model, metrics = train_model(transactions, model_path=model_path)

    assert model_path.exists()
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert metrics["confusion_matrix"].shape == (7, 7)
    assert 0.0 <= metrics["unverified_percent"] <= 100.0
    assert set(metrics["labels"]) == set(transactions["category"])
    classifier = model.named_steps["classifier"]
    assert classifier.max_depth == 8
    assert classifier.min_samples_leaf == 5
    assert sum(
        bucket["count"] for bucket in metrics["confidence_distribution"].values()
    ) == metrics["test_size"]
    assert sum(metrics["routing_percentages"].values()) == pytest.approx(100.0)

    cache: JaccardCache[dict] = JaccardCache(threshold=0.7)
    transaction = transactions.iloc[0].to_dict()
    first = classify_transaction(model, transaction, cache)
    second = classify_transaction(model, transaction, cache)
    assert first["cache_hit"] is False
    assert second["cache_hit"] is True
    assert second["category"] == first["category"]


def test_default_synthetic_model_keeps_unverified_share_in_target_range() -> None:
    transactions = generate_synthetic_transactions(n_samples=1_200, random_state=42)
    _, metrics = train_model(transactions)

    assert 5.0 <= metrics["unverified_percent"] <= 15.0


def test_merchant_category_is_stable_across_amounts_and_description_formats() -> None:
    transactions = generate_synthetic_transactions(n_samples=1_400, random_state=42)
    model, _ = train_model(transactions)
    descriptions = [
        "NETFLIX-SUBSCRIPTION-1234567890-paytm@ybl",
        "UPI-NETFLIX-9876543210-okaxis",
        "SUBSCRIPTION-1122334455-NETFLIX-oksbi",
        "NETFLIX-9988776655-ORDER@ibl",
    ]
    predictions = [
        classify_transaction(
            model,
            {
                "description": descriptions[index],
                "amount": amount,
                "date": "2025-06-10",
            },
        )["category"]
        for index, amount in enumerate((100, 650, 3_000, 12_000))
    ]

    assert predictions == ["Entertainment"] * 4


def test_health_category_is_in_synthetic_training_labels() -> None:
    transactions = generate_synthetic_transactions(n_samples=140, random_state=7)

    assert "Health" in set(transactions["category"])


def test_ambiguous_wallet_merchants_do_not_get_forced_category_hints() -> None:
    features = prepare_features(
        [
            {"description": "AMAZON-PAY-P2P-123456", "amount": 12000, "date": "2025-06-17"},
            {"description": "PAYTM-P2P-123456", "amount": 650, "date": "2025-06-17"},
            {"description": "PHONEPE-P2P-123456", "amount": 3000, "date": "2025-06-17"},
            {"description": "PHARMACY-MEDICINE-123456", "amount": 650, "date": "2025-06-17"},
        ]
    )

    assert features["merchant_category_hint"].tolist() == [
        "unknown", "unknown", "unknown", "Health"
    ]


def test_anomaly_detector_returns_flags_and_scores() -> None:
    transactions = generate_synthetic_transactions(n_samples=60)
    detector = fit_anomaly_detector(transactions)
    scored = score_anomalies(detector, transactions.head(5))

    assert scored["is_anomaly"].dtype == bool
    assert np.isfinite(scored["anomaly_score"]).all()
