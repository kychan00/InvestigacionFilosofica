#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


PREREGISTRATION = Path(
    "benchmark/semantic-retrieval/browser-static-v3/preregistration.json"
)
EXPECTED_FAISS_SHA256 = (
    "31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68"
)
EXPECTED_QUERY_SHA256 = (
    "595da8eae92f48c0b05e88ff02256085590aa7e2bf41a4a919499aaaa8df3b16"
)
DIMENSION = 256
SAMPLE_DOCUMENTS = 32768
TRAINING_DOCUMENTS = 65536
CLUSTERS = 256
NPROBE = 32
TOP_K = 50
SEED = 20261010
ITERATIONS = 20


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized_prefix(values: np.ndarray) -> np.ndarray:
    output = np.asarray(values[..., :DIMENSION], dtype=np.float32)
    norms = np.linalg.norm(output, axis=-1, keepdims=True)
    norms[norms == 0] = 1.0
    return np.ascontiguousarray(output / norms, dtype=np.float32)


def quantize(values: np.ndarray) -> np.ndarray:
    return np.rint(np.clip(values, -1.0, 1.0) * 127.0).astype(np.int8)


def stable_topk(scores: np.ndarray, ids: np.ndarray, limit: int) -> tuple[np.ndarray, np.ndarray]:
    chosen = np.lexsort((ids, -scores))[:limit]
    return ids[chosen], scores[chosen]


def recall(expected: np.ndarray, observed: np.ndarray, limit: int) -> float:
    return len(set(map(int, expected[:limit])) & set(map(int, observed[:limit]))) / limit


def load_query_vectors(path: Path) -> tuple[list[dict[str, Any]], np.ndarray]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload["queries"]
    vectors = np.asarray([row["embedding"] for row in rows], dtype=np.float32)
    if vectors.shape != (5, 1024) or not np.all(np.isfinite(vectors)):
        raise RuntimeError(f"Invalid query embeddings in {path}")
    return rows, vectors


def exact_sample_results(
    sample_vectors: np.ndarray,
    sample_ids: np.ndarray,
    reference_queries: np.ndarray,
) -> list[np.ndarray]:
    return [stable_topk(sample_vectors @ query, sample_ids, TOP_K)[0] for query in reference_queries]


