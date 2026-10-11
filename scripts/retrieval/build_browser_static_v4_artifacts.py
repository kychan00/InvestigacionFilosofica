#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import shutil
import sqlite3
import tempfile
from pathlib import Path
from typing import Any, Iterable

import numpy as np


SCHEMA_VERSION = "qwen3-browser-semantic-static-artifacts-v4"
ARTIFACT_VERSION = "20261010-v4"
EXPECTED_FAISS_SHA256 = (
    "31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68"
)
EXPECTED_DOCUMENT_COUNT = 451823
DIMENSION = 1024
CLUSTERS = 256
TRAINING_DOCUMENTS = 65536
SEED = 20261010
ITERATIONS = 20
NPROBE = 32
METADATA_PAGE_SIZE = 512
CONFIRMATION = "BUILD_BROWSER_STATIC_V4"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def normalized(values: np.ndarray) -> np.ndarray:
    output = np.asarray(values, dtype=np.float32)
    norms = np.linalg.norm(output, axis=-1, keepdims=True)
    norms[norms == 0] = 1.0
    return np.ascontiguousarray(output / norms, dtype=np.float32)


def quantize(values: np.ndarray) -> np.ndarray:
    return np.rint(np.clip(values, -1.0, 1.0) * 127.0).astype(np.int8)


def artifact_record(path: Path, root: Path, **extra: Any) -> dict[str, Any]:
    return {
        "path": path.relative_to(root).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        **extra,
    }


