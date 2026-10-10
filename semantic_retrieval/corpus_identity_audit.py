from __future__ import annotations

import hashlib
import heapq
import sqlite3
import tempfile
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

from semantic_retrieval.result_hygiene import (
    exact_identity_keys,
    metadata_findings,
    normalize_identity_text,
)

ProgressCallback = Callable[[int], None]


class _SparseDisjointSet:
    def __init__(self) -> None:
        self.parent: dict[int, int] = {}

    def find(self, item: int) -> int:
        self.parent.setdefault(item, item)
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


class _StableSample:
    def __init__(self, size: int) -> None:
        self.size = size
        self._heap: list[tuple[int, dict[str, Any]]] = []

    def add(self, key: str, item: dict[str, Any]) -> None:
        if self.size <= 0:
            return
        score = int(hashlib.sha256(key.encode("utf-8")).hexdigest(), 16)
        entry = (-score, item)
        if len(self._heap) < self.size:
            heapq.heappush(self._heap, entry)
        elif entry > self._heap[0]:
            heapq.heapreplace(self._heap, entry)

    def rows(self) -> list[dict[str, Any]]:
        return [item for _, item in sorted(self._heap, reverse=True)]


def _content_and_doi_keys(document: dict[str, Any]) -> tuple[str | None, str | None]:
    doi_key = None
    content_key = None
    for key in exact_identity_keys(document):
        if key.startswith("doi:"):
            doi_key = key.removeprefix("doi:")
        elif key.startswith("content:"):
            content_key = key.removeprefix("content:")
    return doi_key, content_key


def _title_year_key(title: Any, year: Any) -> str | None:
    normalized_title = normalize_identity_text(title)
    if not normalized_title or year in (None, ""):
        return None
    payload = f"{normalized_title}\n{year}".encode()
    return hashlib.sha256(payload).hexdigest()


def _union_duplicate_keys(
    connection: sqlite3.Connection,
    column: str,
    disjoint: _SparseDisjointSet,
) -> None:
    cursor = connection.execute(
        f"SELECT {column}, row_index FROM identity "
        f"WHERE {column} IS NOT NULL ORDER BY {column}, row_index"
    )
    previous_key: str | None = None
    first_member: int | None = None
    member_count = 0
    pending: list[int] = []
    for key, row_index in cursor:
        if key != previous_key:
            if member_count > 1 and first_member is not None:
                for member in pending:
                    disjoint.union(first_member, member)
            previous_key = key
            first_member = row_index
            member_count = 1
            pending = []
        else:
            member_count += 1
            pending.append(row_index)
    if member_count > 1 and first_member is not None:
        for member in pending:
            disjoint.union(first_member, member)


