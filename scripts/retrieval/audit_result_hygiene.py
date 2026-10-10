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

from semantic_retrieval.result_hygiene import audit_smoke_rows


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


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit result metadata and duplicate identity without reranking."
    )
    parser.add_argument("--source-results", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--confirm-audit", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plan = {
        "schema_version": "semantic-result-hygiene-plan-v1",
        "source_results": str(args.source_results),
        "output_dir": str(args.output_dir),
        "mutates_source": False,
        "modifies_scores_or_order": False,
        "uses_human_labels": False,
        "exact_duplicate_action": "eligible_for_conservative_collapse",
        "probable_duplicate_action": "review_only_do_not_auto_collapse",
    }
    if args.preflight:
        print(json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True))
        return
    if not args.confirm_audit:
        raise SystemExit("audit requires --confirm-audit")
    if args.output_dir.exists():
        raise SystemExit(f"output directory already exists: {args.output_dir}")

    rows = load_jsonl(args.source_results)
    findings, groups, summary = audit_smoke_rows(rows)
    args.output_dir.mkdir(parents=True)
    findings_path = args.output_dir / "findings.jsonl"
    groups_path = args.output_dir / "duplicate-groups.jsonl"
    summary_path = args.output_dir / "summary.json"
    log_path = args.output_dir / "run.log"

    write_jsonl(findings_path, findings)
    write_jsonl(groups_path, groups)
    write_json(summary_path, summary)
    log_path.write_text(
        (
            f"{utc_now()} audit_complete queries={summary['query_count']} "
            f"results={summary['result_count']} findings={summary['finding_count']} "
            f"exact_groups={summary['exact_duplicate_group_count']} "
            f"probable_groups={summary['probable_duplicate_group_count']}\n"
        ),
        encoding="utf-8",
    )

    metadata = {
        "schema_version": "semantic-result-hygiene-metadata-v1",
        "created_at": utc_now(),
        "runner_commit": git_head(),
        "plan": plan,
        "source_results_sha256": sha256(args.source_results),
        "outputs": {
            "findings.jsonl": sha256(findings_path),
            "duplicate-groups.jsonl": sha256(groups_path),
            "summary.json": sha256(summary_path),
            "run.log": sha256(log_path),
        },
    }
    write_json(args.output_dir / "metadata.json", metadata)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
