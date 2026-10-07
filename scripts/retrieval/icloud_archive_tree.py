#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from semantic_retrieval.icloud_archive import (
    SwiftICloudController,
    roundtrip_archive,
    write_receipt,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Roundtrip every closed file in a tree through iCloud."
    )
    parser.add_argument("source_root", type=Path)
    parser.add_argument("--icloud-root", type=Path, required=True)
    parser.add_argument("--target-prefix", type=Path, required=True)
    parser.add_argument("--receipt-root", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--keep-downloaded", action="store_true")
    parser.add_argument("--move-source", action="store_true")
    parser.add_argument(
        "--swift-helper",
        type=Path,
        default=Path(__file__).with_name("icloud_file.swift"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_root = args.source_root.resolve(strict=True)
    if not source_root.is_dir():
        raise ValueError("source_root must be a directory")
    files = sorted(item for item in source_root.rglob("*") if item.is_file())
    if not files:
        raise ValueError("source_root contains no files")

    controller = SwiftICloudController(args.swift_helper)
    receipts = []
    for source in files:
        relative = source.relative_to(source_root)
        result = roundtrip_archive(
            source,
            icloud_root=args.icloud_root,
            relative_target=args.target_prefix / relative,
            controller=controller,
            timeout_seconds=args.timeout_seconds,
            evict_after_verify=not args.keep_downloaded,
            move_source=args.move_source,
        )
        receipt_path = args.receipt_root / relative.parent / f"{relative.name}.json"
        write_receipt(receipt_path, result)
        receipts.append(result)
        print(
            json.dumps(
                {
                    "stage": "roundtrip_complete",
                    "file": str(relative),
                    "size_bytes": result["size_bytes"],
                    "sha256": result["sha256"],
                },
                ensure_ascii=False,
            ),
            flush=True,
        )

    summary = {
        "schema_version": "semantic-retrieval-icloud-tree-roundtrip-v1",
        "source_root": str(source_root),
        "icloud_root": str(args.icloud_root.resolve(strict=True)),
        "target_prefix": str(args.target_prefix),
        "file_count": len(receipts),
        "total_bytes": sum(item["size_bytes"] for item in receipts),
        "all_uploads_confirmed": all(item["upload_confirmed"] for item in receipts),
        "all_downloads_confirmed": all(
            item["download_confirmed"] for item in receipts
        ),
        "all_roundtrip_hashes_equal": all(
            item["roundtrip_hash_equal"] for item in receipts
        ),
        "evicted_after_verify": not args.keep_downloaded,
        "sources_moved": args.move_source,
        "files": [
            {
                "target": item["icloud_target"],
                "size_bytes": item["size_bytes"],
                "sha256": item["sha256"],
            }
            for item in receipts
        ],
    }
    write_receipt(args.receipt_root / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
