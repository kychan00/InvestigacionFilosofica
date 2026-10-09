#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.corpus_enrichment import build_enriched_corpus

FROZEN_TARGET_SHA256 = (
    "5f8b3e278200bd002418c8b0174ee323fbecbf495a25e7d45f21c6df8b2862ab"
)
FROZEN_V3_2_SHA256 = (
    "81f39d5ae5ea192897a7c3cd405b3b0a3494a032658895219c7906e5f34e93c0"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build V3.3 by filling only missing V3.2 abstracts."
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
        "--capture-dir",
        type=Path,
        default=Path("artifacts/semantic-retrieval/enrichment-v3.3-api-capture"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            "artifacts/semantic-retrieval/v3.3/"
            "philosophy-corpus-v3-3-full.parquet"
        ),
    )
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--batch-size", type=int, default=65_536)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.batch_size < 1:
        raise SystemExit("--batch-size must be positive")
    metadata_path = args.metadata or args.output.with_suffix(".metadata.json")
    metadata = build_enriched_corpus(
        RetrievalSettings.from_env(),
        targets_path=args.targets,
        capture_path=args.capture_dir / "openalex-abstract-capture.jsonl",
        capture_manifest_path=args.capture_dir / "manifest.json",
        expected_targets_sha256=FROZEN_TARGET_SHA256,
        expected_source_sha256=FROZEN_V3_2_SHA256,
        output_path=args.output,
        metadata_path=metadata_path,
        batch_size=args.batch_size,
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
