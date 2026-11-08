#!/usr/bin/env python3
"""Fetch and verify only the pinned Qwen3 V4 metadata and cluster-ID assets.

A separate offline job must call build_ra12_vector_lookup.py after this prefetch.
No model weights, vectors.i8, FAISS, or live OpenAlex API are downloaded.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
import json
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError

from build_ra12_vector_lookup import LookupError, read_manifest, safe_file, verified_file


def asset_inventory(manifest: dict, sample_pages: int | None = None) -> list[dict]:
    pages = manifest["metadata"]["pages"]
    if sample_pages is not None:
        if not 1 <= sample_pages <= len(pages):
            raise LookupError("Sample page count out of range")
        return list(pages[:sample_pages])
    records = list(pages) + [item["ids"] for item in manifest["clusters"]]
    names = [record["path"] for record in records]
    if len(names) != len(set(names)):
        raise LookupError("Duplicate asset path in source manifest")
    return records


def fetch_with_retries(root: Path, record: dict, attempts: int) -> tuple[dict, bool]:
    destination = safe_file(root, record["path"])
    was_missing = not destination.exists()
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            verified_file(root, record, fetch_missing=True)
            return record, was_missing
        except (HTTPError, URLError, TimeoutError, ConnectionError, OSError) as error:
            last_error = error
        except LookupError as error:
            # If an existing/cached asset is corrupt, never silently overwrite it.
            if destination.is_file():
                raise
            last_error = error
        if attempt + 1 < attempts:
            time.sleep(min(2 ** attempt, 16))
    raise LookupError(f"Failed to fetch {record['path']} after {attempts} attempts: {last_error}")


def prefetch(manifest: dict, root: Path, workers: int, attempts: int, sample_pages: int | None) -> dict:
    if not 1 <= workers <= 16 or not 1 <= attempts <= 8:
        raise LookupError("workers must be 1..16 and attempts 1..8")
    records = asset_inventory(manifest, sample_pages)
    downloaded = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_with_retries, root, record, attempts): record for record in records}
        for future in as_completed(futures):
            item, was_missing = future.result()
            if was_missing:
                downloaded.append(item)
    return {
        "schemaVersion": "research-atlas-ra12b2-prefetch-report-v1",
        "status": "verified",
        "mode": "sample" if sample_pages is not None else "full-sources",
        "sourceManifestSha256": sha256(b"").hexdigest(),  # overwritten by caller
        "assetsVerified": len(records),
        "assetsFetched": len(downloaded),
        "assetBytesVerified": sum(item["bytes"] for item in records),
        "assetBytesFetchedExpected": sum(item["bytes"] for item in downloaded),
        "downloadedVectors": False,
        "downloadedModel": False,
        "productionChanged": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--attempts", type=int, default=4)
    parser.add_argument("--sample-pages", type=int)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    try:
        manifest, digest = read_manifest(args.manifest, synthetic_fixture=False)
        args.artifact_root.mkdir(parents=True, exist_ok=True)
        result = prefetch(manifest, args.artifact_root, args.workers, args.attempts, args.sample_pages)
        result["sourceManifestSha256"] = digest
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, sort_keys=True))
        return 0
    except (LookupError, OSError, HTTPError, URLError, ValueError, KeyError, TypeError) as error:
        print(f"RA12-B2 prefetch ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
