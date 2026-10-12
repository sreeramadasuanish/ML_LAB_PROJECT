"""Small bounded cache for reusing predictions on near-duplicate text."""

from __future__ import annotations

import re
from collections import OrderedDict
from typing import Generic, TypeVar

T = TypeVar("T")
_TOKEN_PATTERN = re.compile(r"<[^>]+>|[a-z0-9]+", re.IGNORECASE)


def jaccard_similarity(left: str, right: str) -> float:
    """Return token-set Jaccard similarity in the inclusive range [0, 1]."""
    left_tokens = set(_TOKEN_PATTERN.findall(left.lower()))
    right_tokens = set(_TOKEN_PATTERN.findall(right.lower()))
    if not left_tokens and not right_tokens:
        return 1.0
    union = left_tokens | right_tokens
    return len(left_tokens & right_tokens) / len(union)


class JaccardCache(Generic[T]):
    """Cache values against the closest text at or above a similarity threshold."""

    def __init__(self, threshold: float = 0.85, max_size: int = 2_000) -> None:
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("threshold must be between 0 and 1")
        if max_size < 1:
            raise ValueError("max_size must be at least 1")
        self.threshold = threshold
        self.max_size = max_size
        self._entries: OrderedDict[str, tuple[set[str], T]] = OrderedDict()

    def get(self, text: str) -> T | None:
        """Return the nearest cached value, or ``None`` if there is no match."""
        tokens = set(_TOKEN_PATTERN.findall(text.lower()))
        best_key: str | None = None
        best_value: T | None = None
        best_similarity = -1.0

        for key, (cached_tokens, value) in self._entries.items():
            union = tokens | cached_tokens
            similarity = (
                len(tokens & cached_tokens) / len(union)
                if union
                else 1.0
            )
            if similarity > best_similarity:
                best_key = key
                best_value = value
                best_similarity = similarity

        if best_key is None or best_similarity < self.threshold:
            return None
        self._entries.move_to_end(best_key)
        return best_value

    def set(self, text: str, value: T) -> None:
        """Insert or replace a text/value pair and evict the least-recent entry."""
        tokens = set(_TOKEN_PATTERN.findall(text.lower()))
        self._entries[text] = (tokens, value)
        self._entries.move_to_end(text)
        while len(self._entries) > self.max_size:
            self._entries.popitem(last=False)

    def __len__(self) -> int:
        return len(self._entries)
