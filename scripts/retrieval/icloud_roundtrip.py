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
        description=(
            "Copy one closed artifact to iCloud, verify upload, evict, "
            "redownload, verify its hash, and optionally evict it again."
        )
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("--icloud-root", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument(
        "--keep-downloaded",
        action="store_true",
        help="Keep the verified local iCloud copy instead of evicting it again.",
    )
    parser.add_argument(
        "--move-source",
        action="store_true",
        help="Move the source into iCloud instead of retaining a local copy.",
    )
    parser.add_argument(
        "--swift-helper",
        type=Path,
        default=Path(__file__).with_name("icloud_file.swift"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = roundtrip_archive(
        args.source,
        icloud_root=args.icloud_root,
        relative_target=args.target,
        controller=SwiftICloudController(args.swift_helper),
        timeout_seconds=args.timeout_seconds,
        evict_after_verify=not args.keep_downloaded,
        move_source=args.move_source,
    )
    write_receipt(args.receipt, result)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
