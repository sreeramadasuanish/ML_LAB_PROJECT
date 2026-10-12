"""Generate synthetic UPI transaction data for development and testing."""

from __future__ import annotations

import argparse
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

CATEGORY_MERCHANTS = {
    "Food & Dining": ("SWIGGY", "ZOMATO", "CAFE", "RESTAURANT"),
    "Transport": ("UBER", "OLA", "METRO", "IRCTC"),
    "Shopping": ("AMAZON", "FLIPKART", "MYNTRA", "STORE"),
    "Bills": ("JIO", "AIRTEL", "ELECTRICITY", "GAS"),
    "Entertainment": ("NETFLIX", "SPOTIFY", "BOOKMYSHOW", "CINEMA"),
    "Transfer": ("RAHUL", "PRIYA", "RENT", "FAMILY", "PAYTM", "PHONEPE"),
    "Health": ("APOLLO", "PHARMACY", "MEDPLUS", "HOSPITAL"),
}

DESCRIPTORS = (
    "ORDER",
    "SUBSCRIPTION",
    "RECHARGE",
    "TRIP",
    "COFFEE",
    "MEDICINE",
    "BILL",
)
CATEGORY_DESCRIPTORS = {
    "Food & Dining": ("COFFEE", "ORDER"),
    "Transport": ("TRIP", "ORDER"),
    "Shopping": ("ORDER",),
    "Bills": ("RECHARGE", "BILL"),
    "Entertainment": ("SUBSCRIPTION", "BILL"),
    "Transfer": ("P2P", "TRANSFER", "BILL"),
    "Health": ("MEDICINE", "BILL"),
}
HANDLES = ("paytm@ybl", "okaxis", "oksbi", "ibl", "phonepe@ybl", "gpay")
AMOUNT_RANGES = {
    "Food & Dining": (20, 30_000),
    "Transport": (20, 30_000),
    "Shopping": (20, 40_000),
    "Bills": (20, 30_000),
    "Entertainment": (20, 30_000),
    "Transfer": (20, 50_000),
    "Health": (20, 35_000),
}
AMOUNT_ANCHORS = (100, 650, 3_000, 12_000)


def generate_synthetic_transactions(
    n_samples: int = 600,
    random_state: int = 42,
) -> pd.DataFrame:
    """Create balanced synthetic records; no real transaction data is used."""
    if n_samples < len(CATEGORY_MERCHANTS) * 2:
        raise ValueError(
            f"n_samples must be at least {len(CATEGORY_MERCHANTS) * 2} "
            "to include every category in the training and holdout sets"
        )

    rng = random.Random(random_state)
    categories = list(CATEGORY_MERCHANTS)
    start_date = date(2025, 1, 1)
    rows: list[dict[str, object]] = []

    for index in range(n_samples):
        category = categories[index % len(categories)]
        merchant = rng.choice(CATEGORY_MERCHANTS[category])
        day_offset = rng.randrange(365)
        transaction_date = start_date + timedelta(days=day_offset)
        transaction_id = rng.randrange(10**10, 10**12)
        handle = rng.choice(HANDLES)
        category_descriptors = CATEGORY_DESCRIPTORS[category]
        descriptor = (
            rng.choice(DESCRIPTORS)
            if rng.random() < 0.2
            else rng.choice(category_descriptors)
        )
        format_id = rng.randrange(5)
        if format_id == 0:
            description = f"UPI-{merchant}-{descriptor}-{transaction_id}-{handle}"
        elif format_id == 1:
            description = f"{descriptor}-{transaction_id}-{merchant}-{handle}"
        elif format_id == 2:
            description = f"{merchant}-{transaction_id}-{descriptor}-{handle}"
        elif format_id == 3:
            description = f"UPI-{descriptor}-{merchant}-{transaction_id}-{handle}"
        else:
            description = f"{transaction_id} {descriptor} {merchant} {handle}"

        low, high = AMOUNT_RANGES[category]
        if rng.random() < 0.35:
            amount = float(rng.choice(AMOUNT_ANCHORS))
        else:
            amount = round(rng.uniform(low, high), 2)

        # Amazon Pay and P2P wallet activity can be purchases or transfers.
        is_ambiguous_wallet = merchant in {"PAYTM", "PHONEPE"}
        is_ambiguous_amazon = merchant == "AMAZON" and descriptor == "BILL"
        if is_ambiguous_wallet and rng.random() < 0.2:
            category = rng.choice(("Bills", "Shopping"))
            description = f"{merchant}-P2P-{transaction_id}-{handle}"
        elif is_ambiguous_amazon and rng.random() < 0.3:
            category = "Transfer"
            description = f"AMAZON-PAY-TRANSFER-{transaction_id}-{handle}"

        # Simulate imperfect legacy/imported labels without making text or
        # amount a deterministic proxy for the target category.
        if rng.random() < 0.07:
            category = rng.choice([label for label in categories if label != category])

        rows.append(
            {
                "transaction_id": f"SYN-{index + 1:06d}",
                "description": description,
                "amount": amount,
                "date": transaction_date.isoformat(),
                "category": category,
            }
        )

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=600)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("MLproject/data/synthetic_transactions.csv"),
    )
    args = parser.parse_args()

    transactions = generate_synthetic_transactions(args.samples, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    transactions.to_csv(args.output, index=False)
    print(f"Generated {len(transactions)} synthetic transactions at {args.output}")


if __name__ == "__main__":
    main()
