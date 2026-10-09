from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from pathlib import Path

from .models import Document


def document_from_row(row: sqlite3.Row) -> Document:
    return Document(
        id=row["id"],
        title=row["title"],
        abstract=row["abstract"],
        authors=tuple(json.loads(row["authors_json"])),
        year=row["year"],
        topics=tuple(json.loads(row["topics_json"])),
        keywords=tuple(json.loads(row["keywords_json"])),
        journal=row["journal"],
        language=row["language"],
        doi=row["doi"],
        source=row["source"],
        publication_type=row["publication_type"],
        openalex_id=row["openalex_id"],
        crossref_id=row["crossref_id"],
        url=row["url"],
        original=json.loads(row["original_json"]),
    )


class DocumentStore:
    def __init__(self, database_path: Path):
        self.connection = sqlite3.connect(
            f"file:{database_path}?mode=ro", uri=True, check_same_thread=False
        )
        self.connection.row_factory = sqlite3.Row

    def close(self) -> None:
        self.connection.close()

    def count(self) -> int:
        return int(
            self.connection.execute("SELECT count(*) FROM documents").fetchone()[0]
        )

    def by_vector_ids(self, vector_ids: Iterable[int]) -> dict[int, Document]:
        ids = [int(value) for value in vector_ids]
        if not ids:
            return {}
        placeholders = ",".join("?" for _ in ids)
        rows = self.connection.execute(
            f"SELECT * FROM documents WHERE vector_id IN ({placeholders})", ids
        ).fetchall()
        return {int(row["vector_id"]): document_from_row(row) for row in rows}

    def by_document_ids(self, ids: Iterable[str]) -> dict[str, Document]:
        values = list(ids)
        if not values:
            return {}
        placeholders = ",".join("?" for _ in values)
        rows = self.connection.execute(
            f"SELECT * FROM documents WHERE id IN ({placeholders})", values
        ).fetchall()
        return {str(row["id"]): document_from_row(row) for row in rows}
