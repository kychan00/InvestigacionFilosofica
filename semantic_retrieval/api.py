from __future__ import annotations

from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from .config import RetrievalSettings
from .index_manager import read_current_manifest
from .models import SearchFilters
from .service import RetrievalService


class SearchFiltersRequest(BaseModel):
    year_from: int | None = None
    year_to: int | None = None
    author: str | None = None
    language: str | None = None
    languages: list[str] = Field(default_factory=list)
    journal: str | None = None
    source: str | None = None
    sources: list[str] = Field(default_factory=list)
    topic: str | None = None
    publication_type: str | None = None
    publication_types: list[str] = Field(default_factory=list)

    @field_validator("year_to")
    @classmethod
    def valid_year_range(cls, value: int | None, info):
        start = info.data.get("year_from")
        if value is not None and start is not None and value < start:
            raise ValueError("year_to must be greater than or equal to year_from")
        return value

    def to_domain(self) -> SearchFilters:
        languages = [*self.languages]
        if self.language and self.language not in languages:
            languages.append(self.language)
        sources = [*self.sources]
        if self.source and self.source not in sources:
            sources.append(self.source)
        publication_types = [*self.publication_types]
        if self.publication_type and self.publication_type not in publication_types:
            publication_types.append(self.publication_type)
        return SearchFilters(
            year_from=self.year_from,
            year_to=self.year_to,
            author=self.author,
            languages=tuple(languages),
            journal=self.journal,
            sources=tuple(sources),
            topic=self.topic,
            publication_types=tuple(publication_types),
        )


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    limit: int = Field(default=15, ge=1, le=100)
    filters: SearchFiltersRequest = Field(default_factory=SearchFiltersRequest)
    enable_reranker: bool | None = None


class SearchResponse(BaseModel):
    query: str
    mode: Literal["semantic", "hybrid"]
    candidate_count: int
    reranker_enabled: bool
    results: list[dict]


settings = RetrievalSettings.from_env()


@lru_cache(maxsize=1)
def get_service() -> RetrievalService:
    return RetrievalService(settings)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    if get_service.cache_info().currsize:
        get_service().close()
        get_service.cache_clear()


app = FastAPI(
    title="Investigación Filosófica Semantic Retrieval API",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict:
    try:
        manifest = read_current_manifest(settings)
    except (FileNotFoundError, RuntimeError) as error:
        return {"status": "not_ready", "detail": str(error)}
    return {
        "status": "ready",
        "documents": manifest["document_count"],
        "embedding_model": manifest["embedding_model"],
        "index_build_id": manifest["build_id"],
    }


def _search(payload: SearchRequest, mode: Literal["semantic", "hybrid"]):
    try:
        service = get_service()
        filters = payload.filters.to_domain()
        if mode == "semantic":
            results = service.search_semantic(
                payload.query,
                limit=payload.limit,
                filters=filters,
                enable_reranker=payload.enable_reranker,
            )
        else:
            results = service.search_hybrid(
                payload.query,
                limit=payload.limit,
                filters=filters,
                enable_reranker=payload.enable_reranker,
            )
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    reranker_enabled = (
        settings.enable_reranker
        if payload.enable_reranker is None
        else payload.enable_reranker
    )
    return SearchResponse(
        query=payload.query,
        mode=mode,
        candidate_count=settings.search_candidates,
        reranker_enabled=reranker_enabled,
        results=[result.to_dict() for result in results],
    )


@app.post("/api/search/semantic", response_model=SearchResponse)
def semantic_search(payload: SearchRequest):
    return _search(payload, "semantic")


@app.post("/api/search/hybrid", response_model=SearchResponse)
def hybrid_search(payload: SearchRequest):
    return _search(payload, "hybrid")
