from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path

DEFAULT_RETRIEVAL_INSTRUCTION = (
    "Retrieve academic works that are philosophically relevant to the query. "
    "Prioritize documents that directly discuss the concepts, philosophers, "
    "arguments, problems or traditions expressed in the query."
)

DEFAULT_RERANK_INSTRUCTION = (
    "Judge whether the academic document is philosophically relevant to the "
    "query. Prioritize direct discussion of the requested concepts, "
    "philosophers, arguments, problems or traditions."
)


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class RetrievalSettings:
    dataset_repo: str = "CristianPelayo/openalex-philosophy"
    dataset_revision: str = "1c59478b679f5836ef6e8dce28b2d725d04f8e02"
    dataset_file: str = "v3.3/philosophy-corpus-v3-3-full.parquet"

    embedding_model: str = "Qwen/Qwen3-Embedding-0.6B"
    embedding_model_revision: str = "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
    embedding_dimension: int = 1024
    embedding_batch_size: int = 16
    embedding_max_characters: int = 24_000
    retrieval_instruction: str = DEFAULT_RETRIEVAL_INSTRUCTION

    reranker_model: str = "Qwen/Qwen3-Reranker-0.6B"
    reranker_model_revision: str = "e61197ed45024b0ed8a2d74b80b4d909f1255473"
    reranker_instruction: str = DEFAULT_RERANK_INSTRUCTION
    reranker_batch_size: int = 4
    enable_reranker: bool = False
    enable_presentation_hygiene: bool = False

    search_candidates: int = 50
    rerank_results: int = 15
    filter_oversample: int = 8
    query_cache_ttl_seconds: int = 900
    query_cache_max_entries: int = 512
    search_rate_limit_requests: int = 10
    search_rate_limit_window_seconds: int = 600

    artifacts_dir: Path = Path("artifacts/semantic-retrieval")
    hf_cache_dir: Path | None = None
    device: str | None = None
    allowed_origins: tuple[str, ...] = (
        "https://kychan00.github.io",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:4174",
    )

    @property
    def embeddings_dir(self) -> Path:
        return self.artifacts_dir / "embeddings"

    @property
    def index_dir(self) -> Path:
        return self.artifacts_dir / "index"

    def with_artifacts_dir(self, value: Path) -> RetrievalSettings:
        return replace(self, artifacts_dir=value)

    @classmethod
    def from_env(cls) -> RetrievalSettings:
        defaults = cls()
        cache_value = os.getenv("HF_HOME") or os.getenv("HF_HUB_CACHE")
        origins = os.getenv("RETRIEVAL_ALLOWED_ORIGINS")

        return cls(
            dataset_repo=os.getenv("RETRIEVAL_DATASET_REPO", defaults.dataset_repo),
            dataset_revision=os.getenv(
                "RETRIEVAL_DATASET_REVISION", defaults.dataset_revision
            ),
            dataset_file=os.getenv("RETRIEVAL_DATASET_FILE", defaults.dataset_file),
            embedding_model=os.getenv("EMBEDDING_MODEL", defaults.embedding_model),
            embedding_model_revision=os.getenv(
                "EMBEDDING_MODEL_REVISION", defaults.embedding_model_revision
            ),
            embedding_dimension=int(
                os.getenv("EMBEDDING_DIMENSION", defaults.embedding_dimension)
            ),
            embedding_batch_size=int(
                os.getenv("EMBEDDING_BATCH_SIZE", defaults.embedding_batch_size)
            ),
            embedding_max_characters=int(
                os.getenv(
                    "EMBEDDING_MAX_CHARACTERS",
                    defaults.embedding_max_characters,
                )
            ),
            retrieval_instruction=os.getenv(
                "RETRIEVAL_INSTRUCTION", defaults.retrieval_instruction
            ),
            reranker_model=os.getenv("RERANKER_MODEL", defaults.reranker_model),
            reranker_model_revision=os.getenv(
                "RERANKER_MODEL_REVISION", defaults.reranker_model_revision
            ),
            reranker_instruction=os.getenv(
                "RERANKER_INSTRUCTION", defaults.reranker_instruction
            ),
            reranker_batch_size=int(
                os.getenv("RERANKER_BATCH_SIZE", defaults.reranker_batch_size)
            ),
            enable_reranker=_bool_env("ENABLE_RERANKER", defaults.enable_reranker),
            enable_presentation_hygiene=_bool_env(
                "ENABLE_PRESENTATION_HYGIENE",
                defaults.enable_presentation_hygiene,
            ),
            search_candidates=int(
                os.getenv("SEARCH_CANDIDATES", defaults.search_candidates)
            ),
            rerank_results=int(os.getenv("RERANK_RESULTS", defaults.rerank_results)),
            filter_oversample=int(
                os.getenv("FILTER_OVERSAMPLE", defaults.filter_oversample)
            ),
            query_cache_ttl_seconds=int(
                os.getenv("QUERY_CACHE_TTL_SECONDS", defaults.query_cache_ttl_seconds)
            ),
            query_cache_max_entries=int(
                os.getenv("QUERY_CACHE_MAX_ENTRIES", defaults.query_cache_max_entries)
            ),
            search_rate_limit_requests=int(
                os.getenv(
                    "SEARCH_RATE_LIMIT_REQUESTS",
                    defaults.search_rate_limit_requests,
                )
            ),
            search_rate_limit_window_seconds=int(
                os.getenv(
                    "SEARCH_RATE_LIMIT_WINDOW_SECONDS",
                    defaults.search_rate_limit_window_seconds,
                )
            ),
            artifacts_dir=Path(
                os.getenv("RETRIEVAL_ARTIFACTS_DIR", str(defaults.artifacts_dir))
            ),
            hf_cache_dir=Path(cache_value) if cache_value else None,
            device=os.getenv("RETRIEVAL_DEVICE") or None,
            allowed_origins=(
                tuple(item.strip() for item in origins.split(",") if item.strip())
                if origins
                else defaults.allowed_origins
            ),
        )
