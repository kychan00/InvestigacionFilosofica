from __future__ import annotations

from .config import RetrievalSettings
from .hybrid_search import HybridSearcher
from .models import SearchFilters, SearchResult
from .reranker import QwenReranker
from .semantic_search import SemanticSearcher


class RetrievalService:
    def __init__(
        self,
        settings: RetrievalSettings,
        *,
        semantic: SemanticSearcher | None = None,
        reranker: QwenReranker | None = None,
    ):
        self.settings = settings
        self.semantic = semantic or SemanticSearcher(settings)
        self._reranker = reranker
        self.hybrid = HybridSearcher(
            settings,
            semantic=self.semantic,
            reranker=reranker,
        )

    @property
    def reranker(self) -> QwenReranker:
        if self._reranker is None:
            self._reranker = QwenReranker(self.settings)
            self.hybrid._reranker = self._reranker
        return self._reranker

    def search_semantic(
        self,
        query: str,
        *,
        limit: int | None = None,
        filters: SearchFilters | None = None,
        enable_reranker: bool | None = None,
    ) -> list[SearchResult]:
        limit = max(1, min(int(limit or self.settings.rerank_results), 100))
        candidates = self.semantic.search(
            query,
            limit=limit,
            candidates=self.settings.search_candidates,
            filters=filters,
        )
        should_rerank = (
            self.settings.enable_reranker
            if enable_reranker is None
            else enable_reranker
        )
        if should_rerank:
            return self.reranker.rerank(query, candidates, limit=limit)
        return candidates[:limit]

    def search_hybrid(
        self,
        query: str,
        *,
        limit: int | None = None,
        filters: SearchFilters | None = None,
        enable_reranker: bool | None = None,
    ) -> list[SearchResult]:
        return self.hybrid.search(
            query,
            limit=limit,
            filters=filters,
            include_lexical=True,
            enable_reranker=enable_reranker,
        )

    def close(self) -> None:
        self.semantic.close()
