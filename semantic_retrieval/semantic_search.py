from __future__ import annotations

import json

import numpy as np

from .cache import QueryEmbeddingCache
from .config import RetrievalSettings
from .embeddings import EmbeddingBackend, SentenceTransformerEmbeddingBackend
from .faiss_process import FaissSearchProcess
from .filters import matches_filters
from .index_manager import resolve_current_version
from .models import SearchFilters, SearchResult
from .storage import DocumentStore


class SemanticSearcher:
    def __init__(
        self,
        settings: RetrievalSettings,
        *,
        embedding_backend: EmbeddingBackend | None = None,
    ):
        self.settings = settings
        self.embedding_backend = (
            embedding_backend or SentenceTransformerEmbeddingBackend(settings)
        )
        self.version_dir = resolve_current_version(settings.index_dir)
        self.manifest = json.loads(
            (self.version_dir / "manifest.json").read_text(encoding="utf-8")
        )
        contract = self.manifest["embedding_model"]
        expected = (
            self.embedding_backend.model_name,
            self.embedding_backend.model_revision,
            self.embedding_backend.dimension,
        )
        actual = (contract["model"], contract["revision"], contract["dimension"])
        if actual != expected:
            raise RuntimeError(
                "Query embedding model does not match the active FAISS index: "
                f"index={actual}, query={expected}"
            )
        # PyTorch/SentenceTransformers and faiss-cpu can crash the interpreter
        # when both native runtimes execute in one macOS process. The worker is
        # persistent, so isolation costs no model reload per query.
        self.index = FaissSearchProcess(self.version_dir / "semantic.faiss")
        self.documents = DocumentStore(self.version_dir / "documents.sqlite3")
        self.cache = QueryEmbeddingCache(
            ttl_seconds=settings.query_cache_ttl_seconds,
            max_entries=settings.query_cache_max_entries,
        )

    def close(self) -> None:
        self.index.close()
        self.documents.close()

    def _query_embedding(self, query: str) -> np.ndarray:
        key = self.cache.key(
            query,
            model=self.embedding_backend.model_name,
            revision=self.embedding_backend.model_revision,
            instruction=self.settings.retrieval_instruction,
            dimension=self.embedding_backend.dimension,
        )
        cached = self.cache.get(key)
        if cached is not None:
            return cached
        vector = np.asarray(
            self.embedding_backend.encode_query(query), dtype=np.float32
        )
        if vector.shape != (self.embedding_backend.dimension,):
            raise ValueError(f"Unexpected query embedding shape: {vector.shape}")
        self.cache.put(key, vector)
        return vector

    def search(
        self,
        query: str,
        *,
        limit: int | None = None,
        candidates: int | None = None,
        filters: SearchFilters | None = None,
    ) -> list[SearchResult]:
        query = query.strip()
        if not query:
            raise ValueError("query must not be empty")
        filters = filters or SearchFilters()
        limit = max(1, min(int(limit or self.settings.rerank_results), 100))
        candidate_count = max(limit, int(candidates or self.settings.search_candidates))
        requested = candidate_count
        if filters.active:
            requested *= max(1, self.settings.filter_oversample)
        requested = min(requested, self.documents.count())

        query_vector = self._query_embedding(query).reshape(1, -1)
        scores, vector_ids = self.index.search(query_vector, requested)
        valid_pairs = [
            (int(vector_id), float(score))
            for vector_id, score in zip(vector_ids[0], scores[0])
            if int(vector_id) >= 0
        ]
        documents = self.documents.by_vector_ids(
            vector_id for vector_id, _ in valid_pairs
        )
        results = []
        for vector_id, score in valid_pairs:
            document = documents.get(vector_id)
            if document is None or not matches_filters(document, filters):
                continue
            results.append(SearchResult(document=document, semantic_score=score))
            if len(results) >= candidate_count:
                break
        return results
