from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import api


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "MODEL_PATH", tmp_path / "model.joblib")
    with TestClient(api.app) as test_client:
        yield test_client


def test_predict_accepts_transaction_batch(client: TestClient) -> None:
    response = client.post(
        "/predict",
        json={
            "transactions": [
                {
                    "description": "UPI-SWIGGY-987654321012-paytm@ybl",
                    "amount": 450,
                    "date": "2025-07-12",
                }
            ]
        },
    )

    assert response.status_code == 200
    prediction = response.json()["predictions"][0]
    assert prediction["category"]
    assert prediction["status"] in {"auto", "soft", "unverified"}
    assert 0 <= prediction["confidence"] <= 1
    assert prediction["cleaned_description"] == "upi swiggy <NUM> <HANDLE>"


def test_predict_rejects_missing_batch(client: TestClient) -> None:
    response = client.post("/predict", json={})

    assert response.status_code == 422


def test_retrain_rejects_insufficient_labeled_records(client: TestClient) -> None:
    response = client.post(
        "/retrain",
        json={
            "transactions": [
                {
                    "description": "single record",
                    "amount": 1,
                    "date": "2025-01-01",
                    "category": "Other",
                }
            ]
        },
    )

    assert response.status_code == 422
