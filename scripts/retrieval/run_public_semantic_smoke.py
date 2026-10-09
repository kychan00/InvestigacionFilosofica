#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_API_BASE_URL = "https://filosofia-semantic.tail829c9b.ts.net"
DEFAULT_QUERIES = Path("benchmark/semantic-retrieval/queries-v1.jsonl")
RESULT_SCHEMA = "semantic-public-smoke-result-v1"
SUMMARY_SCHEMA = "semantic-public-smoke-summary-v1"
METADATA_SCHEMA = "semantic-public-smoke-metadata-v1"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_queries(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for line_number, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid JSON on query line {line_number}") from error

        query_id = str(row.get("query_id", "")).strip()
        query = str(row.get("query", "")).strip()
        if not query_id or not query:
            raise ValueError(f"query line {line_number} lacks query_id or query")
        if query_id in seen_ids:
            raise ValueError(f"duplicate query_id: {query_id}")

        seen_ids.add(query_id)
        rows.append(row)

    if not rows:
        raise ValueError("query set is empty")
    return rows


def validate_health(payload: dict[str, Any], query_count: int) -> None:
    if payload.get("status") != "ready":
        raise RuntimeError("public semantic service is not ready")
    if int(payload.get("documents", 0)) <= 0:
        raise RuntimeError("health response has no positive document count")
    if payload.get("reranker_available") is not False:
        raise RuntimeError("public reranker boundary is not disabled")

    limits = payload.get("search_limits") or {}
    if int(limits.get("concurrent_requests", 0)) != 1:
        raise RuntimeError("unexpected public concurrency contract")
    if int(limits.get("requests_per_window", 0)) < query_count:
        raise RuntimeError("query set exceeds the advertised rate window")


def validate_search_payload(
    payload: dict[str, Any], query: str, requested_limit: int
) -> None:
    if payload.get("query") != query:
        raise RuntimeError("response query differs from the frozen query")
    if payload.get("mode") != "semantic":
        raise RuntimeError("response mode is not semantic")
    if payload.get("reranker_enabled") is not False:
        raise RuntimeError("reranker unexpectedly enabled")

    results = payload.get("results")
    if not isinstance(results, list) or len(results) != requested_limit:
        raise RuntimeError("response does not contain the requested result count")

    ids: list[str] = []
    scores: list[float] = []
    for rank, result in enumerate(results, start=1):
        if not isinstance(result, dict):
            raise RuntimeError(f"result {rank} is not an object")
        document_id = str(result.get("id", "")).strip()
        if not document_id:
            raise RuntimeError(f"result {rank} lacks id")
        if result.get("rerank_score") is not None:
            raise RuntimeError(f"result {rank} has a rerank score")
        score = result.get("semantic_score")
        if not isinstance(score, (int, float)):
            raise RuntimeError(f"result {rank} lacks a numeric semantic score")
        ids.append(document_id)
        scores.append(float(score))

    if len(ids) != len(set(ids)):
        raise RuntimeError("response contains duplicate document IDs")
    if scores != sorted(scores, reverse=True):
        raise RuntimeError("semantic scores are not in descending order")


def request_json(
    url: str,
    *,
    timeout_seconds: float,
    body: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any], float]:
    data = None
    headers = {"Accept": "application/json"}
    method = "GET"
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            status = response.status
            raw = response.read()
    except urllib.error.HTTPError as error:
        elapsed = time.perf_counter() - started
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"HTTP {error.code} after {elapsed:.3f}s: {detail}"
        ) from error
    except urllib.error.URLError as error:
        elapsed = time.perf_counter() - started
        raise RuntimeError(f"network failure after {elapsed:.3f}s: {error}") from error

    elapsed = time.perf_counter() - started
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("server returned invalid JSON") from error
    if not isinstance(payload, dict):
        raise RuntimeError("server response is not a JSON object")
    return status, payload, elapsed


