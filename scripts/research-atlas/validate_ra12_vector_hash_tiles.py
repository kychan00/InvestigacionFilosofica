#!/usr/bin/env python3
"""RA12-C2: independent digest-tile integrity audit against actual V4 source files.

Reopens all 256 SHA-verified full vector shards from offline cache, rehashes all
451,823 individual 1024-byte vectors and validates tile offsets and hashes.
No network, no model, no publication, no production changes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

from build_ra12_vector_lookup import read_manifest, verified_file
from build_ra12_vector_hash_tiles import canonical_json, DIGEST_BYTES, DIMENSION, TILE_VECTORS, SCHEMA


def fail(message: str):
    raise ValueError(message)


def sha(buf: bytes) -> str:
    return hashlib.sha256(buf).hexdigest()


def verify(v4: dict, v4_sha: str, source_root: Path, output: Path, fixture: bool) -> dict:
    root = output / "hash-manifest.json"
    manifest = json.loads(root.read_text())
    if manifest.get("schemaVersion") != SCHEMA or manifest.get("status") != (
        "generated-unpublished-fixture" if fixture else "generated-unpublished"
    ):
        fail("Wrong RA12-C2 schema or non-publication status")
    if manifest.get("productionEnabled") is not False or manifest.get("publishedToHf") is not False:
        fail("Unexpectedly enabled/publication flags")
    if manifest["source"]["manifestSha256"] != v4_sha or (
        manifest["documentCount"], manifest["clusterCount"], manifest["dimension"],
        manifest["tileVectors"], manifest["digestBytes"]
    ) != (v4["document_count"], len(v4["clusters"]), DIMENSION, TILE_VECTORS, DIGEST_BYTES):
        fail("Source or digest tree contract mismatch")
    total_entries = total_bytes = total_tiles = total_index_bytes = 0
    inventory = manifest["clusters"]
    if len(inventory) != len(v4["clusters"]):
        fail("Missing cluster inventory")
    for pos, cluster in enumerate(v4["clusters"]):
        entry = inventory[pos]
        if cluster["cluster"] != pos or entry["cluster"] != pos or entry["count"] != cluster["count"]:
            fail("Cluster index order/count incorrect")
        idx_meta = entry["index"]
        idx_path = output / f"indexes/cluster-{pos:03d}.json"
        if idx_meta["path"] != idx_path.relative_to(output).as_posix():
            fail("Unexpected index path")
        idx_content = idx_path.read_bytes()
        if len(idx_content) != idx_meta["bytes"] or sha(idx_content) != idx_meta["sha256"]:
            fail("Index file byte/hash mismatch")
        index = json.loads(idx_content)
        if index.get("schemaVersion") != "research-atlas-ra12c2-cluster-index-v1":
            fail("Unexpected cluster index schema")
        if index["cluster"] != pos or index["count"] != cluster["count"] or (
            index["sourceVectorSha256"] != cluster["vectors"]["sha256"]
        ):
            fail("Source vector hash lineage mismatch")
        if (index["vectorDimension"], index["digestBytes"], index["tileVectors"]) != (
            DIMENSION, DIGEST_BYTES, TILE_VECTORS
        ):
            fail("Index dimension mismatch")
        digest_meta = entry["digests"]
        digest_path = output / f"digests/cluster-{pos:03d}.sha256.bin"
        if digest_meta["path"] != digest_path.relative_to(output).as_posix():
            fail("Unexpected digest path")
        digest_content = digest_path.read_bytes()
        if len(digest_content) != digest_meta["bytes"] or sha(digest_content) != digest_meta["sha256"]:
            fail("Digest file byte/hash mismatch")
        if digest_meta != index["digests"] or len(digest_content) != cluster["count"] * DIGEST_BYTES:
            fail("Cluster digest metadata mismatch")
        source_path = verified_file(source_root, cluster["vectors"], False)
        with source_path.open("rb") as file:
            for ordinal in range(cluster["count"]):
                source_vec = file.read(DIMENSION)
                if len(source_vec) != DIMENSION:
                    fail("Short V4 source vector")
                actual = hashlib.sha256(source_vec).digest()
                expected = digest_content[ordinal * DIGEST_BYTES:(ordinal + 1) * DIGEST_BYTES]
                if actual != expected:
                    fail(f"Corrupt vector digest: cluster={pos} ordinal={ordinal}")
            if file.read(1):
                fail("V4 source shard contains unexpected trailing bytes")
        tiles = index["tiles"]
        if len(tiles) != (cluster["count"] + TILE_VECTORS - 1) // TILE_VECTORS:
            fail("Incorrect digest tile count")
        for tile_no, tile in enumerate(tiles):
            first = tile_no * TILE_VECTORS
            last = min(first + TILE_VECTORS, cluster["count"])
            chunk = digest_content[first * DIGEST_BYTES:last * DIGEST_BYTES]
            if (tile["tile"], tile["firstOrdinal"], tile["count"], tile["startByte"],
                tile["endByte"], tile["bytes"]) != (
                    tile_no, first, last - first, first * DIGEST_BYTES,
                    last * DIGEST_BYTES - 1, len(chunk)
                ) or sha(chunk) != tile["sha256"]:
                fail(f"Digest tile integrity mismatch: cluster={pos}, tile={tile_no}")
        if len(tiles) != entry["tileCount"]:
            fail("Tile count per cluster disagreement")
        total_entries += cluster["count"]
        total_bytes += len(digest_content)
        total_index_bytes += len(idx_content)
        total_tiles += len(tiles)
    if (total_entries, total_bytes, total_tiles, total_index_bytes) != (
        manifest["documentCount"], manifest["digestsBytes"],
        manifest["tileCount"], manifest["clusterIndexBytes"]
    ):
        fail("Full digest totals disagree")
    if total_entries != v4["document_count"]:
        fail("Incomplete V4 vector digest coverage")
    return {
        "schemaVersion": "research-atlas-ra12c2-independent-vector-audit-v1",
        "status": "pass",
        "sourceRevision": manifest["source"]["revision"],
        "sourceManifestSha256": v4_sha,
        "hashManifestSha256": sha(root.read_bytes()),
        "verifiedVectorCount": total_entries,
        "verifiedDigestBytes": total_bytes,
        "verifiedClusterIndexes": len(v4["clusters"]),
        "verifiedHashTiles": total_tiles,
        "sourceShardsSha256Verified": True,
        "eachVectorDigestRecomputedFromSource": True,
        "browserTileRangeTested": False,
        "publishedToHf": False,
        "productionEnabled": False
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--source-root", required=True, type=Path)
    p.add_argument("--tree", required=True, type=Path)
    p.add_argument("--report", required=True, type=Path)
    p.add_argument("--fixture", action="store_true", help="Test-only reduced V4 source")
    args = p.parse_args()
    try:
        source, source_sha = read_manifest(args.manifest, args.fixture)
        result = verify(source, source_sha, args.source_root, args.tree, args.fixture)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_bytes(canonical_json(result))
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        print("RA12-C2 independent audit ERROR:", error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
