"""Train and evaluate the synthetic-data MoneyMate Decision Tree baseline."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from MLproject.features import build_feature_transformer, prepare_features
from MLproject.generate_data import generate_synthetic_transactions
from MLproject.router import route_prediction


def build_model(random_state: int = 42) -> Pipeline:
    """Create the feature extraction and Decision Tree inference pipeline."""
    return Pipeline(
        steps=[
            ("features", build_feature_transformer()),
            (
                "classifier",
                DecisionTreeClassifier(
                    max_depth=8,
                    min_samples_leaf=5,
                    random_state=random_state,
                    class_weight="balanced",
                ),
            ),
        ]
    )


def train_model(
    transactions: pd.DataFrame,
    model_path: str | Path | None = None,
    test_size: float = 0.2,
    random_state: int = 42,
) -> tuple[Pipeline, dict[str, Any]]:
    """Train on an 80/20 stratified split and return holdout metrics."""
    required = {"description", "amount", "date", "category"}
    missing = required - set(transactions.columns)
    if missing:
        raise ValueError(f"Missing training columns: {sorted(missing)}")
    if not 0.0 < test_size < 1.0:
        raise ValueError("test_size must be between 0 and 1")

    labels = transactions["category"].astype(str)
    class_counts = labels.value_counts()
    if len(class_counts) < 2 or class_counts.min() < 2:
        raise ValueError("Each category must have at least two transactions")

    features = prepare_features(transactions)
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=test_size,
        random_state=random_state,
        stratify=labels,
    )
    model = build_model(random_state)
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)
    confidences = probabilities.max(axis=1)
    routed_actions = [
        route_prediction(
            str(model.classes_[int(row.argmax())]),
            float(row.max()),
        )["action"]
        for row in probabilities
    ]
    confidence_bins = {
        "0.00-0.49": confidences < 0.5,
        "0.50-0.69": (confidences >= 0.5) & (confidences < 0.7),
        "0.70-0.84": (confidences >= 0.7) & (confidences < 0.85),
        "0.85-1.00": confidences >= 0.85,
    }
    confidence_distribution = {
        label: {
            "count": int(mask.sum()),
            "percent": float(100.0 * mask.mean()),
        }
        for label, mask in confidence_bins.items()
    }
    routing_percentages = {
        action: float(100.0 * routed_actions.count(action) / len(routed_actions))
        for action in ("auto_categorize", "soft_suggest", "unverified")
    }
    category_labels = sorted(labels.unique())
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "per_class": classification_report(
            y_test,
            predictions,
            labels=category_labels,
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": confusion_matrix(
            y_test,
            predictions,
            labels=category_labels,
        ),
        "labels": category_labels,
        "confidence_distribution": confidence_distribution,
        "routing_percentages": routing_percentages,
        "unverified_percent": routing_percentages["unverified"],
        "test_size": len(y_test),
    }

    if model_path is not None:
        destination = Path(model_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, destination)
    return model, metrics


def print_metrics(metrics: dict[str, Any]) -> None:
    """Print requested holdout metrics in a readable, reproducible format."""
    print(f"Accuracy: {metrics['accuracy']:.4f}")
    print("Per-class precision / recall:")
    for label in metrics["labels"]:
        class_metrics = metrics["per_class"][label]
        print(
            f"  {label}: precision={class_metrics['precision']:.4f}, "
            f"recall={class_metrics['recall']:.4f}"
        )
    print("Confusion matrix (rows=true, columns=predicted):")
    print(pd.DataFrame(
        metrics["confusion_matrix"],
        index=metrics["labels"],
        columns=metrics["labels"],
    ).to_string())
    print(f"Routed to Unverified Queue: {metrics['unverified_percent']:.2f}%")
    print("Held-out confidence distribution:")
    for confidence_range, summary in metrics["confidence_distribution"].items():
        print(
            f"  {confidence_range}: {summary['count']} "
            f"({summary['percent']:.2f}%)"
        )
    print("Held-out routing percentages:")
    for action, percentage in metrics["routing_percentages"].items():
        print(f"  {action}: {percentage:.2f}%")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, help="CSV with description, amount, date, category")
    parser.add_argument("--samples", type=int, default=600)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--model-path",
        type=Path,
        default=Path("MLproject/models/moneymate_decision_tree.joblib"),
    )
    args = parser.parse_args()

    transactions = (
        pd.read_csv(args.data)
        if args.data is not None
        else generate_synthetic_transactions(args.samples, args.seed)
    )
    _, metrics = train_model(transactions, model_path=args.model_path)
    print_metrics(metrics)
    print(f"Saved model: {args.model_path}")


if __name__ == "__main__":
    main()
