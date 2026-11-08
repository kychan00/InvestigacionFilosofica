#!/usr/bin/env python3
"""RA12-C2: explicit offline prefetch of 256 pinned int8 V4 vector shards.

May download 462,666,752 bytes from the already-public HF dataset.
Never downloads the model, centroids, FAISS, metadata pages, or search results.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import URLError, HTTPError

from build_ra12_vector_lookup import LookupError, read_manifest, verified_file


def fetch_one(root: Path, entry: dict, retries: int) -> tuple[int, bool]:
    size = entry["vectors"]["bytes"]
    target = root / entry["vectors"]["path"]
    missing = not target.exists()
    for attempt in range(retries):
        try:
            verified_file(root, entry["vectors"], fetch_missing=True)
            return size, missing
        except (HTTPError, URLError, TimeoutError, ConnectionError, OSError) as error:
            if attempt + 1 >= retries:
                raise LookupError(f"V4 download failed for cluster {entry['cluster']}: {error}") from error
            time.sleep(min(2 ** attempt, 12))
        except LookupError:
            # A cached corrupt file must never be overwritten silently.
            raise
    raise LookupError("Unreachable retry condition")


def prefetch(manifest: dict, root: Path, workers: int, retries: int) -> dict:
    if not 1 <= workers <= 10 or not 1 <= retries <= 8:
        raise LookupError("workers must be 1..10, retries 1..8")
    clusters = manifest["clusters"]
    if len(clusters) != 256 or manifest["dimension"] != 1024:
        raise LookupError("Not the published V4 vector layout")
    total = new_bytes = new_assets = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_one, root, record, retries): record["cluster"]
                   for record in clusters}
        for future in as_completed(futures):
            size, fetched = future.result()
            total += size
            if fetched:
                new_assets += 1
                new_bytes += size
    if total != 462_666_752:
        raise LookupError("Wrong total V4 vector bytes")
    return {
        "schemaVersion": "research-atlas-ra12c2-vector-source-prefetch-v1",
        "status": "sha256-verified",
        "verifiedVectorShards": len(clusters),
        "verifiedVectorBytes": total,
        "newAssetsFetched": new_assets,
        "newBytesFetched": new_bytes,
        "modelWeightsDownloaded": False,
        "faissDownloaded": False,
        "productionChanged": False,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--source-root", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--retries", type=int, default=4)
    args = p.parse_args()
    try:
        manifest, digest = read_manifest(args.manifest, synthetic_fixture=False)
        args.source_root.mkdir(parents=True, exist_ok=True)
        report = prefetch(manifest, args.source_root, args.workers, args.retries)
        report["sourceManifestSha256"] = digest
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
        print(json.dumps(report, sort_keys=True))
        return 0
    except (LookupError, OSError, ValueError, KeyError, TypeError) as error:
        print("RA12-C2 vector prefetch ERROR:", error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
