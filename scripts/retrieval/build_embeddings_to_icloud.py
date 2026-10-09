#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.embedding_store import EmbeddingStoreBuilder
from semantic_retrieval.icloud_archive import (
    SwiftICloudController,
    roundtrip_archive,
    write_receipt,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate embeddings locally while moving every verified shard to "
            "iCloud and evicting its local copy."
        )
    )
    parser.add_argument("--artifacts-dir", type=Path, required=True)
    parser.add_argument("--icloud-root", type=Path, required=True)
    parser.add_argument("--target-prefix", type=Path, required=True)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--source-batch-size", type=int, default=2048)
    parser.add_argument("--timeout-seconds", type=int, default=3600)
    parser.add_argument(
        "--confirm-full-build",
        action="store_true",
        help="Required when --limit is omitted.",
    )
    return parser.parse_args()


def compile_helper(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["xcrun", "swiftc", "-O", str(source), "-o", str(destination)],
        check=True,
    )


def main() -> None:
    args = parse_args()
    if args.limit is None and not args.confirm_full_build:
        raise ValueError("--confirm-full-build is required when --limit is omitted")
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be positive")
    if args.source_batch_size <= 0:
        raise ValueError("--source-batch-size must be positive")

    settings = RetrievalSettings.from_env().with_artifacts_dir(args.artifacts_dir)
    script_dir = Path(__file__).resolve().parent
    helper = args.artifacts_dir / "tools" / "icloud_file"
    compile_helper(script_dir / "icloud_file.swift", helper)
    controller = SwiftICloudController(helper)
    receipt_root = args.artifacts_dir / "icloud-receipts"
    archived: list[dict] = []

    def archive_shard(shard_name: str) -> None:
        source = settings.embeddings_dir / "shards" / shard_name
        if not source.exists():
            return
        result = roundtrip_archive(
            source,
            icloud_root=args.icloud_root,
            relative_target=args.target_prefix / "embeddings" / "shards" / shard_name,
            controller=controller,
            timeout_seconds=args.timeout_seconds,
            evict_after_verify=True,
            move_source=True,
        )
        write_receipt(receipt_root / "shards" / f"{shard_name}.json", result)
        archived.append(result)
        print(
            json.dumps(
                {
                    "stage": "icloud_shard_complete",
                    "shard": shard_name,
                    "size_bytes": result["size_bytes"],
                    "sha256": result["sha256"],
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
            flush=True,
        )

    manifest_path = settings.embeddings_dir / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for shard in manifest.get("shards", []):
            archive_shard(Path(shard["file"]).name)

    def progress(event: dict) -> None:
        print(json.dumps(event, ensure_ascii=False), file=sys.stderr, flush=True)
        if event.get("stage") == "embedding_batch_complete":
            archive_shard(str(event["shard"]))

    result = EmbeddingStoreBuilder(settings).build(
        limit=args.limit,
        source_batch_size=args.source_batch_size,
        progress=progress,
    )

    for filename in ("manifest.json", "state.sqlite3"):
        source = settings.embeddings_dir / filename
        receipt = roundtrip_archive(
            source,
            icloud_root=args.icloud_root,
            relative_target=args.target_prefix / "embeddings" / filename,
            controller=controller,
            timeout_seconds=args.timeout_seconds,
            evict_after_verify=True,
            move_source=False,
        )
        write_receipt(receipt_root / f"{filename}.json", receipt)
        archived.append(receipt)

    summary = {
        "schema_version": "semantic-embeddings-icloud-build-v1",
        "dataset": {
            "repo": settings.dataset_repo,
            "revision": settings.dataset_revision,
            "file": settings.dataset_file,
        },
        "embedding": {
            "model": settings.embedding_model,
            "revision": settings.embedding_model_revision,
            "dimension": settings.embedding_dimension,
            "batch_size": settings.embedding_batch_size,
        },
        "limit": args.limit,
        "source_batch_size": args.source_batch_size,
        "build_result": result,
        "icloud": {
            "root": str(args.icloud_root.resolve(strict=True)),
            "target_prefix": str(args.target_prefix),
            "archived_files_this_run": len(archived),
            "archived_bytes_this_run": sum(item["size_bytes"] for item in archived),
            "all_roundtrip_hashes_equal": all(
                item["roundtrip_hash_equal"] for item in archived
            ),
            "all_evicted_after_verify": all(
                item["evicted_after_verify"] for item in archived
            ),
        },
    }
    write_receipt(receipt_root / "build-summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