def build_result_row(
    query_row: dict[str, Any],
    payload: dict[str, Any],
    *,
    http_status: int,
    elapsed_seconds: float,
    requested_limit: int,
) -> dict[str, Any]:
    return {
        "schema_version": RESULT_SCHEMA,
        "captured_at": utc_now(),
        "query_id": query_row["query_id"],
        "query": query_row["query"],
        "review_dimensions": query_row.get("review_dimensions", []),
        "request": {
            "limit": requested_limit,
            "filters": {},
            "enable_reranker": False,
        },
        "observation": {
            "http_status": http_status,
            "elapsed_seconds": round(elapsed_seconds, 6),
            "engine_used": "semantic",
            "fallback_exercised": False,
            "missing_title_results": sum(
                not str(result.get("title") or "").strip()
                for result in payload["results"]
            ),
        },
        "response": payload,
    }


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    latencies = [row["observation"]["elapsed_seconds"] for row in rows]
    return {
        "schema_version": SUMMARY_SCHEMA,
        "status": "operational_smoke_passed",
        "query_count": len(rows),
        "successful_queries": sum(
            row["observation"]["http_status"] == 200 for row in rows
        ),
        "result_rows": sum(len(row["response"]["results"]) for row in rows),
        "missing_title_results": sum(
            row["observation"]["missing_title_results"] for row in rows
        ),
        "latency_seconds": {
            "minimum": min(latencies),
            "median": statistics.median(latencies),
            "mean": statistics.fmean(latencies),
            "maximum": max(latencies),
        },
        "reranker_enabled": False,
        "fallback_exercised": False,
        "human_relevance_reviewed": False,
        "interpretation": (
            "This receipt validates public availability and response contracts only; "
            "it does not claim human relevance or ranking quality."
        ),
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_head() -> str:
    return subprocess.run(
        ["git", "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture a bounded public semantic API smoke without labels."
    )
    parser.add_argument("--queries", type=Path, default=DEFAULT_QUERIES)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--timeout-seconds", type=float, default=120)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--confirm-live", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    queries = load_queries(args.queries)
    if not 1 <= args.limit <= 20:
        raise SystemExit("--limit must be between 1 and 20")

    plan = {
        "schema_version": "semantic-public-smoke-plan-v1",
        "api_base_url": args.api_base_url.rstrip("/"),
        "query_count": len(queries),
        "query_ids": [row["query_id"] for row in queries],
        "limit": args.limit,
        "reranker_enabled": False,
        "retries": 0,
        "concurrency": 1,
    }
    if args.preflight:
        print(json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True))
        return
    if not args.confirm_live:
        raise SystemExit("live capture requires --confirm-live")
    if args.output_dir.exists():
        raise SystemExit(f"output directory already exists: {args.output_dir}")

    args.output_dir.mkdir(parents=True)
    log_path = args.output_dir / "run.log"
    def log(message: str) -> None:
        line = f"{utc_now()} {message}"
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
        print(line, flush=True)

    started_at = utc_now()
    base_url = args.api_base_url.rstrip("/")
    log(f"start queries={len(queries)} limit={args.limit} retries=0 concurrency=1")

    health_status, health, health_elapsed = request_json(
        f"{base_url}/health", timeout_seconds=args.timeout_seconds
    )
    if health_status != 200:
        raise RuntimeError(f"health returned HTTP {health_status}")
    validate_health(health, len(queries))
    health_path = args.output_dir / "health.json"
    write_json(health_path, health)
    log(
        f"health ready documents={health['documents']} "
        f"elapsed_seconds={health_elapsed:.6f}"
    )

    rows: list[dict[str, Any]] = []
    results_path = args.output_dir / "results.jsonl"
    with results_path.open("w", encoding="utf-8") as handle:
        for position, query_row in enumerate(queries, start=1):
            query = query_row["query"]
            status, payload, elapsed = request_json(
                f"{base_url}/api/search/semantic",
                timeout_seconds=args.timeout_seconds,
                body={
                    "query": query,
                    "limit": args.limit,
                    "filters": {},
                    "enable_reranker": False,
                },
            )
            if status != 200:
                raise RuntimeError(f"query {query_row['query_id']} returned HTTP {status}")
            validate_search_payload(payload, query, args.limit)
            row = build_result_row(
                query_row,
                payload,
                http_status=status,
                elapsed_seconds=elapsed,
                requested_limit=args.limit,
            )
            rows.append(row)
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
            handle.flush()
            log(
                f"query {position}/{len(queries)} id={query_row['query_id']} "
                f"http=200 results={len(payload['results'])} "
                f"elapsed_seconds={elapsed:.6f}"
            )

    summary = summarize(rows)
    summary_path = args.output_dir / "summary.json"
    write_json(summary_path, summary)
    completed_at = utc_now()
    log(
        f"complete queries={len(rows)} result_rows={summary['result_rows']} "
        f"mean_seconds={summary['latency_seconds']['mean']:.6f}"
    )
    metadata = {
        "schema_version": METADATA_SCHEMA,
        "status": "frozen_public_operational_smoke",
        "started_at": started_at,
        "completed_at": completed_at,
        "runner_commit": git_head(),
        "api_base_url": base_url,
        "query_count": len(queries),
        "requested_limit": args.limit,
        "reranker_enabled": False,
        "retries": 0,
        "concurrency": 1,
        "production_ranking_changed": False,
        "human_labels_used": False,
        "missing_title_results": summary["missing_title_results"],
        "hashes": {
            "queries_sha256": sha256(args.queries),
            "health_sha256": sha256(health_path),
            "results_sha256": sha256(results_path),
            "summary_sha256": sha256(summary_path),
            "run_log_sha256": sha256(log_path),
        },
    }
    write_json(args.output_dir / "metadata.json", metadata)


if __name__ == "__main__":
    main()