def _chunks(values: list[int], size: int = 400) -> Iterable[list[int]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def audit_corpus_identity(
    database_path: Path,
    *,
    sample_size: int = 25,
    progress: ProgressCallback | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """Audit exact work identities without changing the source database."""

    database_path = database_path.resolve()
    source_uri = f"file:{database_path.as_posix()}?mode=ro&immutable=1"
    finding_counts: Counter[str] = Counter()
    finding_sample = _StableSample(sample_size)
    source_document_count = 0
    source_nonempty_doi_count = 0

    with tempfile.TemporaryDirectory(prefix="corpus-identity-audit-") as temp_dir:
        temp_database = Path(temp_dir) / "identity.sqlite3"
        temp = sqlite3.connect(temp_database)
        temp.execute(
            """
            CREATE TABLE identity (
                row_index INTEGER PRIMARY KEY,
                vector_id INTEGER NOT NULL,
                document_id TEXT NOT NULL UNIQUE,
                doi_key TEXT,
                content_key TEXT,
                title_year_key TEXT
            )
            """
        )
        source = sqlite3.connect(source_uri, uri=True)
        source.row_factory = sqlite3.Row
        cursor = source.execute(
            """
            SELECT vector_id, id, title, abstract, year, doi
            FROM documents
            ORDER BY vector_id
            """
        )
        pending: list[tuple[Any, ...]] = []
        for row_index, row in enumerate(cursor):
            document = dict(row)
            document_id = str(document.get("id") or "").strip()
            if not document_id:
                raise ValueError(f"source row {row_index + 1} lacks id")
            doi_key, content_key = _content_and_doi_keys(document)
            source_nonempty_doi_count += int(doi_key is not None)
            for finding in metadata_findings(document):
                finding_counts[finding["code"]] += 1
                sampled = {
                    "schema_version": "semantic-corpus-finding-sample-v1",
                    "document_id": document_id,
                    "vector_id": int(document["vector_id"]),
                    **finding,
                }
                finding_sample.add(
                    f"{document_id}\n{finding['code']}\n{finding['field']}", sampled
                )
            pending.append(
                (
                    row_index,
                    int(document["vector_id"]),
                    document_id,
                    doi_key,
                    content_key,
                    _title_year_key(document.get("title"), document.get("year")),
                )
            )
            source_document_count += 1
            if len(pending) >= 5_000:
                temp.executemany(
                    "INSERT INTO identity VALUES (?, ?, ?, ?, ?, ?)", pending
                )
                temp.commit()
                pending = []
            if progress and source_document_count % 50_000 == 0:
                progress(source_document_count)
        if pending:
            temp.executemany("INSERT INTO identity VALUES (?, ?, ?, ?, ?, ?)", pending)
            temp.commit()

        temp.execute("CREATE INDEX identity_doi ON identity(doi_key)")
        temp.execute("CREATE INDEX identity_content ON identity(content_key)")
        temp.commit()

        disjoint = _SparseDisjointSet()
        _union_duplicate_keys(temp, "doi_key", disjoint)
        _union_duplicate_keys(temp, "content_key", disjoint)

        components: dict[int, list[int]] = defaultdict(list)
        for row_index in sorted(disjoint.parent):
            components[disjoint.find(row_index)].append(row_index)
        duplicate_components = [
            sorted(members) for members in components.values() if len(members) > 1
        ]

        duplicate_indexes = sorted(
            row_index for members in duplicate_components for row_index in members
        )
        identity_rows: dict[int, dict[str, Any]] = {}
        for batch in _chunks(duplicate_indexes):
            placeholders = ",".join("?" for _ in batch)
            for row in temp.execute(
                "SELECT row_index, vector_id, document_id, doi_key, content_key, "
                f"title_year_key FROM identity WHERE row_index IN ({placeholders})",
                batch,
            ):
                identity_rows[int(row[0])] = {
                    "row_index": int(row[0]),
                    "vector_id": int(row[1]),
                    "id": row[2],
                    "doi_key": row[3],
                    "content_key": row[4],
                    "title_year_key": row[5],
                }

        vector_ids = sorted(row["vector_id"] for row in identity_rows.values())
        source_details: dict[int, dict[str, Any]] = {}
        for batch in _chunks(vector_ids):
            placeholders = ",".join("?" for _ in batch)
            query = (
                "SELECT vector_id, id, title, year, doi, source, openalex_id, "
                f"crossref_id, url FROM documents WHERE vector_id IN ({placeholders})"
            )
            for row in source.execute(query, batch):
                source_details[int(row["vector_id"])] = dict(row)

        groups: list[dict[str, Any]] = []
        for members in duplicate_components:
            rows = [identity_rows[index] for index in members]
            ids = sorted(row["id"] for row in rows)
            group_digest = hashlib.sha256("\n".join(ids).encode("utf-8")).hexdigest()
            doi_counts = Counter(row["doi_key"] for row in rows if row["doi_key"])
            content_counts = Counter(
                row["content_key"] for row in rows if row["content_key"]
            )
            doi_evidence = sorted(key for key, count in doi_counts.items() if count > 1)
            content_evidence = sorted(
                key for key, count in content_counts.items() if count > 1
            )
            title_year_values = {
                row["title_year_key"] for row in rows if row["title_year_key"]
            }
            content_values = {row["content_key"] for row in rows if row["content_key"]}
            doi_conflict = bool(doi_evidence) and (
                len(title_year_values) > 1 or len(content_values) > 1
            )
            if doi_evidence and content_evidence:
                classification = "doi_and_content_exact"
            elif doi_evidence:
                classification = "doi_exact"
            else:
                classification = "content_exact"
            action = (
                "review_only_doi_metadata_conflict"
                if doi_conflict
                else "eligible_for_conservative_collapse"
            )
            member_payload = []
            for row in sorted(rows, key=lambda item: item["vector_id"]):
                details = source_details[row["vector_id"]]
                member_payload.append(
                    {
                        "id": details["id"],
                        "vector_id": details["vector_id"],
                        "title": details["title"],
                        "year": details["year"],
                        "doi": details["doi"],
                        "source": details["source"],
                        "openalex_id": details["openalex_id"],
                        "crossref_id": details["crossref_id"],
                        "url": details["url"],
                    }
                )
            groups.append(
                {
                    "schema_version": "semantic-corpus-duplicate-group-v1",
                    "group_id": group_digest[:20],
                    "classification": classification,
                    "action": action,
                    "member_count": len(rows),
                    "member_ids": ids,
                    "members": member_payload,
                    "evidence": {
                        "doi_keys": doi_evidence,
                        "content_hashes": content_evidence,
                    },
                    "doi_metadata_conflict": doi_conflict,
                }
            )

        groups.sort(key=lambda group: group["group_id"])
        review_sample = groups[:sample_size]
        group_classifications = Counter(group["classification"] for group in groups)
        summary = {
            "schema_version": "semantic-corpus-identity-audit-summary-v1",
            "status": "audit_complete",
            "source_document_count": source_document_count,
            "source_nonempty_doi_count": source_nonempty_doi_count,
            "metadata_finding_count": sum(finding_counts.values()),
            "metadata_finding_counts": dict(sorted(finding_counts.items())),
            "metadata_finding_sample": finding_sample.rows(),
            "exact_duplicate_group_count": len(groups),
            "exact_duplicate_document_count": sum(
                group["member_count"] for group in groups
            ),
            "conservative_collapse_count": sum(
                group["member_count"] - 1
                for group in groups
                if group["action"] == "eligible_for_conservative_collapse"
            ),
            "review_only_group_count": sum(
                group["action"] != "eligible_for_conservative_collapse"
                for group in groups
            ),
            "group_classification_counts": dict(sorted(group_classifications.items())),
            "doi_metadata_conflict_group_count": sum(
                group["doi_metadata_conflict"] for group in groups
            ),
            "maximum_group_size": max(
                (group["member_count"] for group in groups), default=0
            ),
            "review_sample_count": len(review_sample),
            "review_sample_rule": "first_group_id_ascending",
            "source_mutated": False,
            "inference_run": False,
            "human_labels_used": False,
            "scores_or_ranking_modified": False,
            "production_change_authorized": False,
        }
        source.close()
        temp.close()
    return groups, review_sample, summary
