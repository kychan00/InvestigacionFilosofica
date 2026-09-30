#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.service import RetrievalService

DEFAULT_QUERIES = Path("benchmark/semantic-retrieval/queries-v1.jsonl")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the internal semantic retrieval benchmark without labels."
    )
    parser.add_argument("--queries", type=Path, default=DEFAULT_QUERIES)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--artifacts-dir", type=Path)
    parser.add_argument("--mode", choices=("semantic", "hybrid"), default="semantic")
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--no-reranker", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RetrievalSettings.from_env()
    if args.artifacts_dir:
        settings = settings.with_artifacts_dir(args.artifacts_dir)

    queries = [
        json.loads(line)
        for line in args.queries.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    service = RetrievalService(settings)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with args.output.open("w", encoding="utf-8") as handle:
            for item in queries:
                method = (
                    service.search_semantic
                    if args.mode == "semantic"
                    else service.search_hybrid
                )
                results = method(
                    item["query"],
                    limit=args.limit,
                    enable_reranker=not args.no_reranker,
                )
                row = {
                    "schema_version": "semantic-retrieval-evaluation-v1",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "query_id": item["query_id"],
                    "query": item["query"],
                    "mode": args.mode,
                    "reranker_enabled": not args.no_reranker,
                    "results": [result.to_dict() for result in results],
                }
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    finally:
        service.close()


if __name__ == "__main__":
    main()
