#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.retrieval.run_public_semantic_smoke import (
    DEFAULT_API_BASE_URL,
    git_head,
    request_json,
    sha256,
    utc_now,
    write_json,
)

QUERY = "¿Qué relación existe entre Quine y el compromiso ontológico?"
EXPECTED_EXACT_GROUP = {
    "openalex-W2211243423",
    "openalex-W7069018285",
}


def _presentation(payload: dict[str, Any]) -> dict[str, Any]:
    status = payload.get("presentation")
    if not isinstance(status, dict):
        raise TypeError("response lacks presentation status")
    return status


def _score_tuple(row: dict[str, Any]) -> tuple[Any, Any, Any]:
    return (
        row.get("semantic_score"),
        row.get("lexical_score"),
        row.get("rerank_score"),
    )


def validate_capture(
    health: dict[str, Any],
    default_payload: dict[str, Any],
    enabled_payload: dict[str, Any],
    *,
    limit: int,
) -> dict[str, Any]:
    if health.get("status") != "ready":
        raise RuntimeError("public semantic service is not ready")
    if health.get("reranker_available") is not False:
        raise RuntimeError("public reranker boundary changed")
    if health.get("presentation_hygiene_available") is not True:
        raise RuntimeError("public presentation capability is not enabled")

    for payload in (default_payload, enabled_payload):
        if payload.get("query") != QUERY:
            raise RuntimeError("response query differs from the frozen query")
        if payload.get("mode") != "semantic":
            raise RuntimeError("response mode is not semantic")
        if payload.get("reranker_enabled") is not False:
            raise RuntimeError("reranker unexpectedly enabled")

    default_status = _presentation(default_payload)
    if default_status != {
        "requested": False,
        "available": True,
        "enabled": False,
        "applied": False,
        "fallback": False,
        "source_result_count": limit,
        "presented_result_count": limit,
        "collapsed_result_count": 0,
    }:
        raise RuntimeError("default-off presentation status is not exact")

    enabled_status = _presentation(enabled_payload)
    expected_enabled_status = {
        "requested": True,
        "available": True,
        "enabled": True,
        "applied": True,
        "fallback": False,
        "source_result_count": limit,
        "presented_result_count": limit - 1,
        "collapsed_result_count": 1,
    }
    if enabled_status != expected_enabled_status:
        raise RuntimeError("enabled presentation status is not exact")

    default_results = default_payload.get("results")
    enabled_results = enabled_payload.get("results")
    if not isinstance(default_results, list) or len(default_results) != limit:
        raise RuntimeError("default response does not preserve source count")
    if not isinstance(enabled_results, list) or len(enabled_results) != limit - 1:
        raise RuntimeError("enabled response has unexpected result count")

    default_ids = [str(row.get("id") or "") for row in default_results]
    default_scores = {row["id"]: _score_tuple(row) for row in default_results}
    flattened_ids: list[str] = []
    exact_groups: list[list[str]] = []

    presentation_only = {
        "display",
        "metadata_findings",
        "presentation_rank",
        "source_rank",
        "work_identity",
    }
    if any(presentation_only & set(row) for row in default_results):
        raise RuntimeError("default-off results contain presentation fields")

    for row in enabled_results:
        display = row.get("display")
        identity = row.get("work_identity")
        if not isinstance(display, dict) or not str(display.get("title") or "").strip():
            raise RuntimeError("enabled result lacks a display title")
        if not isinstance(identity, dict):
            raise TypeError("enabled result lacks work identity")
        members = identity.get("members")
        if not isinstance(members, list) or not members:
            raise RuntimeError("enabled result lacks provenance members")
        member_ids = [str(member.get("id") or "") for member in members]
        flattened_ids.extend(member_ids)
        for member in members:
            member_id = member["id"]
            if member_id not in default_scores:
                raise RuntimeError("provenance contains an unknown source id")
            if _score_tuple(member) != default_scores[member_id]:
                raise RuntimeError("provenance changed a source score")
        if identity.get("classification") == "exact_identity":
            exact_groups.append(member_ids)

    if flattened_ids != default_ids:
        raise RuntimeError("flattened provenance changed source order")
    if len(exact_groups) != 1 or set(exact_groups[0]) != EXPECTED_EXACT_GROUP:
        raise RuntimeError("public exact group differs from the frozen expectation")

    return {
        "status": "public_presentation_smoke_passed",
        "documents": int(health.get("documents", 0)),
        "source_result_count": len(default_results),
        "presented_result_count": len(enabled_results),
        "collapsed_result_count": 1,
        "exact_group": exact_groups[0],
        "source_ids_preserved": True,
        "source_order_preserved": True,
        "scores_preserved": True,
        "display_fields_present": True,
        "default_off_results_preserved": True,
        "presentation_fallback_exercised": False,
        "reranker_enabled": False,
        "production_ranking_changed": False,
        "human_labels_used": False,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the bounded public presentation API deployment smoke."
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--timeout-seconds", type=float, default=120)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--confirm-live", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.limit != 10:
        raise SystemExit("the frozen public presentation smoke requires --limit 10")

    plan = {
        "schema_version": "semantic-public-presentation-smoke-plan-v1",
        "api_base_url": args.api_base_url.rstrip("/"),
        "query": QUERY,
        "search_request_count": 2,
        "limit": args.limit,
        "reranker_enabled": False,
        "presentation_requests": [False, True],
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

    base_url = args.api_base_url.rstrip("/")
    started_at = utc_now()
    log("start search_requests=2 limit=10 retries=0 concurrency=1")

    health_status, health, health_elapsed = request_json(
        f"{base_url}/health", timeout_seconds=args.timeout_seconds
    )
    if health_status != 200:
        raise RuntimeError(f"health returned HTTP {health_status}")
    write_json(args.output_dir / "health.json", health)
    log(f"health http=200 elapsed_seconds={health_elapsed:.6f}")

    body = {
        "query": QUERY,
        "limit": args.limit,
        "filters": {},
        "enable_reranker": False,
    }
    default_status, default_payload, default_elapsed = request_json(
        f"{base_url}/api/search/semantic",
        timeout_seconds=args.timeout_seconds,
        body=body,
    )
    if default_status != 200:
        raise RuntimeError(f"default request returned HTTP {default_status}")
    log(
        f"default_off http=200 results={len(default_payload.get('results') or [])} "
        f"elapsed_seconds={default_elapsed:.6f}"
    )

    enabled_status, enabled_payload, enabled_elapsed = request_json(
        f"{base_url}/api/search/semantic",
        timeout_seconds=args.timeout_seconds,
        body={**body, "enable_presentation_hygiene": True},
    )
    if enabled_status != 200:
        raise RuntimeError(f"enabled request returned HTTP {enabled_status}")
    log(
        f"enabled http=200 results={len(enabled_payload.get('results') or [])} "
        f"elapsed_seconds={enabled_elapsed:.6f}"
    )

    summary = validate_capture(
        health,
        default_payload,
        enabled_payload,
        limit=args.limit,
    )
    responses = {
        "schema_version": "semantic-public-presentation-smoke-responses-v1",
        "default_off": default_payload,
        "enabled": enabled_payload,
    }
    write_json(args.output_dir / "responses.json", responses)
    write_json(args.output_dir / "summary.json", summary)
    log("complete status=public_presentation_smoke_passed")

    hashes = {
        name: sha256(args.output_dir / name)
        for name in ("health.json", "responses.json", "summary.json", "run.log")
    }
    write_json(
        args.output_dir / "metadata.json",
        {
            "schema_version": "semantic-public-presentation-smoke-metadata-v1",
            "status": "frozen_public_presentation_smoke",
            "started_at": started_at,
            "completed_at": utc_now(),
            "runner_commit": git_head(),
            "api_base_url": base_url,
            "query": QUERY,
            "requested_limit": args.limit,
            "search_request_count": 2,
            "reranker_enabled": False,
            "production_ranking_changed": False,
            "human_labels_used": False,
            "hashes": hashes,
        },
    )


if __name__ == "__main__":
    main()
