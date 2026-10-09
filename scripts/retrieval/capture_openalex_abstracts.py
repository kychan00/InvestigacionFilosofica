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
    capture_openalex_abstracts,
)

FROZEN_TARGET_SHA256 = (
    "5f8b3e278200bd002418c8b0174ee323fbecbf495a25e7d45f21c6df8b2862ab"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture missing V3.2 abstracts from OpenAlex in resumable batches."
    )
    parser.add_argument(
        "--targets",
        type=Path,
        default=Path(
            "artifacts/semantic-retrieval/enrichment-v3.3-preflight/"
            "missing-targets-v3.2.jsonl"
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("artifacts/semantic-retrieval/enrichment-v3.3-api-capture"),
    )
    parser.add_argument("--batch-size", type=int, default=OPENALEX_MAX_BATCH_SIZE)
    parser.add_argument("--timeout-seconds", type=float, default=60)
    parser.add_argument("--max-retries", type=int, default=5)
    parser.add_argument("--request-delay-seconds", type=float, default=0.05)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--all",
        action="store_true",
        help="Run or resume all 2,444 frozen batches.",
    )
    mode.add_argument(
        "--max-new-batches",
        type=int,
        help="Bound this invocation to a positive number of previously absent batches.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.max_new_batches is not None and args.max_new_batches < 1:
        raise SystemExit("--max-new-batches must be positive")
    if args.max_retries < 0:
        raise SystemExit("--max-retries cannot be negative")
    api_key = os.getenv("OPENALEX_API_KEY")
    if not api_key:
        raise SystemExit("OPENALEX_API_KEY is required and must not be committed")

    manifest = capture_openalex_abstracts(
        targets_path=args.targets,
        output_dir=args.output_dir,
        expected_targets_sha256=FROZEN_TARGET_SHA256,
        api_key=api_key,
        batch_size=args.batch_size,
        timeout_seconds=args.timeout_seconds,
        max_retries=args.max_retries,
        max_new_batches=None if args.all else args.max_new_batches,
        request_delay_seconds=args.request_delay_seconds,
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
