#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.abstract_audit import SAMPLE_SEED, audit_abstracts
from semantic_retrieval.config import RetrievalSettings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit abstract coverage in the pinned semantic corpus."
    )
    parser.add_argument("--artifacts-dir", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--sample-size", type=int, default=50)
    parser.add_argument("--seed", type=int, default=SAMPLE_SEED)
    parser.add_argument("--batch-size", type=int, default=4096)
    parser.add_argument("--smoke-artifacts-dir", type=Path)
    parser.add_argument("--smoke-input-count", type=int, default=5)
    parser.add_argument(
        "--decision",
        choices=("PENDING_REVIEW", "PASS", "NEEDS_ENRICHMENT"),
        default="PENDING_REVIEW",
    )
    parser.add_argument("--decision-reason")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.sample_size < 1:
        raise SystemExit("--sample-size must be positive")
    if args.batch_size < 1:
        raise SystemExit("--batch-size must be positive")
    if args.smoke_input_count < 1:
        raise SystemExit("--smoke-input-count must be positive")
    if args.decision != "PENDING_REVIEW" and not args.decision_reason:
        raise SystemExit("A final --decision requires --decision-reason")

    settings = RetrievalSettings.from_env()
    if args.artifacts_dir:
        settings = settings.with_artifacts_dir(args.artifacts_dir)
    output = args.output or (
        settings.artifacts_dir / "audits" / "abstract-coverage-v3.2.json"
    )
    report = audit_abstracts(
        settings,
        output_path=output,
        sample_size=args.sample_size,
        seed=args.seed,
        batch_size=args.batch_size,
        smoke_artifacts_dir=args.smoke_artifacts_dir,
        smoke_input_count=args.smoke_input_count,
        decision=args.decision,
        decision_reason=args.decision_reason,
    )
    print(
        json.dumps(
            {
                "output": str(output),
                "counts": report["counts"],
                "length_bins": report["length_bins"],
                "gate": report["gate"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
