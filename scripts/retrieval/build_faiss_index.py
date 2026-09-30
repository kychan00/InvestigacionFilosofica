#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.index_manager import FaissIndexBuilder, validate_current_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build or incrementally update FAISS from stored embeddings."
    )
    parser.add_argument(
        "--artifacts-dir", type=Path, help="Override RETRIEVAL_ARTIFACTS_DIR."
    )
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="Copy the active index and add only unseen vector IDs.",
    )
    parser.add_argument(
        "--validate-only", action="store_true", help="Validate the active bundle."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RetrievalSettings.from_env()
    if args.artifacts_dir:
        settings = settings.with_artifacts_dir(args.artifacts_dir)
    result = (
        validate_current_index(settings)
        if args.validate_only
        else FaissIndexBuilder(settings).build(incremental=args.incremental)
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
