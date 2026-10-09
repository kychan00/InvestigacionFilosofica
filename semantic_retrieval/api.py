from __future__ import annotations

import asyncio
import math
import time
from collections import deque
from contextlib import asynccontextmanager
from functools import lru_cache
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


class SlidingWindowRateLimiter:
    def __init__(self, requests: int, window_seconds: int):
        if requests < 1 or window_seconds < 1:
            raise ValueError("Search rate-limit values must be positive")
        self.requests = requests
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str, *, now: float | None = None) -> tuple[bool, int]:
        current = time.monotonic() if now is None else now
        cutoff = current - self.window_seconds
        with self._lock:
            stale = [
                item_key
                for item_key, events in self._events.items()
                if not events or events[-1] <= cutoff
            ]
            for item_key in stale:
                del self._events[item_key]
            events = self._events.setdefault(key, deque())
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.requests:
                retry_after = max(1, math.ceil(events[0] + self.window_seconds - current))
                return False, retry_after
            events.append(current)
            return True, 0


search_rate_limiter = SlidingWindowRateLimiter(
    settings.search_rate_limit_requests,
    settings.search_rate_limit_window_seconds,
)
search_gate = asyncio.Lock()


def resolve_reranker_enabled(
    server_enabled: bool, requested: bool | None
) -> bool:
    """A request may disable reranking, but cannot enable a disabled server."""
    return server_enabled and requested is not False


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


@app.middleware("http")
async def protect_search(request: Request, call_next):
    if request.method != "POST" or request.url.path not in {
        "/api/search/semantic",
        "/api/search/hybrid",
    }:
        return await call_next(request)
    client = request.client.host if request.client else "unknown"
    allowed, retry_after = search_rate_limiter.allow(client)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Search rate limit exceeded"},
            headers={"Retry-After": str(retry_after)},
        )
    if search_gate.locked():
        return JSONResponse(
            status_code=429,
            content={"detail": "A semantic search is already running"},
            headers={"Retry-After": "5"},
        )
    async with search_gate:
        return await call_next(request)


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
        "reranker_available": settings.enable_reranker,
        "search_limits": {
            "concurrent_requests": 1,
            "requests_per_window": settings.search_rate_limit_requests,
            "window_seconds": settings.search_rate_limit_window_seconds,
        },
    }


def _search(payload: SearchRequest, mode: Literal["semantic", "hybrid"]):
    reranker_enabled = resolve_reranker_enabled(
        settings.enable_reranker, payload.enable_reranker
    )
    try:
        service = get_service()
        filters = payload.filters.to_domain()
        if mode == "semantic":
            results = service.search_semantic(
                payload.query,
                limit=payload.limit,
                filters=filters,
                enable_reranker=reranker_enabled,
            )
        else:
            results = service.search_hybrid(
                payload.query,
                limit=payload.limit,
                filters=filters,
                enable_reranker=reranker_enabled,
            )
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

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
