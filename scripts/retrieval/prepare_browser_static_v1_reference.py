#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.embeddings import SentenceTransformerEmbeddingBackend


QUERY_SHA256 = "595da8eae92f48c0b05e88ff02256085590aa7e2bf41a4a919499aaaa8df3b16"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--queries",
        type=Path,
        default=Path("benchmark/semantic-retrieval/queries-v1.jsonl"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            "artifacts/semantic-retrieval/browser-static-v1/reference-embeddings.json"
        ),
    )
    args = parser.parse_args()

    if sha256_file(args.queries) != QUERY_SHA256:
        raise RuntimeError("Frozen query-set hash mismatch")
    queries = [
        json.loads(line)
        for line in args.queries.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    settings = RetrievalSettings.from_env()
    backend = SentenceTransformerEmbeddingBackend(settings)
    rows = []
    for item in queries:
        vector = np.asarray(backend.encode_query(item["query"]), dtype=np.float32)
        if vector.shape != (1024,) or not np.all(np.isfinite(vector)):
            raise RuntimeError(f"Invalid reference embedding: {item['query_id']}")
        rows.append(
            {
                "query_id": item["query_id"],
                "query": item["query"],
                "embedding": vector.tolist(),
            }
        )

    payload = {
        "schema_version": "qwen3-browser-semantic-reference-embeddings-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": settings.embedding_model,
        "revision": settings.embedding_model_revision,
        "device": settings.device,
        "queries": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": "complete", "queries": len(rows), "output": str(args.output)}))


if __name__ == "__main__":
    main()
