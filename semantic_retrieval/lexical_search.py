from __future__ import annotations

import re

from .documents import normalize_query
from .filters import matches_filters
from .models import SearchFilters, SearchResult
from .storage import DocumentStore

TOKEN = re.compile(r"[\w.-]+", re.UNICODE)


def fts_query(value: str) -> str:
    tokens = [token for token in TOKEN.findall(normalize_query(value)) if token]
    return " OR ".join(
        f'"{token.replace(chr(34), chr(34) * 2)}"' for token in tokens[:20]
    )


class LexicalSearcher:
    def __init__(self, documents: DocumentStore):
        self.documents = documents

    def search(
        self,
        query: str,
        *,
        limit: int,
        filters: SearchFilters | None = None,
    ) -> list[SearchResult]:
        expression = fts_query(query)
        if not expression:
            return []
        filters = filters or SearchFilters()
        requested = min(max(limit * 5, limit), 500)
        rows = self.documents.connection.execute(
            """
            SELECT id, bm25(documents_fts) AS lexical_rank
            FROM documents_fts
            WHERE documents_fts MATCH ?
            ORDER BY lexical_rank
            LIMIT ?
            """,
            (expression, requested),
        ).fetchall()
        by_id = self.documents.by_document_ids(row["id"] for row in rows)
        results = []
        for row in rows:
            document = by_id.get(row["id"])
            if document is None or not matches_filters(document, filters):
                continue
            results.append(
                SearchResult(
                    document=document,
                    lexical_score=-float(row["lexical_rank"]),
                )
            )
            if len(results) >= limit:
                break
        return results
