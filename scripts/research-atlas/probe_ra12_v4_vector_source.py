#!/usr/bin/env python3
"""RA12-C1: fetch two smallest pinned V4 vector shards and derive exact 1KB SHA proofs.

This is an isolated GitHub Actions experiment, never a browser data loader.
Capped source traffic: <= 2 MB; no model weights, FAISS or other cluster reads.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
from urllib.request import Request, urlopen

from build_ra12_vector_lookup import read_manifest, SOURCE_BASE_URL

MAX_BYTES = 2_000_000
DIMENSION = 1024


def cosine(a: bytes, b: bytes) -> float:
    va = struct.unpack("1024b", a)
    vb = struct.unpack("1024b", b)
    aa, bb, dot = 0, 0, 0
    for x, y in zip(va, vb):
        aa += x * x
        bb += y * y
        dot += x * y
    if not aa or not bb:
        raise ValueError("Cannot evaluate cosine on a zero-norm source vector")
    return dot / math.sqrt(aa * bb)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(manifest_path: Path) -> dict:
    manifest, manifest_sha = read_manifest(manifest_path, synthetic_fixture=False)
    if manifest["dimension"] != DIMENSION:
        raise ValueError("Invalid V4 dimension")
    selected = sorted(manifest["clusters"], key=lambda x: (x["vectors"]["bytes"], x["cluster"]))[:2]
    total_bytes = sum(cluster["vectors"]["bytes"] for cluster in selected)
    if total_bytes > MAX_BYTES:
        raise ValueError("Experiment shard download exceeds source budget")
    results = []
    raw = {}
    for record in selected:
        vectors = record["vectors"]
        url = SOURCE_BASE_URL + "/" + vectors["path"]
        request = Request(url, headers={
            "User-Agent": "ResearchAtlas-RA12C1-Integrity-Probe/1.0",
            "Accept-Encoding": "identity"
        })
        with urlopen(request, timeout=90) as response:
            data = response.read(vectors["bytes"] + 1)
        if len(data) != vectors["bytes"] or sha256(data) != vectors["sha256"]:
            raise ValueError("Cluster vector shard SHA/bytes mismatch: " + vectors["path"])
        ordinals = sorted({0, record["count"] // 2, record["count"] - 1})
        for ordinal in ordinals:
            start = ordinal * DIMENSION
            end = start + DIMENSION - 1
            fragment = data[start:end+1]
            if len(fragment) != DIMENSION:
                raise ValueError("V4 vector offset mismatch")
            p = {
                "cluster": record["cluster"],
                "ordinal": ordinal,
                "start": start,
                "end": end,
                "total": vectors["bytes"],
                "clusterCount": record["count"],
                "vectorId": None,  # source IDs not required for transport experiment
                "shard": vectors["path"],
                "shardSha256": vectors["sha256"],
                "sliceSha256": sha256(fragment)
            }
            results.append(p)
            raw[len(results)-1] = fragment
    # Fixed reference cosine calculations from independently source-SHA-verified bytes.
    pairs = [(0, 1), (0, 3), (2, 5)]
    comparisons = [{"indices": [a, b], "referenceCosine": cosine(raw[a], raw[b])} for a, b in pairs]
    return {
        "schemaVersion": "research-atlas-ra12c1-full-shard-reference-v1",
        "status": "sha256-verified-reference",
        "sourceRevision": "5a4a195085de54bf607a6c4397092ffb32716dcc",
        "sourceManifestSha256": manifest_sha,
        "dimension": DIMENSION,
        "selectedClusters": [record["cluster"] for record in selected],
        "wholeShardsSha256Verified": True,
        "wholeShardsTotalBytes": total_bytes,
        "sliceCount": len(results),
        "probes": results,
        "quantizedCosineReference": comparisons,
        "modelWeightsDownloaded": False,
        "productionEnabled": False
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.manifest)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"],
                      "clusters": result["selectedClusters"],
                      "sourceBytes": result["wholeShardsTotalBytes"],
                      "sliceCount": result["sliceCount"]}, sort_keys=True))


if __name__ == "__main__":
    main()
