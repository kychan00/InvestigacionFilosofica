#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.models import SearchFilters
from semantic_retrieval.service import RetrievalService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search the local semantic index.")
    parser.add_argument("query")
    parser.add_argument("--mode", choices=("semantic", "hybrid"), default="semantic")
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--artifacts-dir", type=Path)
    reranker = parser.add_mutually_exclusive_group()
    reranker.add_argument(
        "--reranker",
        dest="enable_reranker",
        action="store_true",
        help="Opt in to the configured Qwen reranker for this local search.",
    )
    reranker.add_argument(
        "--no-reranker",
        dest="enable_reranker",
        action="store_false",
        help="Disable reranking even when ENABLE_RERANKER is true.",
    )
    parser.set_defaults(enable_reranker=None)
    parser.add_argument("--year-from", type=int)
    parser.add_argument("--year-to", type=int)
    parser.add_argument("--language", action="append", default=[])
    parser.add_argument("--source", action="append", default=[])
    parser.add_argument("--author")
    parser.add_argument("--journal")
    parser.add_argument("--topic")
    parser.add_argument("--publication-type", action="append", default=[])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RetrievalSettings.from_env()
    if args.artifacts_dir:
        settings = settings.with_artifacts_dir(args.artifacts_dir)
    filters = SearchFilters(
        year_from=args.year_from,
        year_to=args.year_to,
        author=args.author,
        languages=tuple(args.language),
        journal=args.journal,
        sources=tuple(args.source),
        topic=args.topic,
        publication_types=tuple(args.publication_type),
    )
    service = RetrievalService(settings)
    try:
        method = (
            service.search_semantic
            if args.mode == "semantic"
            else service.search_hybrid
        )
        results = method(
            args.query,
            limit=args.limit,
            filters=filters,
            enable_reranker=args.enable_reranker,
        )
        reranker_enabled = (
            settings.enable_reranker
            if args.enable_reranker is None
            else args.enable_reranker
        )
        print(
            json.dumps(
                {
                    "query": args.query,
                    "mode": args.mode,
                    "reranker_enabled": reranker_enabled,
                    "results": [result.to_dict() for result in results],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    finally:
        service.close()


if __name__ == "__main__":
    main()
