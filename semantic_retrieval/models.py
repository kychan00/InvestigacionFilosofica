from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Document:
    id: str
    title: str
    abstract: str | None = None
    authors: tuple[str, ...] = ()
    year: int | None = None
    topics: tuple[str, ...] = ()
    keywords: tuple[str, ...] = ()
    journal: str | None = None
    language: str | None = None
    doi: str | None = None
    source: str | None = None
    publication_type: str | None = None
    openalex_id: str | None = None
    crossref_id: str | None = None
    url: str | None = None
    original: dict[str, Any] = field(default_factory=dict, compare=False)


@dataclass(frozen=True)
class SearchFilters:
    year_from: int | None = None
    year_to: int | None = None
    author: str | None = None
    languages: tuple[str, ...] = ()
    journal: str | None = None
    sources: tuple[str, ...] = ()
    topic: str | None = None
    publication_types: tuple[str, ...] = ()

    @property
    def active(self) -> bool:
        return any(
            (
                self.year_from is not None,
                self.year_to is not None,
                bool(self.author),
                bool(self.languages),
                bool(self.journal),
                bool(self.sources),
                bool(self.topic),
                bool(self.publication_types),
            )
        )


@dataclass
class SearchResult:
    document: Document
    semantic_score: float | None = None
    lexical_score: float | None = None
    rerank_score: float | None = None

    def to_dict(self) -> dict[str, Any]:
        document = self.document
        return {
            "id": document.id,
            "title": document.title,
            "abstract": document.abstract,
            "authors": list(document.authors),
            "year": document.year,
            "topics": list(document.topics),
            "keywords": list(document.keywords),
            "journal": document.journal,
            "language": document.language,
            "doi": document.doi,
            "source": document.source,
            "publication_type": document.publication_type,
            "openalex_id": document.openalex_id,
            "crossref_id": document.crossref_id,
            "url": document.url,
            "semantic_score": self.semantic_score,
            "lexical_score": self.lexical_score,
            "rerank_score": self.rerank_score,
        }
