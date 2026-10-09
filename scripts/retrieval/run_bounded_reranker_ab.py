#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
import sys
import tempfile
import time
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.index_manager import resolve_current_version
from semantic_retrieval.models import SearchResult
from semantic_retrieval.service import RetrievalService

EXPERIMENT_ID = "semantic-reranker-bounded-v1"
AB_SCHEMA = "semantic-reranker-bounded-ab-v1"
BLIND_SCHEMA = "semantic-reranker-bounded-blind-item-v1"
METADATA_SCHEMA = "semantic-reranker-bounded-metadata-v1"
CANDIDATE_COUNT = 12
RESULT_LIMIT = 10
EXPECTED_QUERY_SHA256 = (
    "595da8eae92f48c0b05e88ff02256085590aa7e2bf41a4a919499aaaa8df3b16"
)
EXPECTED_INDEX_BUILD_ID = "20261009T135455Z"
EXPECTED_FAISS_SHA256 = (
    "31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68"
)
EXPECTED_DATABASE_SHA256 = (
    "e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_sha256(value: Any) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _atomic_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.replace(temporary_name, path)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def _jsonl(rows: list[dict[str, Any]]) -> str:
    return "".join(
        json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows
    )


def load_queries(path: Path) -> list[dict[str, Any]]:
    if sha256_file(path) != EXPECTED_QUERY_SHA256:
        raise RuntimeError("Frozen query-set SHA-256 mismatch")
    rows = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if len(rows) != 5:
        raise RuntimeError(f"Expected five frozen queries, found {len(rows)}")
    query_ids = [row.get("query_id") for row in rows]
    if len(set(query_ids)) != len(query_ids) or any(
        not isinstance(row.get("query"), str) or not row["query"].strip()
        for row in rows
    ):
        raise RuntimeError("Invalid or duplicate frozen queries")
    return rows


def preflight(
    settings: RetrievalSettings,
    queries_path: Path,
    output_paths: tuple[Path, Path, Path],
    *,
    require_absent_outputs: bool = True,
) -> dict[str, Any]:
    queries = load_queries(queries_path)
    if require_absent_outputs:
        existing = [str(path) for path in output_paths if path.exists()]
        if existing:
            raise FileExistsError(f"Refusing to overwrite frozen outputs: {existing}")
    if settings.device != "mps":
        raise RuntimeError("The frozen runner requires RETRIEVAL_DEVICE=mps")
    if settings.reranker_batch_size != 1:
        raise RuntimeError("The frozen runner requires RERANKER_BATCH_SIZE=1")

    version = resolve_current_version(settings.index_dir)
    manifest = json.loads((version / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("build_id") != EXPECTED_INDEX_BUILD_ID:
        raise RuntimeError("Frozen index build ID mismatch")
    if manifest.get("faiss", {}).get("sha256") != EXPECTED_FAISS_SHA256:
        raise RuntimeError("Frozen FAISS manifest hash mismatch")
    if sha256_file(version / manifest["faiss"]["file"]) != EXPECTED_FAISS_SHA256:
        raise RuntimeError("Frozen FAISS file hash mismatch")
    database_path = version / manifest["metadata_database"]
    if sha256_file(database_path) != EXPECTED_DATABASE_SHA256:
        raise RuntimeError("Frozen metadata database hash mismatch")
    connection = sqlite3.connect(database_path)
    try:
        document_count = int(
            connection.execute("SELECT count(*) FROM documents").fetchone()[0]
        )
    finally:
        connection.close()
    if document_count != 451_823:
        raise RuntimeError("Frozen metadata document count mismatch")
    return {
        "experiment_id": EXPERIMENT_ID,
        "status": "ready",
        "query_count": len(queries),
        "candidate_count": CANDIDATE_COUNT,
        "result_limit": RESULT_LIMIT,
        "reranker_pairs": len(queries) * CANDIDATE_COUNT,
        "index_build_id": manifest["build_id"],
        "document_count": document_count,
        "faiss_sha256": EXPECTED_FAISS_SHA256,
        "database_sha256": EXPECTED_DATABASE_SHA256,
        "query_set_sha256": EXPECTED_QUERY_SHA256,
    }


def _ranked(result: SearchResult, rank: int) -> dict[str, Any]:
    payload = result.to_dict()
    payload["rank"] = rank
    return payload


def build_ab_row(
    query_item: dict[str, Any],
    candidates: list[SearchResult],
    reranked: list[SearchResult],
) -> dict[str, Any]:
    if len(candidates) != CANDIDATE_COUNT or len(reranked) != CANDIDATE_COUNT:
        raise RuntimeError("Unexpected candidate count")
    semantic_ids = [item.document.id for item in candidates]
    reranked_ids = [item.document.id for item in reranked]
    if len(set(semantic_ids)) != CANDIDATE_COUNT:
        raise RuntimeError("Duplicate IDs in semantic candidate pool")
    if set(semantic_ids) != set(reranked_ids):
        raise RuntimeError("A/B candidate pools differ")
    if any(
        item.rerank_score is None or not math.isfinite(item.rerank_score)
        for item in reranked
    ):
        raise RuntimeError("Missing or non-finite reranker score")
    return {
        "schema_version": AB_SCHEMA,
        "experiment_id": EXPERIMENT_ID,
        "query_id": query_item["query_id"],
        "query": query_item["query"],
        "review_dimensions": query_item.get("review_dimensions", []),
        "candidate_pool_fingerprint": _canonical_sha256(semantic_ids),
        "candidate_pool": [
            _ranked(item, rank)
            for rank, item in enumerate(candidates, start=1)
        ],
        "condition_a": [
            _ranked(item, rank)
            for rank, item in enumerate(candidates[:RESULT_LIMIT], start=1)
        ],
        "condition_b": [
            _ranked(item, rank)
            for rank, item in enumerate(reranked[:RESULT_LIMIT], start=1)
        ],
    }


def build_blind_items(ab_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blind: list[dict[str, Any]] = []
    forbidden = {
        "rank",
        "semantic_score",
        "lexical_score",
        "rerank_score",
        "condition",
        "candidate_pool_fingerprint",
    }
    for row in ab_rows:
        union: dict[str, dict[str, Any]] = {}
        for item in (*row["condition_a"], *row["condition_b"]):
            union[item["id"]] = item
        ordered = sorted(
            union.values(),
            key=lambda item: hashlib.sha256(
                f"{EXPERIMENT_ID}\0{row['query_id']}\0{item['id']}".encode("utf-8")
            ).hexdigest(),
        )
        for item in ordered:
            item_id = hashlib.sha256(
                f"blind\0{EXPERIMENT_ID}\0{row['query_id']}\0{item['id']}".encode(
                    "utf-8"
                )
            ).hexdigest()[:24]
            clean = {key: value for key, value in item.items() if key not in forbidden}
            blind.append(
                {
                    "schema_version": BLIND_SCHEMA,
                    "experiment_id": EXPERIMENT_ID,
                    "item_id": item_id,
                    "query_id": row["query_id"],
                    "query": row["query"],
                    "document": clean,
                    "judgment": {
                        "relevance": None,
                        "abstain": None,
                        "note": None,
                    },
                }
            )
    return blind


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the preregistered bounded semantic/reranker comparison."
    )
    parser.add_argument(
        "--queries",
        type=Path,
        default=Path("benchmark/semantic-retrieval/queries-v1.jsonl"),
    )
    parser.add_argument("--artifacts-dir", type=Path, required=True)
    parser.add_argument("--ab-output", type=Path, required=True)
    parser.add_argument("--blind-output", type=Path, required=True)
    parser.add_argument("--metadata-output", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = replace(
        RetrievalSettings.from_env().with_artifacts_dir(args.artifacts_dir),
        search_candidates=CANDIDATE_COUNT,
        rerank_results=RESULT_LIMIT,
        reranker_batch_size=1,
        enable_reranker=True,
    )
    output_paths = (args.ab_output, args.blind_output, args.metadata_output)
    readiness = preflight(settings, args.queries, output_paths)
    if args.preflight_only:
        print(json.dumps(readiness, ensure_ascii=False, sort_keys=True))
        return

    queries = load_queries(args.queries)
    service = RetrievalService(settings)
    rows: list[dict[str, Any]] = []
    started = time.monotonic()
    try:
        for position, query_item in enumerate(queries, start=1):
            candidates = service.semantic.search(
                query_item["query"],
                limit=CANDIDATE_COUNT,
                candidates=CANDIDATE_COUNT,
            )
            if len(candidates) != CANDIDATE_COUNT:
                raise RuntimeError(
                    f"{query_item['query_id']} returned {len(candidates)} candidates"
                )
            semantic_snapshot = [
                SearchResult(
                    document=item.document,
                    semantic_score=item.semantic_score,
                    lexical_score=item.lexical_score,
                )
                for item in candidates
            ]
            query_started = time.monotonic()
            reranked = service.reranker.rerank(
                query_item["query"], candidates, limit=CANDIDATE_COUNT
            )
            rows.append(build_ab_row(query_item, semantic_snapshot, reranked))
            print(
                json.dumps(
                    {
                        "stage": "query_complete",
                        "query_id": query_item["query_id"],
                        "position": position,
                        "total": len(queries),
                        "pairs_scored": position * CANDIDATE_COUNT,
                        "elapsed_seconds": round(time.monotonic() - query_started, 3),
                    },
                    sort_keys=True,
                ),
                flush=True,
            )
    finally:
        service.close()

    blind_rows = build_blind_items(rows)
    ab_text = _jsonl(rows)
    blind_text = _jsonl(blind_rows)
    _atomic_text(args.ab_output, ab_text)
    _atomic_text(args.blind_output, blind_text)
    metadata = {
        "schema_version": METADATA_SCHEMA,
        "experiment_id": EXPERIMENT_ID,
        "created_at": _now(),
        "elapsed_seconds": round(time.monotonic() - started, 3),
        **readiness,
        "ab_rows": len(rows),
        "blind_rows": len(blind_rows),
        "ab_sha256": sha256_file(args.ab_output),
        "blind_sha256": sha256_file(args.blind_output),
        "reranker": {
            "model": settings.reranker_model,
            "revision": settings.reranker_model_revision,
            "device": settings.device,
            "batch_size": settings.reranker_batch_size,
        },
        "tie_break": "stable semantic candidate order",
        "human_labels_used_during_inference": False,
    }
    _atomic_text(
        args.metadata_output,
        json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )
    print(json.dumps(metadata, ensure_ascii=False, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
