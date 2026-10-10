from __future__ import annotations

import hashlib
import html
import re
import unicodedata
from collections import defaultdict
from typing import Any, Iterable, Mapping


HTML_TAG = re.compile(r"</?[A-Za-z][^>]*>")
REPEATED_QUESTION_MARKS = re.compile(r"\?{3,}")
MOJIBAKE_MARKERS = (
    "\ufffd",
    "â€",
    "â€™",
    "â€œ",
    "â€˜",
    "Ã¡",
    "Ã©",
    "Ã­",
    "Ã³",
    "Ãº",
    "Ã£",
    "Ã§",
    "Ã±",
    "Â ",
)


def normalize_identity_text(value: Any) -> str:
    """Normalize text for identity comparison without mutating source metadata."""

    if value is None:
        return ""
    decoded = html.unescape(str(value))
    without_markup = HTML_TAG.sub(" ", decoded)
    normalized = unicodedata.normalize("NFKC", without_markup).casefold()
    alphanumeric = "".join(
        character if character.isalnum() else " " for character in normalized
    )
    return " ".join(alphanumeric.split())


def normalize_doi(value: Any) -> str:
    normalized = str(value or "").strip().casefold()
    for prefix in (
        "https://doi.org/",
        "http://doi.org/",
        "http://dx.doi.org/",
        "doi:",
    ):
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
            break
    return normalized.strip()


def metadata_findings(document: Mapping[str, Any]) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    title = str(document.get("title") or "")
    abstract = str(document.get("abstract") or "")

    if not title.strip():
        findings.append(
            {
                "code": "missing_title",
                "field": "title",
                "action": "preserve_and_flag",
            }
        )

    for field, value in (("title", title), ("abstract", abstract)):
        if value and HTML_TAG.search(value):
            findings.append(
                {
                    "code": "literal_html_markup",
                    "field": field,
                    "action": "sanitize_for_display_only",
                }
            )
        if value and (
            REPEATED_QUESTION_MARKS.search(value)
            or any(marker in value for marker in MOJIBAKE_MARKERS)
        ):
            findings.append(
                {
                    "code": "suspected_mojibake",
                    "field": field,
                    "action": "preserve_and_review_encoding",
                }
            )
    return findings


def exact_identity_keys(document: Mapping[str, Any]) -> tuple[str, ...]:
    keys: list[str] = []
    doi = normalize_doi(document.get("doi"))
    if doi:
        keys.append(f"doi:{doi}")

    title = normalize_identity_text(document.get("title"))
    abstract = normalize_identity_text(document.get("abstract"))
    year = document.get("year")
    if title and abstract and year not in (None, ""):
        payload = f"{title}\n{year}\n{abstract}".encode("utf-8")
        keys.append(f"content:{hashlib.sha256(payload).hexdigest()}")
    return tuple(keys)


def probable_identity_key(document: Mapping[str, Any]) -> str | None:
    title = normalize_identity_text(document.get("title"))
    year = document.get("year")
    if year in (None, "") or len(title) < 8 or len(title.split()) < 2:
        return None
    return f"title-year:{title}|{year}"


class _DisjointSet:
    def __init__(self, size: int):
        self.parent = list(range(size))

    def find(self, item: int) -> int:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def _group_id(query_id: str, group_type: str, members: Iterable[str]) -> str:
    payload = "\n".join((query_id, group_type, *sorted(members)))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


def audit_query_results(
    query_id: str,
    results: list[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    document_ids: list[str] = []
    exact_key_members: dict[str, list[int]] = defaultdict(list)
    probable_key_members: dict[str, list[int]] = defaultdict(list)

    for index, document in enumerate(results):
        document_id = str(document.get("id") or "").strip()
        if not document_id:
            raise ValueError(f"{query_id} result {index + 1} lacks id")
        document_ids.append(document_id)
        for finding in metadata_findings(document):
            findings.append(
                {
                    "schema_version": "semantic-result-hygiene-finding-v1",
                    "query_id": query_id,
                    "rank": index + 1,
                    "document_id": document_id,
                    **finding,
                }
            )
        for key in exact_identity_keys(document):
            exact_key_members[key].append(index)
        probable_key = probable_identity_key(document)
        if probable_key:
            probable_key_members[probable_key].append(index)

    disjoint = _DisjointSet(len(results))
    for members in exact_key_members.values():
        for member in members[1:]:
            disjoint.union(members[0], member)

    exact_components: dict[int, list[int]] = defaultdict(list)
    for index in range(len(results)):
        exact_components[disjoint.find(index)].append(index)

    groups: list[dict[str, Any]] = []
    exact_member_sets: set[frozenset[int]] = set()
    for members in exact_components.values():
        if len(members) < 2:
            continue
        member_set = frozenset(members)
        exact_member_sets.add(member_set)
        ids = [document_ids[index] for index in members]
        groups.append(
            {
                "schema_version": "semantic-result-duplicate-group-v1",
                "group_id": _group_id(query_id, "exact", ids),
                "query_id": query_id,
                "classification": "exact_identity",
                "action": "eligible_for_conservative_collapse",
                "representative_id": ids[0],
                "member_ids": ids,
                "member_ranks": [index + 1 for index in members],
            }
        )

    for members in probable_key_members.values():
        if len(members) < 2 or frozenset(members) in exact_member_sets:
            continue
        ids = [document_ids[index] for index in members]
        groups.append(
            {
                "schema_version": "semantic-result-duplicate-group-v1",
                "group_id": _group_id(query_id, "probable", ids),
                "query_id": query_id,
                "classification": "probable_same_work",
                "action": "review_only_do_not_auto_collapse",
                "representative_id": ids[0],
                "member_ids": ids,
                "member_ranks": [index + 1 for index in members],
            }
        )

    groups.sort(key=lambda item: (item["query_id"], item["member_ranks"][0], item["classification"]))
    return findings, groups


def audit_smoke_rows(
    rows: list[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    groups: list[dict[str, Any]] = []
    result_count = 0

    for row in rows:
        query_id = str(row.get("query_id") or "").strip()
        response = row.get("response")
        if not query_id or not isinstance(response, Mapping):
            raise ValueError("smoke row lacks query_id or response")
        results = response.get("results")
        if not isinstance(results, list):
            raise ValueError(f"{query_id} response lacks results")
        result_count += len(results)
        row_findings, row_groups = audit_query_results(query_id, results)
        findings.extend(row_findings)
        groups.extend(row_groups)

    finding_counts: dict[str, int] = defaultdict(int)
    for finding in findings:
        finding_counts[finding["code"]] += 1
    exact_groups = [
        group for group in groups if group["classification"] == "exact_identity"
    ]
    probable_groups = [
        group
        for group in groups
        if group["classification"] == "probable_same_work"
    ]
    summary = {
        "schema_version": "semantic-result-hygiene-summary-v1",
        "status": "audit_complete",
        "query_count": len(rows),
        "result_count": result_count,
        "finding_count": len(findings),
        "finding_counts": dict(sorted(finding_counts.items())),
        "exact_duplicate_group_count": len(exact_groups),
        "exact_duplicate_document_count": sum(
            len(group["member_ids"]) for group in exact_groups
        ),
        "conservative_collapse_count": sum(
            len(group["member_ids"]) - 1 for group in exact_groups
        ),
        "probable_duplicate_group_count": len(probable_groups),
        "probable_duplicate_document_count": sum(
            len(group["member_ids"]) for group in probable_groups
        ),
        "source_scores_or_order_modified": False,
        "human_labels_used": False,
        "production_change_authorized": False,
    }
    return findings, groups, summary
