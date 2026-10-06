#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.abstract_enrichment import probe_mearman_snapshot


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Measure whether selected work IDs can avoid reading most abstract "
            "text from a pinned Mearman/OpenAlex snapshot."
        )
    )
    parser.add_argument("--targets", type=Path, required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sample-count", type=int, default=8)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = probe_mearman_snapshot(
        targets_path=args.targets,
        revision=args.revision,
        output_path=args.output,
        sample_count=args.sample_count,
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "source": report["source"],
                "aggregate": report["aggregate"],
                "conclusion": report["conclusion"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
