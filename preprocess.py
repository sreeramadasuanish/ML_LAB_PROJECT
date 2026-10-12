"""Preprocessing helpers for noisy UPI and bank transaction descriptions."""

from __future__ import annotations

import re
from collections.abc import Iterable

_HANDLE_PATTERN = re.compile(r"\b[a-z0-9._]+@[a-z0-9.-]+\b", re.IGNORECASE)
_INDIAN_PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)")
_LONG_NUMBER_PATTERN = re.compile(r"(?<![a-z0-9])\d{5,}(?![a-z0-9])")
_PUNCTUATION_PATTERN = re.compile(r"[^a-z0-9<>\s]", re.IGNORECASE)
_WHITESPACE_PATTERN = re.compile(r"\s+")


def normalize_description(
    description: str,
    known_names: Iterable[str] = (),
) -> str:
    """Normalize a description and mask handles, Indian phone numbers, and IDs.

    Personal names cannot be identified reliably from arbitrary bank text
    without an entity-recognition model or a known-name list. Names supplied
    through ``known_names`` are therefore masked explicitly; merchant names
    are retained because they are useful classification signals.
    """
    if not isinstance(description, str):
        raise TypeError("description must be a string")

    text = description.lower()
    names = sorted(
        {name.strip().lower() for name in known_names if name.strip()},
        key=len,
        reverse=True,
    )
    for name in names:
        text = re.sub(
            rf"(?<![a-z0-9]){re.escape(name)}(?![a-z0-9])",
            "<NAME>",
            text,
        )

    text = _HANDLE_PATTERN.sub("<HANDLE>", text)
    text = _INDIAN_PHONE_PATTERN.sub("<NUM>", text)
    text = _LONG_NUMBER_PATTERN.sub("<NUM>", text)
    text = _PUNCTUATION_PATTERN.sub(" ", text)
    return _WHITESPACE_PATTERN.sub(" ", text).strip()
