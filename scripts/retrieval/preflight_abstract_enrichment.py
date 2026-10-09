#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.abstract_enrichment import (
    OPENALEX_MAX_BATCH_SIZE,
    run_openalex_probe,
    write_missing_abstract_targets,
)
from semantic_retrieval.config import RetrievalSettings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build the deterministic V3.2 missing-abstract target set and, "
            "optionally, run exactly one bounded OpenAlex API probe."
        )
    )
    parser.add_argument("--artifacts-dir", type=Path)
    parser.add_argument("--targets-output", type=Path)
    parser.add_argument("--batch-size", type=int, default=4096)
    parser.add_argument("--probe-api", action="store_true")
    parser.add_argument(
        "--probe-batch-size", type=int, default=OPENALEX_MAX_BATCH_SIZE
    )
    parser.add_argument("--timeout-seconds", type=float, default=60)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.batch_size < 1:
        raise SystemExit("--batch-size must be positive")
    if not 1 <= args.probe_batch_size <= OPENALEX_MAX_BATCH_SIZE:
        raise SystemExit(
            f"--probe-batch-size must be between 1 and {OPENALEX_MAX_BATCH_SIZE}"
        )

    settings = RetrievalSettings.from_env()
    if args.artifacts_dir:
        settings = settings.with_artifacts_dir(args.artifacts_dir)
    output_dir = settings.artifacts_dir / "enrichment-v3.3-preflight"
    targets_path = args.targets_output or output_dir / "missing-targets-v3.2.jsonl"
    targets = write_missing_abstract_targets(
        settings,
        output_path=targets_path,
        batch_size=args.batch_size,
    )
    result: dict[str, object] = {"targets": targets}

    if args.probe_api:
        probe = run_openalex_probe(
            settings,
            targets_path=targets_path,
            output_dir=output_dir,
            batch_size=args.probe_batch_size,
            timeout_seconds=args.timeout_seconds,
            api_key=os.getenv("OPENALEX_API_KEY") or None,
        )
        result["probe"] = {
            "report_path": probe["report_path"],
            "response": probe["response"],
            "gate": probe["gate"],
        }

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
