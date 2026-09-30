from __future__ import annotations

from .config import RetrievalSettings
from .lexical_search import LexicalSearcher
from .models import SearchFilters, SearchResult
from .reranker import QwenReranker
from .semantic_search import SemanticSearcher


class HybridSearcher:
    def __init__(
        self,
        settings: RetrievalSettings,
        *,
        semantic: SemanticSearcher | None = None,
        reranker: QwenReranker | None = None,
    ):
        self.settings = settings
        self.semantic = semantic or SemanticSearcher(settings)
        self.lexical = LexicalSearcher(self.semantic.documents)
        self._reranker = reranker

    @property
    def reranker(self) -> QwenReranker:
        if self._reranker is None:
            self._reranker = QwenReranker(self.settings)
        return self._reranker

    def search(
        self,
        query: str,
        *,
        limit: int | None = None,
        filters: SearchFilters | None = None,
        include_lexical: bool = True,
        enable_reranker: bool | None = None,
    ) -> list[SearchResult]:
        limit = max(1, min(int(limit or self.settings.rerank_results), 100))
        candidate_count = max(limit, self.settings.search_candidates)
        semantic = self.semantic.search(
            query,
            limit=candidate_count,
            candidates=candidate_count,
            filters=filters,
        )
        lexical = (
            self.lexical.search(query, limit=candidate_count, filters=filters)
            if include_lexical
            else []
        )

        combined: dict[str, SearchResult] = {}
        order: list[str] = []
        for item in (*semantic, *lexical):
            existing = combined.get(item.document.id)
            if existing is None:
                combined[item.document.id] = item
                order.append(item.document.id)
                continue
            if item.semantic_score is not None:
                existing.semantic_score = item.semantic_score
            if item.lexical_score is not None:
                existing.lexical_score = item.lexical_score

        candidates = [combined[document_id] for document_id in order]
        should_rerank = (
            self.settings.enable_reranker
            if enable_reranker is None
            else enable_reranker
        )
        if should_rerank:
            return self.reranker.rerank(query, candidates, limit=limit)
        return candidates[:limit]
