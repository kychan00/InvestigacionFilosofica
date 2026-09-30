from __future__ import annotations

from .documents import normalize_query
from .models import Document, SearchFilters


def _contains(value: str | None, expected: str) -> bool:
    return normalize_query(expected) in normalize_query(value or "")


def matches_filters(document: Document, filters: SearchFilters) -> bool:
    if filters.year_from is not None and (
        document.year is None or document.year < filters.year_from
    ):
        return False
    if filters.year_to is not None and (
        document.year is None or document.year > filters.year_to
    ):
        return False
    if filters.author and not any(
        _contains(author, filters.author) for author in document.authors
    ):
        return False
    if filters.languages and normalize_query(document.language or "") not in {
        normalize_query(value) for value in filters.languages
    }:
        return False
    if filters.journal and not _contains(document.journal, filters.journal):
        return False
    if filters.sources and normalize_query(document.source or "") not in {
        normalize_query(value) for value in filters.sources
    }:
        return False
    if filters.topic:
        topic_values = (*document.topics, *document.keywords)
        if not any(_contains(value, filters.topic) for value in topic_values):
            return False
    if not filters.publication_types:
        return True
    return normalize_query(document.publication_type or "") in {
        normalize_query(value) for value in filters.publication_types
    }
