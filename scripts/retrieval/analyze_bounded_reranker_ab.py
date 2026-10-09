#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import tempfile
import unicodedata
from pathlib import Path
from typing import Any


EXPERIMENT_ID = "semantic-reranker-bounded-v1"
AB_SCHEMA = "semantic-reranker-bounded-ab-v1"
BLIND_SCHEMA = "semantic-reranker-bounded-blind-item-v1"
RESULT_SCHEMA = "semantic-reranker-bounded-analysis-v1"
EXPECTED_AB_SHA256 = (
    "2787efeb33c301ea3c83081fafffd3622073f01ad08e9f97f6b43eb0525c276a"
)
EXPECTED_JUDGMENTS_SHA256 = (
    "cc7fbd39d9ace255918d81581f59b1ab96d1c3688ff3e7b5e0e904c1a3f81f0e"
)
EXPECTED_QUERY_COUNT = 5
EXPECTED_JUDGMENT_COUNT = 59
RESULT_LIMIT = 10
RELEVANCE_THRESHOLD = 2
FORBIDDEN_BLIND_FIELDS = {
    "rank",
    "semantic_score",
    "lexical_score",
    "rerank_score",
    "condition",
    "candidate_pool_fingerprint",
}


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_jsonl(file_path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(
        file_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            raise RuntimeError(f"Blank JSONL line at {file_path}:{line_number}")
        value = json.loads(line)
        if not isinstance(value, dict):
            raise RuntimeError(f"JSONL row is not an object at {file_path}:{line_number}")
        rows.append(value)
    return rows


def _blind_item_id(query_id: str, document_id: str) -> str:
    value = f"blind\0{EXPERIMENT_ID}\0{query_id}\0{document_id}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()[:24]


def _clean_document(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key not in FORBIDDEN_BLIND_FIELDS}


def _gain(relevance: int) -> int:
    return (2**relevance) - 1


def dcg(relevances: list[int]) -> float:
    return sum(
        _gain(relevance) / math.log2(rank + 1)
        for rank, relevance in enumerate(relevances, start=1)
    )


def ndcg(relevances: list[int], ideal_relevances: list[int]) -> float:
    ideal = dcg(sorted(ideal_relevances, reverse=True)[: len(relevances)])
    return 0.0 if ideal == 0.0 else dcg(relevances) / ideal


def precision(relevances: list[int]) -> float:
    return sum(value >= RELEVANCE_THRESHOLD for value in relevances) / len(relevances)


def _mean(values: list[float]) -> float | None:
    return None if not values else sum(values) / len(values)


def _rounded(value: float | None) -> float | None:
    return None if value is None else round(value, 12)


def _metric_summary(per_query: list[dict[str, Any]], metric: str) -> dict[str, Any]:
    eligible = [row for row in per_query if row["metrics"][metric]["delta_b_minus_a"] is not None]
    a_values = [row["metrics"][metric]["a"] for row in eligible]
    b_values = [row["metrics"][metric]["b"] for row in eligible]
    deltas = [row["metrics"][metric]["delta_b_minus_a"] for row in eligible]
    return {
        "eligible_queries": len(eligible),
        "macro_a": _rounded(_mean(a_values)),
        "macro_b": _rounded(_mean(b_values)),
        "macro_delta_b_minus_a": _rounded(_mean(deltas)),
    }


def _normalized_doi(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", value.strip().casefold())


def _normalized_title(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(re.findall(r"\w+", normalized, flags=re.UNICODE))


def _duplicate_observations(judgments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    for query_id in sorted({row["query_id"] for row in judgments}):
        query_rows = [row for row in judgments if row["query_id"] == query_id]
        for field, normalizer in (("doi", _normalized_doi), ("title", _normalized_title)):
            groups: dict[str, list[dict[str, Any]]] = {}
            for row in query_rows:
                normalized = normalizer(row["document"].get(field))
                if normalized:
                    groups.setdefault(normalized, []).append(row)
            for normalized, group in sorted(groups.items()):
                document_ids = sorted({row["document"]["id"] for row in group})
                if len(document_ids) > 1:
                    observations.append(
                        {
                            "query_id": query_id,
                            "basis": f"exact_normalized_{field}",
                            "normalized_value": normalized,
                            "document_ids": document_ids,
                        }
                    )
    return observations


def _validate_judgments(
    judgments: list[dict[str, Any]], expected_count: int | None = None
) -> dict[tuple[str, str], dict[str, Any]]:
    if expected_count is not None and len(judgments) != expected_count:
        raise RuntimeError(f"Expected {expected_count} judgments, found {len(judgments)}")
    index: dict[tuple[str, str], dict[str, Any]] = {}
    item_ids: set[str] = set()
    for row in judgments:
        if row.get("schema_version") != BLIND_SCHEMA or row.get("experiment_id") != EXPERIMENT_ID:
            raise RuntimeError("Judgment lineage mismatch")
        document = row.get("document")
        judgment = row.get("judgment")
        if not isinstance(document, dict) or not isinstance(document.get("id"), str):
            raise RuntimeError("Invalid judgment document")
        if not isinstance(judgment, dict) or set(judgment) != {"relevance", "abstain", "note"}:
            raise RuntimeError("Invalid judgment schema")
        if not isinstance(judgment["abstain"], bool):
            raise RuntimeError("Incomplete judgment")
        if judgment["abstain"]:
            if judgment["relevance"] is not None or not isinstance(judgment["note"], str) or not judgment["note"].strip():
                raise RuntimeError("Invalid abstention")
        elif type(judgment["relevance"]) is not int or not 0 <= judgment["relevance"] <= 3:
            raise RuntimeError("Relevance must be an integer from zero to three")
        query_id = row.get("query_id")
        item_id = row.get("item_id")
        if not isinstance(query_id, str) or item_id != _blind_item_id(query_id, document["id"]):
            raise RuntimeError("Judgment item identity mismatch")
        key = (query_id, document["id"])
        if key in index or item_id in item_ids:
            raise RuntimeError("Duplicate judgment")
        index[key] = row
        item_ids.add(item_id)
    return index


def _condition_relevances(
    condition: list[dict[str, Any]],
    judgment_index: dict[tuple[str, str], dict[str, Any]],
    query_id: str,
    limit: int,
) -> list[int] | None:
    values: list[int] = []
    for item in condition[:limit]:
        judgment = judgment_index[(query_id, item["id"])]["judgment"]
        if judgment["abstain"]:
            return None
        values.append(judgment["relevance"])
    return values


def _metric(a: float | None, b: float | None) -> dict[str, float | None]:
    return {
        "a": _rounded(a),
        "b": _rounded(b),
        "delta_b_minus_a": _rounded(None if a is None or b is None else b - a),
    }


def analyze_rows(
    ab_rows: list[dict[str, Any]],
    judgments: list[dict[str, Any]],
    *,
    expected_query_count: int | None = None,
    expected_judgment_count: int | None = None,
) -> dict[str, Any]:
    if expected_query_count is not None and len(ab_rows) != expected_query_count:
        raise RuntimeError(f"Expected {expected_query_count} A/B rows, found {len(ab_rows)}")
    judgment_index = _validate_judgments(judgments, expected_judgment_count)
    seen_queries: set[str] = set()
    expected_keys: set[tuple[str, str]] = set()
    per_query: list[dict[str, Any]] = []

    for row in ab_rows:
        if row.get("schema_version") != AB_SCHEMA or row.get("experiment_id") != EXPERIMENT_ID:
            raise RuntimeError("A/B lineage mismatch")
        query_id = row.get("query_id")
        if not isinstance(query_id, str) or query_id in seen_queries:
            raise RuntimeError("Invalid or duplicate A/B query")
        seen_queries.add(query_id)
        candidate_pool = row.get("candidate_pool")
        condition_a = row.get("condition_a")
        condition_b = row.get("condition_b")
        if not isinstance(candidate_pool, list) or len(candidate_pool) != 12:
            raise RuntimeError("A/B candidate pool must contain 12 documents")
        if not isinstance(condition_a, list) or not isinstance(condition_b, list):
            raise RuntimeError("Missing A/B conditions")
        if len(condition_a) != RESULT_LIMIT or len(condition_b) != RESULT_LIMIT:
            raise RuntimeError("Each A/B condition must contain 10 documents")
        pool_ids = [item.get("id") for item in candidate_pool]
        if len(set(pool_ids)) != 12 or any(not isinstance(value, str) for value in pool_ids):
            raise RuntimeError("Invalid A/B candidate pool IDs")
        for condition in (condition_a, condition_b):
            ids = [item.get("id") for item in condition]
            ranks = [item.get("rank") for item in condition]
            if len(set(ids)) != RESULT_LIMIT or not set(ids).issubset(pool_ids):
                raise RuntimeError("Invalid A/B condition membership")
            if ranks != list(range(1, RESULT_LIMIT + 1)):
                raise RuntimeError("Invalid A/B ranks")

        union_by_id = {item["id"]: item for item in (*condition_a, *condition_b)}
        query_keys = {(query_id, document_id) for document_id in union_by_id}
        expected_keys.update(query_keys)
        for key in query_keys:
            if key not in judgment_index:
                raise RuntimeError(f"Missing blind judgment for {key[0]} / {key[1]}")
            judgment_row = judgment_index[key]
            if judgment_row.get("query") != row.get("query"):
                raise RuntimeError("Query text mismatch between A/B and judgments")
            if judgment_row["document"] != _clean_document(union_by_id[key[1]]):
                raise RuntimeError("Document payload mismatch between A/B and judgments")

        union_judgments = [judgment_index[key] for key in sorted(query_keys)]
        abstentions = sum(item["judgment"]["abstain"] for item in union_judgments)
        a10 = _condition_relevances(condition_a, judgment_index, query_id, 10)
        b10 = _condition_relevances(condition_b, judgment_index, query_id, 10)
        a5 = _condition_relevances(condition_a, judgment_index, query_id, 5)
        b5 = _condition_relevances(condition_b, judgment_index, query_id, 5)
        ideal = None if abstentions else [item["judgment"]["relevance"] for item in union_judgments]
        ndcg_a = None if a10 is None or ideal is None else ndcg(a10, ideal)
        ndcg_b = None if b10 is None or ideal is None else ndcg(b10, ideal)

        ranks_a = {item["id"]: item["rank"] for item in condition_a}
        ranks_b = {item["id"]: item["rank"] for item in condition_b}
        rank_changes = []
        for document_id in sorted(union_by_id):
            judgment = judgment_index[(query_id, document_id)]
            rank_a = ranks_a.get(document_id)
            rank_b = ranks_b.get(document_id)
            rank_changes.append(
                {
                    "document_id": document_id,
                    "title": judgment["document"].get("title"),
                    "relevance": judgment["judgment"]["relevance"],
                    "abstain": judgment["judgment"]["abstain"],
                    "rank_a": rank_a,
                    "rank_b": rank_b,
                    "rank_shift_a_minus_b": None if rank_a is None or rank_b is None else rank_a - rank_b,
                }
            )

        per_query.append(
            {
                "query_id": query_id,
                "query": row.get("query"),
                "union_documents": len(union_by_id),
                "abstentions": abstentions,
                "metrics": {
                    "ndcg_at_10": _metric(ndcg_a, ndcg_b),
                    "precision_at_10": _metric(
                        None if a10 is None else precision(a10),
                        None if b10 is None else precision(b10),
                    ),
                    "precision_at_5": _metric(
                        None if a5 is None else precision(a5),
                        None if b5 is None else precision(b5),
                    ),
                },
                "rank_changes": rank_changes,
            }
        )

    if set(judgment_index) != expected_keys:
        extras = sorted(set(judgment_index) - expected_keys)
        raise RuntimeError(f"Judgment set does not equal A/B Top-10 union; extras={extras[:3]}")

    per_query.sort(key=lambda value: value["query_id"])
    abstention_count = sum(row["judgment"]["abstain"] for row in judgments)
    duplicates = _duplicate_observations(judgments)
    return {
        "schema_version": RESULT_SCHEMA,
        "experiment_id": EXPERIMENT_ID,
        "status": "descriptive_complete",
        "metric_definitions": {
            "ndcg_gain": "2^relevance-1",
            "ndcg_discount": "log2(rank+1)",
            "ndcg_ideal": "top 10 graded judgments from the per-query A/B Top-10 union",
            "binary_relevance_threshold": RELEVANCE_THRESHOLD,
            "abstention_rule": "exclude a query from a metric when an abstention is required by that metric",
        },
        "coverage": {
            "queries": len(ab_rows),
            "blind_union_documents": len(judgments),
            "completed_judgments": len(judgments) - abstention_count,
            "abstentions": abstention_count,
        },
        "aggregate": {
            "primary_ndcg_at_10": _metric_summary(per_query, "ndcg_at_10"),
            "secondary_precision_at_10": _metric_summary(per_query, "precision_at_10"),
            "secondary_precision_at_5": _metric_summary(per_query, "precision_at_5"),
        },
        "per_query": per_query,
        "data_quality": {
            "duplicate_looking_rule": "different document IDs with an exact normalized DOI or exact normalized title within one query union",
            "duplicate_looking_groups": duplicates,
            "duplicate_looking_group_count": len(duplicates),
        },
        "interpretation_limits": {
            "significance_claim": False,
            "production_change_authorized": False,
            "scope": "five-query bounded engineering evaluation",
        },
    }


def _atomic_json(file_path: Path, value: dict[str, Any]) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=file_path.parent, prefix=f".{file_path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, file_path)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze the frozen bounded reranker A/B comparison.")
    parser.add_argument("--ab", type=Path, required=True)
    parser.add_argument("--judgments", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.output.exists():
        raise FileExistsError(f"Refusing to overwrite frozen analysis: {args.output}")
    if sha256_file(args.ab) != EXPECTED_AB_SHA256:
        raise RuntimeError("Frozen A/B SHA-256 mismatch")
    if sha256_file(args.judgments) != EXPECTED_JUDGMENTS_SHA256:
        raise RuntimeError("Frozen judgment SHA-256 mismatch")
    result = analyze_rows(
        load_jsonl(args.ab),
        load_jsonl(args.judgments),
        expected_query_count=EXPECTED_QUERY_COUNT,
        expected_judgment_count=EXPECTED_JUDGMENT_COUNT,
    )
    result["input_hashes"] = {
        "ab_sha256": EXPECTED_AB_SHA256,
        "human_judgments_sha256": EXPECTED_JUDGMENTS_SHA256,
    }
    _atomic_json(args.output, result)
    print(json.dumps({"status": "complete", "output": str(args.output)}, sort_keys=True))


if __name__ == "__main__":
    main()
