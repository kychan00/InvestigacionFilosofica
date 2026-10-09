from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock

import numpy as np

from .documents import normalize_query


class QueryEmbeddingCache:
    def __init__(self, *, ttl_seconds: int, max_entries: int):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._values: OrderedDict[str, tuple[float, np.ndarray]] = OrderedDict()
        self._lock = Lock()

    @staticmethod
    def key(
        query: str,
        *,
        model: str,
        revision: str,
        instruction: str,
        dimension: int,
    ) -> str:
        return "\x1f".join(
            (
                normalize_query(query),
                model,
                revision,
                normalize_query(instruction),
                str(dimension),
            )
        )

    def get(self, key: str) -> np.ndarray | None:
        now = time.monotonic()
        with self._lock:
            item = self._values.get(key)
            if item is None:
                return None
            created_at, value = item
            if now - created_at > self.ttl_seconds:
                del self._values[key]
                return None
            self._values.move_to_end(key)
            return value.copy()

    def put(self, key: str, value: np.ndarray) -> None:
        with self._lock:
            self._values[key] = (time.monotonic(), value.copy())
            self._values.move_to_end(key)
            while len(self._values) > self.max_entries:
                self._values.popitem(last=False)
