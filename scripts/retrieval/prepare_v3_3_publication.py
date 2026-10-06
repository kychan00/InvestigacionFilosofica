#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.abstract_enrichment import _atomic_json, sha256_file


def main() -> None:
    root = Path("artifacts/semantic-retrieval")
    corpus = root / "v3.3" / "philosophy-corpus-v3-3-full.parquet"
    corpus_metadata = corpus.with_suffix(".metadata.json")
    capture_dir = root / "enrichment-v3.3-api-capture"
    capture = capture_dir / "openalex-abstract-capture.jsonl"
    capture_manifest = capture_dir / "manifest.json"
    capture_archive = capture_dir / "openalex-api-capture-batches.tar.gz"
    output = root / "v3.3" / "publication-manifest.json"

    build = json.loads(corpus_metadata.read_text(encoding="utf-8"))
    capture_meta = json.loads(capture_manifest.read_text(encoding="utf-8"))
    if not build.get("gate", {}).get("publication_allowed"):
        raise SystemExit("Local V3.3 build has not passed its publication gate")
    if capture_meta.get("status") != "complete":
        raise SystemExit("OpenAlex API capture is incomplete")
    if build["output"]["sha256"] != sha256_file(corpus):
        raise SystemExit("V3.3 corpus hash mismatch")
    if capture_meta["capture"]["sha256"] != sha256_file(capture):
        raise SystemExit("OpenAlex capture hash mismatch")

    files = [
        (
            corpus,
            "v3.3/philosophy-corpus-v3-3-full.parquet",
        ),
        (
            corpus_metadata,
            "v3.3/philosophy-corpus-v3-3-full.metadata.json",
        ),
        (
            capture,
            "v3.3/lineage/openalex-abstract-capture.jsonl",
        ),
        (
            capture_manifest,
            "v3.3/lineage/openalex-api-capture.manifest.json",
        ),
        (
            capture_archive,
            "v3.3/lineage/openalex-api-capture-batches.tar.gz",
        ),
    ]
    manifest = {
        "schema_version": "semantic-v3.3-publication-manifest-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_repo": "CristianPelayo/openalex-philosophy",
        "base_revision": "09c329326ed24ccf986c4b4c47c9794f055516dc",
        "target_revision": None,
        "files": [
            {
                "local_path": str(local_path),
                "remote_path": remote_path,
                "size_bytes": local_path.stat().st_size,
                "sha256": sha256_file(local_path),
            }
            for local_path, remote_path in files
        ],
        "gates": {
            "local_build_validated": True,
            "publication_allowed": True,
            "mass_embedding_build_allowed": False,
        },
    }
    _atomic_json(output, manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
