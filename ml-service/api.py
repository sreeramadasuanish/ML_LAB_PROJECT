"""FastAPI application for MoneyMate transaction predictions."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date as Date
from pathlib import Path
from threading import RLock
from typing import AsyncIterator, Literal

from fastapi import FastAPI, HTTPException
import pandas as pd
from pydantic import BaseModel, Field
from sklearn.pipeline import Pipeline

from MLproject.generate_data import generate_synthetic_transactions
from MLproject.jaccard_cache import JaccardCache
from MLproject.preprocess import normalize_description
from MLproject.router import classify_transaction
from MLproject.train import train_model

MODEL_PATH = Path(os.getenv(
    "MODEL_PATH",
    Path(__file__).resolve().parents[1] / "models" / "moneymate_decision_tree.joblib",
))
TRAIN_SAMPLES = int(os.getenv("TRAIN_SAMPLES", "1200"))
_lock = RLock()
_model: Pipeline | None = None
_cache: JaccardCache[dict] = JaccardCache(threshold=0.85)


class TransactionInput(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    amount: float = Field(default=1000, ge=0)
    date: Date = Field(default_factory=Date.today)


class PredictRequest(BaseModel):
    transactions: list[TransactionInput] | None = None
    descriptions: list[str] | None = None


class TrainingTransaction(TransactionInput):
    category: str = Field(min_length=1, max_length=80)


class RetrainRequest(BaseModel):
    transactions: list[TrainingTransaction] | None = None


def _train(transactions: list[dict] | None = None) -> Pipeline:
    training_data = (
        pd.DataFrame(transactions)
        if transactions is not None
        else generate_synthetic_transactions(n_samples=max(TRAIN_SAMPLES, 12))
    )
    model, _ = train_model(training_data, model_path=MODEL_PATH)
    return model


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global _model
    with _lock:
        _model = _train()
    yield


app = FastAPI(title="MoneyMate ML Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    if _model is None:
        raise HTTPException(status_code=503, detail="Model is not ready")
    return {"status": "ok"}


@app.post("/predict")
def predict(request: PredictRequest) -> dict[str, list[dict]]:
    if request.transactions is not None and request.descriptions is not None:
        raise HTTPException(
            status_code=422,
            detail="Provide either transactions or descriptions, not both",
        )

    if request.transactions is not None:
        transactions = [item.model_dump() for item in request.transactions]
    elif request.descriptions is not None:
        transactions = [
            {"description": description, "amount": 1000, "date": Date.today()}
            for description in request.descriptions
        ]
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide a transactions or descriptions array",
        )

    if not transactions:
        raise HTTPException(status_code=422, detail="At least one transaction is required")

    with _lock:
        if _model is None:
            raise HTTPException(status_code=503, detail="Model is not ready")
        predictions = []
        for transaction in transactions:
            result = classify_transaction(_model, transaction, _cache)
            status: Literal["auto", "soft", "unverified"] = {
                "auto_categorize": "auto",
                "soft_suggest": "soft",
                "unverified": "unverified",
            }[result["action"]]
            predictions.append(
                {
                    "category": result["category"],
                    "confidence": result["confidence"],
                    "status": status,
                    "cleaned_description": normalize_description(
                        transaction["description"]
                    ),
                }
            )
        return {"predictions": predictions}


@app.post("/retrain")
def retrain(request: RetrainRequest | None = None) -> dict[str, object]:
    global _model, _cache
    training_data = (
        [item.model_dump() for item in request.transactions]
        if request is not None and request.transactions is not None
        else None
    )
    try:
        with _lock:
            _model = _train(training_data)
            _cache = JaccardCache(threshold=0.85)
            categories = list(_model.classes_)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"status": "retrained", "categories": categories}
