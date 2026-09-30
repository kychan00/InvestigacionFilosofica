from __future__ import annotations

from collections.abc import Sequence
from threading import Lock

from .config import RetrievalSettings
from .models import SearchResult


def rerank_document_text(result: SearchResult) -> str:
    document = result.document
    parts = [f"Title: {document.title}"]
    if document.abstract:
        parts.append(f"Abstract:\n{document.abstract}")
    return "\n\n".join(parts)


class QwenReranker:
    def __init__(self, settings: RetrievalSettings):
        try:
            from sentence_transformers import CrossEncoder
        except ImportError as error:
            raise RuntimeError(
                "Install requirements-semantic-retrieval.txt before loading the reranker."
            ) from error

        self.settings = settings
        self._lock = Lock()
        self.model = CrossEncoder(
            settings.reranker_model,
            revision=settings.reranker_model_revision,
            device=settings.device,
            cache_folder=(
                str(settings.hf_cache_dir) if settings.hf_cache_dir else None
            ),
            prompts={"philosophy": settings.reranker_instruction},
            default_prompt_name="philosophy",
        )

    def rerank(
        self, query: str, results: Sequence[SearchResult], *, limit: int
    ) -> list[SearchResult]:
        if not results:
            return []
        pairs = [(query, rerank_document_text(result)) for result in results]
        with self._lock:
            scores = self.model.predict(
                pairs,
                batch_size=self.settings.reranker_batch_size,
                show_progress_bar=False,
            )
        for result, score in zip(results, scores):
            result.rerank_score = float(score)
        return sorted(
            results,
            key=lambda result: (
                result.rerank_score
                if result.rerank_score is not None
                else float("-inf")
            ),
            reverse=True,
        )[:limit]
