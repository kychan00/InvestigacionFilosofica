from __future__ import annotations

from collections.abc import Sequence
from threading import Lock
from typing import Protocol

import numpy as np

from .config import RetrievalSettings


class EmbeddingBackend(Protocol):
    model_name: str
    model_revision: str
    dimension: int

    def encode_documents(self, texts: Sequence[str]) -> np.ndarray: ...

    def encode_query(self, query: str) -> np.ndarray: ...


def normalize_vectors(values: np.ndarray) -> np.ndarray:
    vectors = np.asarray(values, dtype=np.float32)
    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return np.ascontiguousarray(vectors / norms, dtype=np.float32)


class SentenceTransformerEmbeddingBackend:
    def __init__(self, settings: RetrievalSettings):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as error:
            raise RuntimeError(
                "Install requirements-semantic-retrieval.txt before loading Qwen3."
            ) from error

        self.settings = settings
        self.model_name = settings.embedding_model
        self.model_revision = settings.embedding_model_revision
        self.dimension = settings.embedding_dimension
        self._lock = Lock()
        self.model = SentenceTransformer(
            self.model_name,
            revision=self.model_revision,
            device=settings.device,
            cache_folder=(
                str(settings.hf_cache_dir) if settings.hf_cache_dir else None
            ),
        )
        self.model.tokenizer.padding_side = "left"

    def _truncate(self, vectors: np.ndarray) -> np.ndarray:
        if vectors.shape[1] < self.dimension:
            raise ValueError(
                f"Model returned {vectors.shape[1]} dimensions; "
                f"{self.dimension} were configured."
            )
        return normalize_vectors(vectors[:, : self.dimension])

    def encode_documents(self, texts: Sequence[str]) -> np.ndarray:
        with self._lock:
            vectors = self.model.encode(
                list(texts),
                batch_size=self.settings.embedding_batch_size,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        return self._truncate(np.asarray(vectors, dtype=np.float32))

    def encode_query(self, query: str) -> np.ndarray:
        prompt = f"Instruct: {self.settings.retrieval_instruction.strip()}\nQuery:"
        with self._lock:
            vectors = self.model.encode(
                [query],
                prompt=prompt,
                batch_size=1,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        return self._truncate(np.asarray(vectors, dtype=np.float32))[0]