def write_raw(path: Path, values: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        np.ascontiguousarray(values).tofile(handle)


def metadata_rows(connection: sqlite3.Connection) -> Iterable[tuple[Any, ...]]:
    return connection.execute(
        """
        SELECT vector_id, id, title, abstract, authors_json, year, topics_json,
               keywords_json, journal, language, doi, source, publication_type,
               openalex_id, crossref_id, url
        FROM documents
        ORDER BY vector_id
        """
    )


def metadata_document(row: tuple[Any, ...]) -> dict[str, Any]:
    keys = (
        "vector_id", "id", "title", "abstract", "authors", "year", "topics",
        "keywords", "journal", "language", "doi", "source", "publication_type",
        "openalex_id", "crossref_id", "url",
    )
    values = list(row)
    for offset in (4, 6, 7):
        values[offset] = json.loads(values[offset])
    return dict(zip(keys, values, strict=True))


def write_metadata_pages(
    database: Path, output: Path, root: Path
) -> tuple[list[dict[str, Any]], int]:
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    pages: list[dict[str, Any]] = []
    count = 0
    try:
        cursor = iter(metadata_rows(connection))
        page_number = 0
        while True:
            page_rows = []
            for _ in range(METADATA_PAGE_SIZE):
                try:
                    page_rows.append(next(cursor))
                except StopIteration:
                    break
            if not page_rows:
                break
            path = output / f"page-{page_number:04d}.jsonl.gz"
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("wb") as raw:
                with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
                    for row in page_rows:
                        compressed.write(
                            (canonical_json(metadata_document(row)) + "\n").encode("utf-8")
                        )
            first_id = int(page_rows[0][0])
            last_id = int(page_rows[-1][0])
            pages.append(
                artifact_record(
                    path,
                    root,
                    count=len(page_rows),
                    first_vector_id=first_id,
                    last_vector_id=last_id,
                )
            )
            count += len(page_rows)
            page_number += 1
    finally:
        connection.close()
    return pages, count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--faiss", type=Path, required=True)
    parser.add_argument("--metadata-db", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--confirm", required=True)
    args = parser.parse_args()

    if args.confirm != CONFIRMATION:
        raise RuntimeError(f"Pass --confirm {CONFIRMATION} to execute the frozen build")
    if sha256_file(args.faiss) != EXPECTED_FAISS_SHA256:
        raise RuntimeError("Frozen FAISS hash mismatch")
    if not args.metadata_db.is_file():
        raise RuntimeError("Metadata database does not exist")
    if args.output_dir.exists() and any(args.output_dir.iterdir()):
        raise RuntimeError("Output directory must be absent or empty")

    import faiss

    index = faiss.read_index(str(args.faiss))
    if int(index.ntotal) != EXPECTED_DOCUMENT_COUNT or int(index.d) != DIMENSION:
        raise RuntimeError("Frozen FAISS dimensions/count mismatch")
    ids = faiss.vector_to_array(index.id_map).astype(np.int64, copy=False)
    if not np.array_equal(ids, np.arange(EXPECTED_DOCUMENT_COUNT, dtype=np.int64)):
        raise RuntimeError("Frozen FAISS vector IDs are not sequential")
    inner = faiss.downcast_index(index.index)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    staging: Path | None = Path(
        tempfile.mkdtemp(prefix="browser-static-v4-build-", dir=args.output_dir.parent)
    )
    temporary = Path(tempfile.mkdtemp(prefix="browser-static-v4-work-", dir=args.output_dir.parent))
    try:
        vectors_path = temporary / "vectors.f32"
        vectors = np.memmap(
            vectors_path,
            dtype=np.float32,
            mode="w+",
            shape=(EXPECTED_DOCUMENT_COUNT, DIMENSION),
        )
        for start in range(0, EXPECTED_DOCUMENT_COUNT, 4096):
            count = min(4096, EXPECTED_DOCUMENT_COUNT - start)
            vectors[start : start + count] = normalized(inner.reconstruct_n(start, count))
        vectors.flush()

        training_positions = np.linspace(
            0, EXPECTED_DOCUMENT_COUNT - 1, TRAINING_DOCUMENTS, dtype=np.int64
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
        kmeans.train(np.asarray(vectors[training_positions]))
        centroids = np.asarray(kmeans.centroids, dtype=np.float32).reshape(
            CLUSTERS, DIMENSION
        )
        _, assignments = kmeans.index.search(np.asarray(vectors), 1)
        assignments = assignments[:, 0].astype(np.int32, copy=False)

        assert staging is not None
        centroids_path = staging / "centroids.f32"
        write_raw(centroids_path, centroids.astype("<f4", copy=False))
        cluster_records = []
        total_cluster_documents = 0
        maximum_cluster_bytes = 0
        for cluster in range(CLUSTERS):
            positions = np.flatnonzero(assignments == cluster).astype(np.uint32)
            ids_path = staging / "clusters" / f"cluster-{cluster:03d}.ids.u32"
            vectors_output = staging / "clusters" / f"cluster-{cluster:03d}.vectors.i8"
            write_raw(ids_path, positions.astype("<u4", copy=False))
            vectors_output.parent.mkdir(parents=True, exist_ok=True)
            with vectors_output.open("wb") as handle:
                for start in range(0, len(positions), 4096):
                    selected = positions[start : start + 4096].astype(np.int64)
                    quantize(vectors[selected]).tofile(handle)
            count = len(positions)
            payload_bytes = ids_path.stat().st_size + vectors_output.stat().st_size
            total_cluster_documents += count
            maximum_cluster_bytes = max(maximum_cluster_bytes, payload_bytes)
            cluster_records.append(
                {
                    "cluster": cluster,
                    "count": count,
                    "ids": artifact_record(ids_path, staging),
                    "vectors": artifact_record(vectors_output, staging),
                    "payload_bytes": payload_bytes,
                }
            )

        metadata_pages, metadata_count = write_metadata_pages(
            args.metadata_db, staging / "metadata", staging
        )
        if total_cluster_documents != EXPECTED_DOCUMENT_COUNT:
            raise RuntimeError("Cluster membership count mismatch")
        if metadata_count != EXPECTED_DOCUMENT_COUNT:
            raise RuntimeError("Metadata row count mismatch")

        manifest = {
            "schema_version": SCHEMA_VERSION,
            "artifact_version": ARTIFACT_VERSION,
            "document_count": EXPECTED_DOCUMENT_COUNT,
            "dimension": DIMENSION,
            "source": {
                "faiss_sha256": EXPECTED_FAISS_SHA256,
                "metadata_sqlite_sha256": sha256_file(args.metadata_db),
            },
            "embedding": {
                "reference_model": "Qwen/Qwen3-Embedding-0.6B",
                "reference_revision": "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3",
                "browser_model": "onnx-community/Qwen3-Embedding-0.6B-ONNX",
                "browser_revision": "c25a394dd583836952667c12f008335071b3f43d",
                "browser_dtype": "fp16",
                "browser_device": "webgpu",
            },
            "quantization": {
                "dtype": "int8",
                "scale": 127,
                "normalization": "l2",
            },
            "routing": {
                "cluster_count": CLUSTERS,
                "training_documents": TRAINING_DOCUMENTS,
                "training_method": "numpy.linspace over sequential vector IDs",
                "seed": SEED,
                "iterations": ITERATIONS,
                "spherical": True,
                "nprobe": NPROBE,
            },
            "metadata": {
                "format": "deterministic gzip JSONL",
                "page_size": METADATA_PAGE_SIZE,
                "page_for_vector_id": "floor(vector_id / page_size)",
                "pages": metadata_pages,
            },
            "centroids": artifact_record(
                centroids_path,
                staging,
                count=CLUSTERS,
                dimension=DIMENSION,
                dtype="float32-le",
            ),
            "clusters": cluster_records,
            "totals": {
                "cluster_documents": total_cluster_documents,
                "metadata_documents": metadata_count,
                "vector_payload_bytes": sum(row["payload_bytes"] for row in cluster_records),
                "maximum_cluster_payload_bytes": maximum_cluster_bytes,
                "metadata_payload_bytes": sum(row["bytes"] for row in metadata_pages),
            },
        }
        manifest_path = staging / "manifest.json"
        manifest_path.write_text(canonical_json(manifest) + "\n", encoding="utf-8")
        if any(args.output_dir.iterdir()):
            raise RuntimeError("Output directory changed during build")
        args.output_dir.rmdir()
        staging.rename(args.output_dir)
        staging = None
        print(canonical_json({
            "status": "built",
            "output": str(args.output_dir),
            "manifest_sha256": sha256_file(args.output_dir / "manifest.json"),
            "document_count": EXPECTED_DOCUMENT_COUNT,
        }))
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
        if staging is not None and staging.exists():
            shutil.rmtree(staging)


if __name__ == "__main__":
    main()
