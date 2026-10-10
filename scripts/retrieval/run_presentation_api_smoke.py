#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


DEFAULT_QUERY = "¿Qué relación existe entre Quine y el compromiso ontológico?"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def result_scores(result: dict[str, Any]) -> tuple[Any, Any, Any]:
    return (
        result.get("semantic_score"),
        result.get("lexical_score"),
        result.get("rerank_score"),
    )


def validate_responses(
    default_response: dict[str, Any],
    enabled_response: dict[str, Any],
    *,
    expected_limit: int,
) -> dict[str, Any]:
    default_status = default_response.get("presentation") or {}
    enabled_status = enabled_response.get("presentation") or {}
    default_results = default_response.get("results")
    enabled_results = enabled_response.get("results")
    if not isinstance(default_results, list) or len(default_results) != expected_limit:
        raise RuntimeError("default-off response changed the requested result count")
    if not isinstance(enabled_results, list):
        raise TypeError("enabled response lacks results")
    if default_status != {
        "requested": False,
        "available": True,
        "enabled": False,
        "applied": False,
        "fallback": False,
        "source_result_count": expected_limit,
        "presented_result_count": expected_limit,
        "collapsed_result_count": 0,
    }:
        raise RuntimeError("default-off presentation status is not exact")
    if not enabled_status.get("enabled") or not enabled_status.get("applied"):
        raise RuntimeError("presentation hygiene was not applied")
    if enabled_status.get("fallback"):
        raise RuntimeError("presentation hygiene exercised its fallback")
    if enabled_status.get("source_result_count") != expected_limit:
        raise RuntimeError("enabled response changed the source result window")
    if enabled_status.get("presented_result_count") != len(enabled_results):
        raise RuntimeError("enabled presented count is inconsistent")
    if enabled_status.get("collapsed_result_count", 0) < 1:
        raise RuntimeError("bounded smoke did not exercise exact collapse")

    default_ids = [str(result.get("id") or "") for result in default_results]
    if not all(default_ids) or len(default_ids) != len(set(default_ids)):
        raise RuntimeError("default source IDs are blank or repeated")
    presentation_only_fields = {
        "display",
        "metadata_findings",
        "work_identity",
        "source_rank",
        "presentation_rank",
    }
    if any(presentation_only_fields & result.keys() for result in default_results):
        raise RuntimeError("default-off results contain presentation-only fields")
    source_by_id = {result["id"]: result for result in default_results}
    flattened_ids: list[str] = []
    representative_ids: list[str] = []
    for presented in enabled_results:
        identity = presented.get("work_identity") or {}
        members = identity.get("members")
        if not isinstance(members, list) or not members:
            raise RuntimeError("enabled result lacks member provenance")
        representative_id = str(identity.get("representative_id") or "")
        if representative_id != presented.get("id"):
            raise RuntimeError("representative identity differs from result ID")
        representative_ids.append(representative_id)
        for member in members:
            member_id = str(member.get("id") or "")
            source = source_by_id.get(member_id)
            if source is None:
                raise RuntimeError("provenance contains an unknown source ID")
            if result_scores(member) != result_scores(source):
                raise RuntimeError("provenance changed a source score")
            flattened_ids.append(member_id)
        if result_scores(presented) != result_scores(source_by_id[representative_id]):
            raise RuntimeError("representative score changed")
        source_projection = {
            key: value
            for key, value in presented.items()
            if key not in presentation_only_fields
        }
        if source_projection != source_by_id[representative_id]:
            raise RuntimeError("representative source metadata changed")
    if flattened_ids != default_ids:
        raise RuntimeError("enabled provenance does not preserve source order and IDs")
    if representative_ids != [
        document_id for document_id in default_ids if document_id in representative_ids
    ]:
        raise RuntimeError("representative order changed")

    return {
        "schema_version": "semantic-presentation-api-smoke-summary-v1",
        "status": "local_smoke_passed",
        "source_result_count": len(default_results),
        "presented_result_count": len(enabled_results),
        "collapsed_result_count": enabled_status["collapsed_result_count"],
        "source_ids_preserved": True,
        "source_order_preserved": True,
        "scores_preserved": True,
        "default_off_results_preserved": True,
        "presentation_fallback_exercised": False,
        "reranker_enabled": False,
        "human_labels_used": False,
        "production_change_authorized": False,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a bounded local API smoke for presentation hygiene."
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--query", default=DEFAULT_QUERY)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--expected-documents", type=int, required=True)
    parser.add_argument("--expected-build-id", required=True)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--confirm-smoke", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plan = {
        "schema_version": "semantic-presentation-api-smoke-plan-v1",
        "output_dir": str(args.output_dir),
        "query": args.query,
        "limit": args.limit,
        "expected_documents": args.expected_documents,
        "expected_build_id": args.expected_build_id,
        "requests": ["default_off", "explicit_double_opt_in"],
        "requires_environment": {
            "ENABLE_PRESENTATION_HYGIENE": "true",
            "ENABLE_RERANKER": "false",
        },
        "runs_locally": True,
        "changes_production": False,
        "uses_human_labels": False,
    }
    if args.preflight:
        print(json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True))
        return
    if not args.confirm_smoke:
        raise SystemExit("presentation API smoke requires --confirm-smoke")
    if args.output_dir.exists():
        raise SystemExit(f"output directory already exists: {args.output_dir}")

    from fastapi.testclient import TestClient

    from semantic_retrieval import api

    if not api.settings.enable_presentation_hygiene:
        raise SystemExit("server presentation capability is not enabled")
    if api.settings.enable_reranker:
        raise SystemExit("reranker must remain disabled for this smoke")

    started_at = utc_now()
    with TestClient(api.app) as client:
        health_response = client.get("/health")
        if health_response.status_code != 200:
            raise RuntimeError("local health request failed")
        health = health_response.json()
        if health.get("status") != "ready":
            raise RuntimeError("local semantic service is not ready")
        if health.get("documents") != args.expected_documents:
            raise RuntimeError("health document count mismatch")
        if health.get("index_build_id") != args.expected_build_id:
            raise RuntimeError("health build ID mismatch")
        if health.get("presentation_hygiene_available") is not True:
            raise RuntimeError("health did not advertise presentation capability")
        body = {
            "query": args.query,
            "limit": args.limit,
            "filters": {},
            "enable_reranker": False,
        }
        default_http = client.post("/api/search/semantic", json=body)
        enabled_http = client.post(
            "/api/search/semantic",
            json={**body, "enable_presentation_hygiene": True},
        )
    if default_http.status_code != 200 or enabled_http.status_code != 200:
        raise RuntimeError(
            "local search failed: "
            f"default={default_http.status_code}, enabled={enabled_http.status_code}"
        )
    default_response = default_http.json()
    enabled_response = enabled_http.json()
    summary = validate_responses(
        default_response,
        enabled_response,
        expected_limit=args.limit,
    )

    args.output_dir.mkdir(parents=True)
    responses_path = args.output_dir / "responses.json"
    summary_path = args.output_dir / "summary.json"
    log_path = args.output_dir / "run.log"
    write_json(
        responses_path,
        {
            "schema_version": "semantic-presentation-api-smoke-responses-v1",
            "query": args.query,
            "default_off": default_response,
            "enabled": enabled_response,
        },
    )
    write_json(summary_path, summary)
    log_path.write_text(
        (
            f"{started_at} local_smoke_started\n"
            f"{utc_now()} local_smoke_passed "
            f"source={summary['source_result_count']} "
            f"presented={summary['presented_result_count']} "
            f"collapsed={summary['collapsed_result_count']}\n"
        ),
        encoding="utf-8",
    )
    metadata = {
        "schema_version": "semantic-presentation-api-smoke-metadata-v1",
        "created_at": utc_now(),
        "runner_commit": git_head(),
        "plan": plan,
        "health": health,
        "outputs": {
            "responses.json": sha256(responses_path),
            "summary.json": sha256(summary_path),
            "run.log": sha256(log_path),
        },
    }
    write_json(args.output_dir / "metadata.json", metadata)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
