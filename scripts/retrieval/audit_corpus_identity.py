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

from semantic_retrieval.corpus_identity_audit import audit_corpus_identity


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


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit exact identities across a frozen semantic metadata corpus."
    )
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--source-manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--expected-documents", type=int, required=True)
    parser.add_argument("--expected-database-sha256", required=True)
    parser.add_argument("--sample-size", type=int, default=25)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--confirm-audit", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plan = {
        "schema_version": "semantic-corpus-identity-audit-plan-v1",
        "database": str(args.database),
        "source_manifest": str(args.source_manifest),
        "output_dir": str(args.output_dir),
        "expected_documents": args.expected_documents,
        "expected_database_sha256": args.expected_database_sha256,
        "sample_size": args.sample_size,
        "identity_policy": "normalized_doi_or_exact_normalized_title_year_abstract",
        "review_sample_rule": "first_group_id_ascending",
        "database_open_mode": "read_only_immutable",
        "mutates_source": False,
        "runs_inference": False,
        "uses_human_labels": False,
        "changes_scores_or_ranking": False,
        "changes_production": False,
    }
    if args.preflight:
        print(json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True))
        return
    if not args.confirm_audit:
        raise SystemExit("corpus identity audit requires --confirm-audit")
    if args.output_dir.exists():
        raise SystemExit(f"output directory already exists: {args.output_dir}")
    if not args.database.is_file() or not args.source_manifest.is_file():
        raise SystemExit("database or source manifest does not exist")
    database_sha = sha256(args.database)
    if database_sha != args.expected_database_sha256:
        raise SystemExit(
            "database SHA-256 mismatch: "
            f"expected {args.expected_database_sha256}, got {database_sha}"
        )

    before = args.database.stat()
    args.output_dir.mkdir(parents=True)
    log_path = args.output_dir / "run.log"

    def progress(document_count: int) -> None:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{utc_now()} scanned_documents={document_count}\n")

    log_path.write_text(
        f"{utc_now()} corpus_identity_audit_started\n", encoding="utf-8"
    )
    groups, sample, summary = audit_corpus_identity(
        args.database,
        sample_size=args.sample_size,
        progress=progress,
    )
    after = args.database.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError(
            "source database size or modification time changed during audit"
        )
    if summary["source_document_count"] != args.expected_documents:
        raise RuntimeError(
            "document count mismatch: "
            f"expected {args.expected_documents}, got {summary['source_document_count']}"
        )

    groups_path = args.output_dir / "duplicate-groups.jsonl"
    sample_path = args.output_dir / "review-sample.jsonl"
    summary_path = args.output_dir / "summary.json"
    write_jsonl(groups_path, groups)
    write_jsonl(sample_path, sample)
    write_json(summary_path, summary)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(
            f"{utc_now()} corpus_identity_audit_complete "
            f"documents={summary['source_document_count']} "
            f"groups={summary['exact_duplicate_group_count']} "
            f"conflicts={summary['doi_metadata_conflict_group_count']}\n"
        )

    metadata = {
        "schema_version": "semantic-corpus-identity-audit-metadata-v1",
        "created_at": utc_now(),
        "runner_commit": git_head(),
        "plan": plan,
        "inputs": {
            "database_sha256": database_sha,
            "source_manifest_sha256": sha256(args.source_manifest),
        },
        "source_stat_unchanged": True,
        "outputs": {
            "duplicate-groups.jsonl": sha256(groups_path),
            "review-sample.jsonl": sha256(sample_path),
            "summary.json": sha256(summary_path),
            "run.log": sha256(log_path),
        },
    }
    write_json(args.output_dir / "metadata.json", metadata)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
