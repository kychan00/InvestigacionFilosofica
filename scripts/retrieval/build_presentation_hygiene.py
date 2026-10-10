#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.result_hygiene import build_presentation_results


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


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid JSON on line {line_number}") from error
        if not isinstance(row, dict):
            raise ValueError(f"line {line_number} is not an object")
        rows.append(row)
    if not rows:
        raise ValueError("source JSONL is empty")
    return rows


def result_list(row: Mapping[str, Any]) -> list[dict[str, Any]]:
    direct = row.get("results")
    if isinstance(direct, list):
        return direct
    response = row.get("response")
    if isinstance(response, Mapping) and isinstance(response.get("results"), list):
        return response["results"]
    raise ValueError("row lacks a results list")


def query_id(row: Mapping[str, Any]) -> str:
    value = str(row.get("query_id") or "").strip()
    if not value:
        raise ValueError("row lacks query_id")
    return value


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def build_rows(
    source_rows: list[dict[str, Any]],
    excluded_rows: list[dict[str, Any]],
    *,
    rank_from: int,
    rank_to: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    excluded_ids = {
        str(result.get("id") or "")
        for row in excluded_rows
        for result in result_list(row)
    }
    outputs: list[dict[str, Any]] = []
    aggregate = {
        "source_result_count": 0,
        "presented_result_count": 0,
        "collapsed_result_count": 0,
        "exact_group_count": 0,
        "html_sanitized_fields": 0,
        "title_fallback_count": 0,
        "metadata_finding_count": 0,
    }
    overlap_ids: set[str] = set()

    for row in source_rows:
        results = result_list(row)
        if len(results) < rank_to:
            raise ValueError(
                f"{query_id(row)} has {len(results)} results, needs {rank_to}"
            )
        selected = results[rank_from - 1 : rank_to]
        selected_ids = {str(result.get("id") or "") for result in selected}
        overlap_ids.update(selected_ids & excluded_ids)
        presented, stats = build_presentation_results(
            selected,
            source_rank_offset=rank_from - 1,
        )
        for key in aggregate:
            aggregate[key] += int(stats[key])
        outputs.append(
            {
                "schema_version": "semantic-presentation-hygiene-result-v1",
                "query_id": query_id(row),
                "query": row.get("query"),
                "source_rank_from": rank_from,
                "source_rank_to": rank_to,
                "source_ids": [str(result.get("id") or "") for result in selected],
                "presentation_results": presented,
                "validation": stats,
            }
        )

    if overlap_ids:
        raise RuntimeError(
            "held-out selection overlaps excluded IDs: " + ", ".join(sorted(overlap_ids))
        )
    summary = {
        "schema_version": "semantic-presentation-hygiene-summary-v1",
        "status": "heldout_validation_complete",
        "query_count": len(outputs),
        "rank_window": {"from": rank_from, "to": rank_to},
        **aggregate,
        "excluded_overlap_count": 0,
        "all_source_ids_preserved": all(
            output["validation"]["all_source_ids_preserved"] for output in outputs
        ),
        "source_scores_modified": False,
        "source_order_recomputed": False,
        "probable_identity_collapsed": False,
        "human_labels_used": False,
        "production_change_authorized": False,
    }
    return outputs, summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate display hygiene and exact-only collapse on held-out rows."
    )
    parser.add_argument("--source-results", type=Path, required=True)
    parser.add_argument("--exclude-results", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--rank-from", type=int, default=11)
    parser.add_argument("--rank-to", type=int, default=15)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--confirm-validation", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.rank_from < 1 or args.rank_to < args.rank_from:
        raise SystemExit("invalid rank window")
    plan = {
        "schema_version": "semantic-presentation-hygiene-plan-v1",
        "source_results": str(args.source_results),
        "exclude_results": str(args.exclude_results),
        "output_dir": str(args.output_dir),
        "rank_window": {"from": args.rank_from, "to": args.rank_to},
        "display_cleanup": "html_entities_and_tags_only",
        "missing_title_display": "Sin título",
        "collapse_policy": "exact_identity_only",
        "probable_identity_policy": "never_collapse",
        "preserve_member_ids_and_scores": True,
        "mutates_source": False,
        "uses_human_labels": False,
        "changes_production": False,
    }
    if args.preflight:
        print(json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True))
        return
    if not args.confirm_validation:
        raise SystemExit("held-out validation requires --confirm-validation")
    if args.output_dir.exists():
        raise SystemExit(f"output directory already exists: {args.output_dir}")

    source_rows = load_jsonl(args.source_results)
    excluded_rows = load_jsonl(args.exclude_results)
    output_rows, summary = build_rows(
        source_rows,
        excluded_rows,
        rank_from=args.rank_from,
        rank_to=args.rank_to,
    )

    args.output_dir.mkdir(parents=True)
    results_path = args.output_dir / "presented-results.jsonl"
    summary_path = args.output_dir / "summary.json"
    log_path = args.output_dir / "run.log"
    write_jsonl(results_path, output_rows)
    write_json(summary_path, summary)
    log_path.write_text(
        (
            f"{utc_now()} heldout_validation_complete "
            f"queries={summary['query_count']} "
            f"source_results={summary['source_result_count']} "
            f"presented_results={summary['presented_result_count']} "
            f"collapsed={summary['collapsed_result_count']} "
            f"excluded_overlap=0\n"
        ),
        encoding="utf-8",
    )
    metadata = {
        "schema_version": "semantic-presentation-hygiene-metadata-v1",
        "created_at": utc_now(),
        "runner_commit": git_head(),
        "plan": plan,
        "inputs": {
            "source_results_sha256": sha256(args.source_results),
            "exclude_results_sha256": sha256(args.exclude_results),
        },
        "outputs": {
            "presented-results.jsonl": sha256(results_path),
            "summary.json": sha256(summary_path),
            "run.log": sha256(log_path),
        },
    }
    write_json(args.output_dir / "metadata.json", metadata)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
