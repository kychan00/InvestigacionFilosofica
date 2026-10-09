#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.embedding_store import EmbeddingStoreBuilder


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Qwen3 embeddings for new documents in the pinned corpus."
    )
    parser.add_argument(
        "--artifacts-dir", type=Path, help="Override RETRIEVAL_ARTIFACTS_DIR."
    )
    parser.add_argument(
        "--limit", type=int, help="Process at most N eligible documents (smoke tests)."
    )
    parser.add_argument("--source-batch-size", type=int, default=512)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RetrievalSettings.from_env()
    if args.artifacts_dir:
        settings = settings.with_artifacts_dir(args.artifacts_dir)
    print(
        json.dumps(
            {
                "stage": "start",
                "dataset": settings.dataset_repo,
                "dataset_revision": settings.dataset_revision,
                "embedding_model": settings.embedding_model,
                "embedding_model_revision": settings.embedding_model_revision,
                "artifacts_dir": str(settings.artifacts_dir),
                "limit": args.limit,
            },
            ensure_ascii=False,
        ),
        file=sys.stderr,
        flush=True,
    )
    result = EmbeddingStoreBuilder(settings).build(
        limit=args.limit,
        source_batch_size=args.source_batch_size,
        progress=lambda event: print(
            json.dumps(event, ensure_ascii=False),
            file=sys.stderr,
            flush=True,
        ),
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
