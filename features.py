
"""Feature preparation and classifier preprocessing for MoneyMate."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from preprocess import normalize_description

REQUIRED_COLUMNS = {"description", "amount", "date"}

AMOUNT_RANGE_LABELS = (
    "under_500",
    "500_to_1999",
    "2000_to_4999",
    "5000_to_9999",
    "10000_plus",
)

MERCHANT_CATEGORY_HINTS = {
    "swiggy": "Food & Dining",
    "zomato": "Food & Dining",
    "cafe": "Food & Dining",
    "restaurant": "Food & Dining",
    "uber": "Transport",
    "ola": "Transport",
    "metro": "Transport",
    "irctc": "Transport",
    "amazon": "Shopping",
    "flipkart": "Shopping",
    "myntra": "Shopping",
    "store": "Shopping",
    "jio": "Bills",
    "airtel": "Bills",
    "electricity": "Bills",
    "gas": "Bills",
    "netflix": "Entertainment",
    "spotify": "Entertainment",
    "bookmyshow": "Entertainment",
    "cinema": "Entertainment",
    "rahul": "Transfer",
    "priya": "Transfer",
    "rent": "Transfer",
    "family": "Transfer",
    "apollo": "Health",
    "pharmacy": "Health",
    "medplus": "Health",
    "hospital": "Health",
}

MERCHANT_HINT_PATTERN = r"\b(" + "|".join(
    sorted(MERCHANT_CATEGORY_HINTS, key=len, reverse=True)
) + r")\b"


def prepare_features(
        transactions: Iterable[Mapping[str, Any]] | pd.DataFrame,
) -> pd.DataFrame:
    """Build normalized text, amount-band, merchant-hint, and date features."""

    frame = pd.DataFrame(transactions).copy()

    missing_columns = REQUIRED_COLUMNS - set(frame.columns)
    if missing_columns:
        raise ValueError(f"Missing transaction columns: {sorted(missing_columns)}")

    if frame.empty:
        raise ValueError("At least one transaction is required")

    amounts = pd.to_numeric(frame["amount"], errors="raise")

    if (amounts < 0).any():
        raise ValueError("transaction amounts must be non-negative")

    dates = pd.to_datetime(frame["date"], errors="raise")
    normalized_text = frame["description"].map(normalize_description)

    merchant_hints = normalized_text.str.extract(
        MERCHANT_HINT_PATTERN,
        expand=False,
    )

    # Amazon Pay can represent a transfer rather than a shopping purchase.
    amazon_pay_mask = normalized_text.str.contains(
        r"\bamazon[\s-]*pay\b",
        regex=True,
        na=False,
    )
    merchant_hints = merchant_hints.mask(amazon_pay_mask)

    category_hints = merchant_hints.map(MERCHANT_CATEGORY_HINTS)

    amount_ranges = pd.cut(
        amounts,
        bins=[0, 500, 2_000, 5_000, 10_000, float("inf")],
        labels=AMOUNT_RANGE_LABELS,
        right=False,
        include_lowest=True,
    )

    return pd.DataFrame(
        {
            "text": normalized_text,
            "merchant_category_hint": category_hints.fillna("unknown"),
            "amount_range": amount_ranges.astype(str),
            "day_of_month": dates.dt.day.astype(float),
        },
        index=frame.index,
    )


def build_feature_transformer() -> ColumnTransformer:
    """Combine text, merchant hints, amount bands, and scaled day features."""

    return ColumnTransformer(
        transformers=[
            (
                "text_word",
                TfidfVectorizer(ngram_range=(1, 2), min_df=1),
                "text",
            ),
            (
                "text_char",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(2, 4),
                    min_df=1,
                    max_features=20_000,
                ),
                "text",
            ),
            (
                "merchant_category_hint",
                OneHotEncoder(handle_unknown="ignore"),
                ["merchant_category_hint"],
            ),
            (
                "amount_range",
                OneHotEncoder(handle_unknown="ignore"),
                ["amount_range"],
            ),
            (
                "day_of_month",
                StandardScaler(),
                ["day_of_month"],
            ),
        ],
        remainder="drop",
    )
