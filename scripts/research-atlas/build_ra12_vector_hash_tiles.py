#!/usr/bin/env python3
"""RA12-C2: build authenticated digest tiles from every pinned Qwen3 V4 int8 shard.

Offline release candidate ONLY. The generated manifest and ~14.5MB of digests
are NOT proof of Hugging Face publication or browser support. No model download.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import math
from pathlib import Path
import random
import shutil
import sys
import tempfile

from build_ra12_vector_lookup import (
    LookupError, SOURCE_REVISION, encode_json, read_manifest, verified_file, safe_file
)

DIMENSION = 1024
DIGEST_BYTES = 32
TILE_VECTORS = 64
SCHEMA = "research-atlas-ra12c2-vector-digest-tree-v1"


def canonical_json(value: dict) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_one_shard(root: Path, cluster: dict, fetch_missing: bool) -> tuple[int, bytes]:
    vectors = cluster["vectors"]
    index = cluster["cluster"]
    if vectors["path"] != f"clusters/cluster-{index:03d}.vectors.i8":
        raise LookupError("Unexpected V4 vectors path")
    if vectors["bytes"] != cluster["count"] * DIMENSION:
        raise LookupError("Vector file does not match 1024-dimensional count")
    checked = verified_file(root, vectors, fetch_missing=fetch_missing)
    data = checked.read_bytes()
    if len(data) != vectors["bytes"]:
        raise LookupError("Verified shard changed size")
    return index, data


def build_cluster(cluster: dict, data: bytes, staging: Path) -> dict:
    index = cluster["cluster"]
    count = cluster["count"]
    if len(data) != count * DIMENSION:
        raise LookupError(f"Shard dimension mismatch: {index}")
    digests = bytearray(count * DIGEST_BYTES)
    for ordinal in range(count):
        digest = hashlib.sha256(data[ordinal * DIMENSION:(ordinal + 1) * DIMENSION]).digest()
        digests[ordinal * DIGEST_BYTES:(ordinal + 1) * DIGEST_BYTES] = digest
    digest_path = f"digests/cluster-{index:03d}.sha256.bin"
    safe_file(staging, digest_path).parent.mkdir(parents=True, exist_ok=True)
    safe_file(staging, digest_path).write_bytes(digests)
    tiles = []
    for tile in range(math.ceil(count / TILE_VECTORS)):
        first = tile * TILE_VECTORS
        last = min(count, first + TILE_VECTORS)
        offset = first * DIGEST_BYTES
        chunk = digests[offset:last * DIGEST_BYTES]
        tiles.append({
            "tile": tile, "firstOrdinal": first, "count": last - first,
            "startByte": offset, "endByte": last * DIGEST_BYTES - 1,
            "bytes": len(chunk), "sha256": sha(chunk)
        })
    cluster_index = {
        "schemaVersion": "research-atlas-ra12c2-cluster-index-v1",
        "cluster": index, "count": count, "vectorDimension": DIMENSION,
        "digestBytes": DIGEST_BYTES, "tileVectors": TILE_VECTORS,
        "sourceVectorSha256": cluster["vectors"]["sha256"],
        "digests": {"path": digest_path, "bytes": len(digests), "sha256": sha(digests)},
        "tiles": tiles
    }
    index_path = f"indexes/cluster-{index:03d}.json"
    index_contents = canonical_json(cluster_index)
    safe_file(staging, index_path).parent.mkdir(parents=True, exist_ok=True)
    safe_file(staging, index_path).write_bytes(index_contents)
    return {
        "cluster": index, "count": count,
        "index": {"path": index_path, "bytes": len(index_contents), "sha256": sha(index_contents)},
        "digests": {"path": digest_path, "bytes": len(digests), "sha256": sha(digests)},
        "tileCount": len(tiles)
    }


def scenario_locations(manifest: dict, size: int, mode: str) -> list[tuple[int, int]]:
    clusters = manifest["clusters"]
    if mode == "clustered":
        record = max(clusters, key=lambda c: (c["count"], -c["cluster"]))
        if record["count"] < size:
            raise LookupError("No cluster can represent clustered budget scenario")
        # These are real vector positions, but NOT a live SearchResponse cohort.
        return [(record["cluster"], i) for i in range(size)]
    if mode != "dispersed":
        raise LookupError("Unknown budget scenario")
    if len(clusters) < size:
        raise LookupError("Cannot produce dispersed scenario from fewer clusters")
    chosen = [clusters[(i * len(clusters)) // size] for i in range(size)]
    return [(item["cluster"], (item["cluster"] * 7919 + 1049) % item["count"])
            for item in chosen]


def model_budgets(manifest: dict, source_index: dict, total_manifest_bytes: int) -> dict:
    by_cluster = {entry["cluster"]: entry for entry in source_index["clusters"]}
    samples = []
    for mode in ("clustered", "dispersed"):
        for n in (5, 20, 50):
            positions = scenario_locations(manifest, n, mode)
            clusters = sorted({c for c, _ in positions})
            tile_positions = sorted({(c, ordinal // TILE_VECTORS) for c, ordinal in positions})
            unique_index_bytes = sum(by_cluster[c]["index"]["bytes"] for c in clusters)
            digest_bytes = sum(
                min(TILE_VECTORS, manifest["clusters"][c]["count"] - t * TILE_VECTORS) * DIGEST_BYTES
                for c, t in tile_positions
            )
            vector_bytes = len(positions) * DIMENSION
            samples.append({
                "cohort": mode + "-" + str(n), "type": "simulated-existing-vector-locations",
                "notRealFederatedSearchResults": True,
                "works": n, "uniqueClusters": len(clusters), "uniqueHashTiles": len(tile_positions),
                "coldHttpRequestsModeled": 1 + len(clusters) + len(tile_positions) + n,
                "payloadBytesManifest": total_manifest_bytes,
                "payloadBytesClusterIndexes": unique_index_bytes,
                "payloadBytesDigestTiles": digest_bytes,
                "payloadBytesVectorSlices": vector_bytes,
                "modeledColdPayloadBytes": total_manifest_bytes + unique_index_bytes + digest_bytes + vector_bytes,
                "modeledWarmPayloadBytes": vector_bytes,
                "excludesHttpHeadersRedirectsTlsAndBrowserCache": True
            })
    return {
        "schemaVersion": "research-atlas-ra12c2-payload-budget-model-v1",
        "status": "modeled-not-measured",
        "source": "real-verified-V4-cluster-counts-and-generated-index-sizes",
        "scenarios": samples,
        "networkP95Measured": False,
        "browserRangeForPublishedDigestsVerified": False,
        "realFederatedSearchResponseJoinCoverageMeasured": False
    }


def build(manifest: dict, manifest_sha: str, source_root: Path, output: Path,
          workers: int, fetch_missing: bool, fixture: bool) -> tuple[dict, dict]:
    if output.exists():
        raise LookupError("Output directory already exists")
    if workers < 1 or workers > 10:
        raise LookupError("workers must be 1..10")
    if manifest["dimension"] != DIMENSION or manifest["quantization"]["dtype"] != "int8":
        raise LookupError("Not V4 int8 1024-dimensional corpus")
    clusters = manifest["clusters"]
    staging = Path(tempfile.mkdtemp(prefix="ra12c2-staging-", dir=output.parent))
    try:
        records = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            tasks = {
                pool.submit(load_one_shard, source_root, cluster, fetch_missing): cluster
                for cluster in clusters
            }
            for future in as_completed(tasks):
                index, content = future.result()
                records.append(build_cluster(clusters[index], content, staging))
        records.sort(key=lambda item: item["cluster"])
        if [item["cluster"] for item in records] != list(range(len(clusters))):
            raise LookupError("Missing or reordered cluster")
        if sum(item["count"] for item in records) != manifest["document_count"]:
            raise LookupError("Incomplete full document vector count")
        manifest_out = {
            "schemaVersion": SCHEMA,
            "status": "generated-unpublished-fixture" if fixture else "generated-unpublished",
            "source": {
                "repository": "CristianPelayo/openalex-philosophy",
                "revision": SOURCE_REVISION,
                "manifestSha256": manifest_sha,
                "vectorShardsSourceSha256Verified": True
            },
            "dimension": DIMENSION, "hashAlgorithm": "SHA-256",
            "digestBytes": DIGEST_BYTES, "tileVectors": TILE_VECTORS,
            "documentCount": manifest["document_count"],
            "clusterCount": len(clusters),
            "tileCount": sum(item["tileCount"] for item in records),
            "digestsBytes": sum(item["digests"]["bytes"] for item in records),
            "clusterIndexBytes": sum(item["index"]["bytes"] for item in records),
            "clusters": records,
            "productionEnabled": False,
            "publishedToHf": False
        }
        content = canonical_json(manifest_out)
        (staging / "hash-manifest.json").write_bytes(content)
        budget = model_budgets(manifest, manifest_out, len(content)) if len(clusters) >= 50 else {
            "status": "fixture-not-a-real-budget-model"
        }
        (staging / "budget-model.json").write_bytes(canonical_json(budget))
        staging.rename(output)
        return manifest_out, budget
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--source-root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--workers", type=int, default=6)
    p.add_argument("--fetch-missing", action="store_true")
    p.add_argument("--fixture", action="store_true", help="Test only, cannot be published")
    args = p.parse_args()
    try:
        if args.fixture and args.fetch_missing:
            raise LookupError("Synthetic fixture cannot fetch from HF")
        manifest, digest = read_manifest(args.manifest, args.fixture)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        artifact, budget = build(manifest, digest, args.source_root, args.output,
                                 args.workers, args.fetch_missing, args.fixture)
        print(json.dumps({
            "status": artifact["status"],
            "sourceCount": artifact["documentCount"],
            "clusters": artifact["clusterCount"],
            "tiles": artifact["tileCount"],
            "digestBytes": artifact["digestsBytes"],
            "indexBytes": artifact["clusterIndexBytes"],
            "payloadModelCount": len(budget.get("scenarios", [])),
            "published": False
        }, sort_keys=True))
        return 0
    except (LookupError, OSError, ValueError, KeyError, TypeError) as e:
        print("RA12-C2 digest build ERROR:", e, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