def compressed_results(
    document_vectors: np.ndarray,
    document_ids: np.ndarray,
    browser_query: np.ndarray,
) -> np.ndarray:
    scores = document_vectors.astype(np.float32) @ browser_query / 127.0
    return stable_topk(scores, document_ids, TOP_K)[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--faiss", type=Path, required=True)
    parser.add_argument("--queries", type=Path, required=True)
    parser.add_argument("--reference-embeddings", type=Path, required=True)
    parser.add_argument("--browser-embeddings", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    prereg = json.loads(PREREGISTRATION.read_text(encoding="utf-8"))
    if prereg["status"] != "frozen_before_execution":
        raise RuntimeError("The preregistration is not frozen")
    if sha256_file(args.queries) != EXPECTED_QUERY_SHA256:
        raise RuntimeError("Frozen query-set hash mismatch")
    if sha256_file(args.faiss) != EXPECTED_FAISS_SHA256:
        raise RuntimeError("Frozen FAISS hash mismatch")

    import faiss

    reference_rows, reference_queries = load_query_vectors(args.reference_embeddings)
    browser_payload = json.loads(args.browser_embeddings.read_text(encoding="utf-8"))
    browser_rows, browser_queries = load_query_vectors(args.browser_embeddings)
    if [row["query_id"] for row in reference_rows] != [
        row["query_id"] for row in browser_rows
    ]:
        raise RuntimeError("Reference/browser query order mismatch")

    reference_queries /= np.linalg.norm(reference_queries, axis=1, keepdims=True)
    browser_queries /= np.linalg.norm(browser_queries, axis=1, keepdims=True)
    parity = np.sum(reference_queries * browser_queries, axis=1)

    index = faiss.read_index(str(args.faiss))
    if int(index.ntotal) != 451823 or int(index.d) != 1024:
        raise RuntimeError("Frozen FAISS dimensions/count mismatch")
    ids = faiss.vector_to_array(index.id_map).astype(np.int64, copy=False)
    inner = faiss.downcast_index(index.index)
    if not np.array_equal(ids, np.arange(index.ntotal, dtype=np.int64)):
        raise RuntimeError("This runner requires the frozen sequential vector IDs")

    sample_positions = np.linspace(
        0, index.ntotal - 1, SAMPLE_DOCUMENTS, dtype=np.int64
    )
    sample_full = inner.reconstruct_batch(sample_positions)
    sample_reduced = normalized_prefix(sample_full)
    sample_quantized = quantize(sample_reduced)
    sample_reference = exact_sample_results(sample_full, ids[sample_positions], reference_queries)
    sample_observed = [
        compressed_results(
            sample_quantized,
            ids[sample_positions],
            normalized_prefix(browser_query),
        )
        for browser_query in browser_queries
    ]

    baseline_scores, baseline_ids = index.search(reference_queries, TOP_K)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix="browser-static-v3-", dir=args.output_dir
    ) as temporary_name:
        temporary = Path(temporary_name)
        reduced_path = temporary / "reduced.f32"
        reduced = np.memmap(
            reduced_path,
            dtype=np.float32,
            mode="w+",
            shape=(index.ntotal, DIMENSION),
        )
        for start in range(0, index.ntotal, 4096):
            count = min(4096, index.ntotal - start)
            reduced[start : start + count] = normalized_prefix(
                inner.reconstruct_n(start, count)
            )
        reduced.flush()

        training_positions = np.linspace(
            0, index.ntotal - 1, TRAINING_DOCUMENTS, dtype=np.int64
        )
        kmeans = faiss.Kmeans(
            DIMENSION,
            CLUSTERS,
            niter=ITERATIONS,
            seed=SEED,
            spherical=True,
            verbose=False,
            max_points_per_centroid=math.ceil(TRAINING_DOCUMENTS / CLUSTERS),
            min_points_per_centroid=1,
        )
        kmeans.train(np.asarray(reduced[training_positions]))
        centroids = np.asarray(kmeans.centroids, dtype=np.float32).reshape(
            CLUSTERS, DIMENSION
        )
        _, assignments = kmeans.index.search(np.asarray(reduced), 1)
        assignments = assignments[:, 0].astype(np.int32, copy=False)

        quantized_path = temporary / "vectors.i8"
        reduced_i8 = np.memmap(
            quantized_path,
            dtype=np.int8,
            mode="w+",
            shape=(index.ntotal, DIMENSION),
        )
        for start in range(0, index.ntotal, 16384):
            end = min(start + 16384, index.ntotal)
            reduced_i8[start:end] = quantize(reduced[start:end])
        reduced_i8.flush()

        cluster_members = [np.flatnonzero(assignments == cluster) for cluster in range(CLUSTERS)]
        full_observed = []
        selected_payloads = []
        selected_clusters_by_query = []
        for browser_query in browser_queries:
            query = normalized_prefix(browser_query)
            centroid_scores = centroids @ query
            selected_clusters = stable_topk(
                centroid_scores,
                np.arange(CLUSTERS, dtype=np.int64),
                NPROBE,
            )[0]
            positions = np.concatenate(
                [cluster_members[int(cluster)] for cluster in selected_clusters]
            )
            observed = compressed_results(
                reduced_i8[positions], ids[positions], query
            )
            full_observed.append(observed)
            selected_payloads.append(int(len(positions) * (DIMENSION + 4)))
            selected_clusters_by_query.append(selected_clusters.tolist())

        prototype_rows = []
        full_rows = []
        for offset, row in enumerate(reference_rows):
            prototype_rows.append(
                {
                    "query_id": row["query_id"],
                    "recall_at_10": recall(sample_reference[offset], sample_observed[offset], 10),
                    "recall_at_50": recall(sample_reference[offset], sample_observed[offset], 50),
                    "baseline_ids": sample_reference[offset].tolist(),
                    "observed_ids": sample_observed[offset].tolist(),
                }
            )
            full_rows.append(
                {
                    "query_id": row["query_id"],
                    "recall_at_10": recall(baseline_ids[offset], full_observed[offset], 10),
                    "recall_at_50": recall(baseline_ids[offset], full_observed[offset], 50),
                    "baseline_ids": baseline_ids[offset].tolist(),
                    "observed_ids": full_observed[offset].tolist(),
                    "selected_clusters": selected_clusters_by_query[offset],
                    "selected_vector_payload_bytes": selected_payloads[offset],
                }
            )

        vector_payload_bytes = int(index.ntotal * (DIMENSION + 4))
        centroid_payload_bytes = int(centroids.nbytes)

    def retrieval_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "mean_recall_at_10": float(np.mean([row["recall_at_10"] for row in rows])),
            "minimum_recall_at_10": float(min(row["recall_at_10"] for row in rows)),
            "mean_recall_at_50": float(np.mean([row["recall_at_50"] for row in rows])),
        }

    prototype_summary = retrieval_summary(prototype_rows)
    full_summary = retrieval_summary(full_rows)
    browser_model_remote_bytes = 1200510818
    browser_payload_mib = browser_model_remote_bytes / (1024 * 1024)
    browser_sessions = browser_payload.get("sessions", {})
    browser_execution_pass = bool(
        browser_payload.get("adapter")
        and browser_payload["adapter"].get("is_fallback_adapter") is not True
        and browser_sessions
        and all(
            session.get("device") == "webgpu" and session.get("dtype") == "fp16"
            for session in browser_sessions.values()
        )
        and len(browser_rows) == 5
    )
    gates = {
        "browser_execution": {
            "pass": browser_execution_pass,
            "adapter": browser_payload.get("adapter"),
            "sessions": browser_sessions,
        },
        "embedding_parity": {
            "pass": bool(np.min(parity) >= 0.98 and np.mean(parity) >= 0.99),
            "minimum_cosine": float(np.min(parity)),
            "mean_cosine": float(np.mean(parity)),
            "by_query": [
                {"query_id": row["query_id"], "cosine": float(parity[index])}
                for index, row in enumerate(reference_rows)
            ],
        },
        "prototype_retrieval": {
            "pass": bool(
                prototype_summary["mean_recall_at_10"] >= 0.8
                and prototype_summary["minimum_recall_at_10"] >= 0.6
                and prototype_summary["mean_recall_at_50"] >= 0.85
            ),
            **prototype_summary,
        },
        "full_corpus_retrieval": {
            "pass": bool(
                full_summary["mean_recall_at_10"] >= 0.8
                and full_summary["minimum_recall_at_10"] >= 0.6
                and full_summary["mean_recall_at_50"] >= 0.85
            ),
            **full_summary,
        },
        "static_payload": {
            "pass": bool(
                vector_payload_bytes <= 140 * 1024 * 1024
                and centroid_payload_bytes <= 1024 * 1024
                and max(selected_payloads) <= 32 * 1024 * 1024
                and browser_payload_mib <= 1200
            ),
            "vector_payload_bytes": vector_payload_bytes,
            "centroid_payload_bytes": centroid_payload_bytes,
            "maximum_selected_shards_bytes": max(selected_payloads),
            "browser_model_remote_bytes": browser_model_remote_bytes,
        },
    }
    passed = all(gate["pass"] for gate in gates.values())
    result = {
        "schema_version": "qwen3-browser-semantic-static-result-v3",
        "experiment_id": prereg["experiment_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "decision": "pass" if passed else "fail",
        "gates": gates,
        "prototype_queries": prototype_rows,
        "full_corpus_queries": full_rows,
        "fixed_design": prereg["fixed_design"],
        "frozen_inputs": prereg["frozen_inputs"],
    }
    (args.output_dir / "result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (args.output_dir / "results.jsonl").open("w", encoding="utf-8") as handle:
        for row in full_rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"decision": result["decision"], "gates": gates}, ensure_ascii=False))


if __name__ == "__main__":
    main()
