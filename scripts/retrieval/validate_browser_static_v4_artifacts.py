#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np


EXPECTED_SCHEMA = "qwen3-browser-semantic-static-artifacts-v4"
EXPECTED_DOCUMENT_COUNT = 451823
EXPECTED_DIMENSION = 1024
EXPECTED_CLUSTERS = 256
EXPECTED_NPROBE = 32
EXPECTED_FAISS_SHA256 = (
    "31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68"
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(root: Path, record: dict[str, Any]) -> Path:
    path = root / record["path"]
    if not path.is_file():
        raise RuntimeError(f"Missing artifact: {record['path']}")
    if path.stat().st_size != record["bytes"]:
        raise RuntimeError(f"Size mismatch: {record['path']}")
    if sha256_file(path) != record["sha256"]:
        raise RuntimeError(f"SHA-256 mismatch: {record['path']}")
    return path


def stable_topk(scores: np.ndarray, ids: np.ndarray, limit: int) -> np.ndarray:
    return ids[np.lexsort((ids, -scores))[:limit]]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", type=Path, required=True)
    parser.add_argument("--browser-embeddings", type=Path, required=True)
    parser.add_argument("--expected-result", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest_path = args.artifact_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest["schema_version"] != EXPECTED_SCHEMA:
        raise RuntimeError("Manifest schema mismatch")
    if manifest["document_count"] != EXPECTED_DOCUMENT_COUNT:
        raise RuntimeError("Document count mismatch")
    if manifest["dimension"] != EXPECTED_DIMENSION:
        raise RuntimeError("Dimension mismatch")
    if manifest["source"]["faiss_sha256"] != EXPECTED_FAISS_SHA256:
        raise RuntimeError("Source FAISS lineage mismatch")
    if manifest["routing"]["cluster_count"] != EXPECTED_CLUSTERS:
        raise RuntimeError("Cluster count mismatch")
    if manifest["routing"]["nprobe"] != EXPECTED_NPROBE:
        raise RuntimeError("nprobe mismatch")

    centroid_path = verify_file(args.artifact_dir, manifest["centroids"])
    centroids = np.fromfile(centroid_path, dtype="<f4")
    if centroids.size != EXPECTED_CLUSTERS * EXPECTED_DIMENSION:
        raise RuntimeError("Centroid shape mismatch")
    centroids = centroids.reshape(EXPECTED_CLUSTERS, EXPECTED_DIMENSION)

    all_ids = []
    cluster_data: dict[int, tuple[np.ndarray, np.ndarray]] = {}
    for expected_cluster, record in enumerate(manifest["clusters"]):
        if record["cluster"] != expected_cluster:
            raise RuntimeError("Cluster order mismatch")
        ids_path = verify_file(args.artifact_dir, record["ids"])
        vectors_path = verify_file(args.artifact_dir, record["vectors"])
        ids = np.fromfile(ids_path, dtype="<u4")
        vectors = np.fromfile(vectors_path, dtype=np.int8)
        if len(ids) != record["count"]:
            raise RuntimeError(f"ID count mismatch in cluster {expected_cluster}")
        if vectors.size != len(ids) * EXPECTED_DIMENSION:
            raise RuntimeError(f"Vector shape mismatch in cluster {expected_cluster}")
        if len(ids) and not np.all(ids[:-1] < ids[1:]):
            raise RuntimeError(f"Unsorted IDs in cluster {expected_cluster}")
        all_ids.append(ids)
        cluster_data[expected_cluster] = (
            ids.astype(np.int64),
            vectors.reshape(len(ids), EXPECTED_DIMENSION),
        )
    ordered_ids = np.sort(np.concatenate(all_ids).astype(np.int64))
    if not np.array_equal(ordered_ids, np.arange(EXPECTED_DOCUMENT_COUNT)):
        raise RuntimeError("Cluster IDs are not a complete unique corpus partition")

    expected_next_id = 0
    metadata_rows = 0
    for page_number, record in enumerate(manifest["metadata"]["pages"]):
        page_path = verify_file(args.artifact_dir, record)
        with gzip.open(page_path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle]
        ids = [row["vector_id"] for row in rows]
        expected = list(range(expected_next_id, expected_next_id + len(rows)))
        if ids != expected:
            raise RuntimeError(f"Metadata vector ID sequence mismatch on page {page_number}")
        if len(rows) != record["count"]:
            raise RuntimeError(f"Metadata count mismatch on page {page_number}")
        if rows and (
            ids[0] != record["first_vector_id"] or ids[-1] != record["last_vector_id"]
        ):
            raise RuntimeError(f"Metadata bounds mismatch on page {page_number}")
        expected_next_id += len(rows)
        metadata_rows += len(rows)
    if metadata_rows != EXPECTED_DOCUMENT_COUNT:
        raise RuntimeError("Metadata corpus count mismatch")

    browser_payload = json.loads(args.browser_embeddings.read_text(encoding="utf-8"))
    expected_payload = json.loads(args.expected_result.read_text(encoding="utf-8"))
    expected_queries = {
        row["query_id"]: row for row in expected_payload["full_corpus_queries"]
    }
    query_results = []
    for row in browser_payload["queries"]:
        query = np.asarray(row["embedding"], dtype=np.float32)
        query /= np.linalg.norm(query)
        selected = stable_topk(
            centroids @ query, np.arange(EXPECTED_CLUSTERS, dtype=np.int64), EXPECTED_NPROBE
        )
        candidate_ids = np.concatenate([cluster_data[int(cluster)][0] for cluster in selected])
        candidate_vectors = np.concatenate(
            [cluster_data[int(cluster)][1] for cluster in selected], axis=0
        )
        scores = candidate_vectors.astype(np.float32) @ query / 127.0
        observed = stable_topk(scores, candidate_ids, 50)
        expected = expected_queries[row["query_id"]]
        if selected.tolist() != expected["selected_clusters"]:
            raise RuntimeError(f"Selected clusters changed for {row['query_id']}")
        if observed.tolist() != expected["observed_ids"]:
            raise RuntimeError(f"Observed ranking changed for {row['query_id']}")
        query_results.append(
            {
                "query_id": row["query_id"],
                "selected_clusters": selected.tolist(),
                "observed_ids": observed.tolist(),
                "candidate_count": len(candidate_ids),
            }
        )

    report = {
        "schema_version": "qwen3-browser-semantic-static-artifact-validation-v4",
        "status": "pass",
        "manifest_sha256": sha256_file(manifest_path),
        "document_count": EXPECTED_DOCUMENT_COUNT,
        "metadata_count": metadata_rows,
        "query_count": len(query_results),
        "queries": query_results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({key: report[key] for key in ("status", "manifest_sha256", "document_count", "query_count")}))


if __name__ == "__main__":
    main()
