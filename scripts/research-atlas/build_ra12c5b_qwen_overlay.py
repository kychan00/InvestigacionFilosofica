#!/usr/bin/env python3
"""RA12-C5-B: generate the first source-agnostic Qwen semantic overlay.

Uses the exact historical V3.3 document-text contract and pinned
Qwen/Qwen3-Embedding-0.6B revision. Before embedding external candidates, it
re-embeds genuine frozen V4 controls and compares against SHA-verified int8 V4
vectors. The overlay is emitted only if the compatibility gate passes.

No Hugging Face publication and no production activation happen here.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np

from build_ra12_vector_lookup import (
    build_locations,
    get_metadata_rows,
    read_manifest,
    verified_file,
)

MODEL = "Qwen/Qwen3-Embedding-0.6B"
MODEL_REVISION = "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
DIMENSION = 1024
SCALE = 127
MAX_CHARACTERS = 24_000
CONTROL_COUNT = 8
CONTROL_PER_CLUSTER_CAP = 4
MIN_CONTROL_COSINE = 0.995
MIN_MEAN_CONTROL_COSINE = 0.997
SCHEMA = "research-atlas-ra12c5b-semantic-overlay-v1"


class OverlayBuildError(RuntimeError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize(values: np.ndarray) -> np.ndarray:
    matrix = np.asarray(values, dtype=np.float32)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    if np.any(~np.isfinite(norms)) or np.any(norms <= 0):
        raise OverlayBuildError("Embedding contains invalid/zero norm")
    return np.ascontiguousarray(matrix / norms, dtype=np.float32)


def quantize(values: np.ndarray) -> np.ndarray:
    return np.rint(np.clip(values, -1.0, 1.0) * SCALE).astype(np.int8)


def text(value: Any) -> str | None:
    if value is None:
        return None
    output = " ".join(str(value).split()).strip()
    return output or None


def string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out = []
    seen = set()
    for item in value:
        candidate = text(item)
        if candidate and candidate.casefold() not in seen:
            seen.add(candidate.casefold())
            out.append(candidate)
    return out


def historical_document_text(row: dict, *, require_legacy_sparse_metadata=False) -> str | None:
    title = text(row.get("title"))
    abstract = text(row.get("abstract"))
    authors = string_list(row.get("authors"))
    topics = string_list(row.get("topics"))
    keywords = string_list(row.get("keywords"))

    if require_legacy_sparse_metadata and (authors or topics or keywords):
        return None

    fields = (
        ("Title", title),
        ("Abstract", abstract),
        ("Authors", "; ".join(authors) if authors else None),
        ("Topics", "; ".join(topics) if topics else None),
        ("Keywords", "; ".join(keywords) if keywords else None),
    )
    blocks = [f"{label}:\n{value}" for label, value in fields if value]
    return "\n\n".join(blocks)[:MAX_CHARACTERS] if blocks else None


def load_candidates(path: Path) -> list[dict]:
    rows = []
    identities = set()
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            identity = row.get("identity")
            document_text = row.get("documentText")
            if not isinstance(identity, str) or not identity:
                raise OverlayBuildError(f"Candidate {line_number} lacks identity")
            if identity in identities:
                raise OverlayBuildError(f"Duplicate candidate identity: {identity}")
            if not isinstance(document_text, str) or not document_text.strip():
                raise OverlayBuildError(f"Candidate {identity} lacks document text")
            expected = hashlib.sha256(document_text.encode("utf-8")).hexdigest()
            if row.get("textSha256") != expected:
                raise OverlayBuildError(f"Candidate text hash mismatch: {identity}")
            if len(document_text) > MAX_CHARACTERS:
                raise OverlayBuildError(f"Candidate exceeds historical char cap: {identity}")
            identities.add(identity)
            rows.append(row)
    if not rows:
        raise OverlayBuildError("No overlay candidates")
    return rows


def choose_controls(manifest: dict, source_root: Path) -> list[dict]:
    cluster_for, ordinal_for = build_locations(manifest, source_root, False)
    cluster_order = sorted(
        range(len(manifest["clusters"])),
        key=lambda cluster: (
            manifest["clusters"][cluster]["vectors"]["bytes"],
            cluster,
        ),
    )
    eligible: dict[int, list[dict]] = {cluster: [] for cluster in cluster_order}

    for row in get_metadata_rows(manifest, source_root, False):
        vector_id = int(row["vector_id"])
        cluster = int(cluster_for[vector_id])
        if len(eligible[cluster]) >= CONTROL_PER_CLUSTER_CAP:
            continue
        candidate_text = historical_document_text(
            row, require_legacy_sparse_metadata=True
        )
        if not candidate_text or not text(row.get("abstract")) or not text(row.get("title")):
            continue
        eligible[cluster].append({
            "vectorId": vector_id,
            "cluster": cluster,
            "ordinal": int(ordinal_for[vector_id]),
            "workId": row.get("openalex_id") or row.get("id"),
            "text": candidate_text,
            "textSha256": hashlib.sha256(
                candidate_text.encode("utf-8")
            ).hexdigest(),
        })

    controls = []
    for cluster in cluster_order:
        controls.extend(eligible[cluster])
        if len(controls) >= CONTROL_COUNT:
            controls = controls[:CONTROL_COUNT]
            break
    if len(controls) != CONTROL_COUNT:
        raise OverlayBuildError(
            f"Could not select {CONTROL_COUNT} V4 controls; found {len(controls)}"
        )
    return controls


def source_control_vectors(manifest: dict, source_root: Path, controls: list[dict]) -> np.ndarray:
    by_cluster: dict[int, bytes] = {}
    for cluster in sorted({item["cluster"] for item in controls}):
        record = manifest["clusters"][cluster]
        checked = verified_file(source_root, record["vectors"], fetch_missing=True)
        by_cluster[cluster] = checked.read_bytes()

    vectors = []
    for item in controls:
        cluster = item["cluster"]
        ordinal = item["ordinal"]
        record = manifest["clusters"][cluster]
        if not 0 <= ordinal < record["count"]:
            raise OverlayBuildError("Control ordinal outside source cluster")
        raw = by_cluster[cluster]
        start = ordinal * DIMENSION
        end = start + DIMENSION
        if end > len(raw):
            raise OverlayBuildError("Control vector slice outside source bytes")
        vector = np.frombuffer(raw[start:end], dtype=np.int8).astype(np.float32)
        vector /= SCALE
        vectors.append(normalize(vector)[0])
    return np.asarray(vectors, dtype=np.float32)


def load_model(device: str):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise OverlayBuildError("sentence-transformers is required") from exc

    model = SentenceTransformer(
        MODEL,
        revision=MODEL_REVISION,
        device=device,
    )
    model.tokenizer.padding_side = "left"
    return model


def embed(model, texts: list[str], batch_size: int) -> np.ndarray:
    vectors = model.encode(
        texts,
        batch_size=batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim != 2 or matrix.shape[1] != DIMENSION:
        raise OverlayBuildError(f"Unexpected Qwen dimensions: {matrix.shape}")
    if not np.all(np.isfinite(matrix)):
        raise OverlayBuildError("Qwen returned non-finite values")
    return normalize(matrix)


def compatibility_audit(
    controls: list[dict],
    embedded: np.ndarray,
    source_vectors: np.ndarray,
) -> dict:
    if embedded.shape != source_vectors.shape:
        raise OverlayBuildError("Control shape mismatch")
    cosines = np.sum(embedded * source_vectors, axis=1)
    quantized = quantize(embedded)
    source_i8 = quantize(source_vectors)
    equality = np.mean(quantized == source_i8, axis=1)

    cases = []
    for index, item in enumerate(controls):
        cases.append({
            "workId": item["workId"],
            "vectorId": item["vectorId"],
            "cluster": item["cluster"],
            "ordinal": item["ordinal"],
            "textSha256": item["textSha256"],
            "cosineVsFrozenV4Int8": float(cosines[index]),
            "quantizedByteAgreement": float(equality[index]),
        })

    audit = {
        "schemaVersion": "research-atlas-ra12c5b-v4-compatibility-audit-v1",
        "controlCount": len(cases),
        "controlClusters": sorted({item["cluster"] for item in controls}),
        "minimumCosine": float(np.min(cosines)),
        "meanCosine": float(np.mean(cosines)),
        "maximumCosine": float(np.max(cosines)),
        "minimumQuantizedByteAgreement": float(np.min(equality)),
        "meanQuantizedByteAgreement": float(np.mean(equality)),
        "requiredMinimumCosine": MIN_CONTROL_COSINE,
        "requiredMeanCosine": MIN_MEAN_CONTROL_COSINE,
        "referenceRepresentation": "frozen V4 signed-int8 dequantized and renormalized",
        "expectedRmsQuantizationCosineApprox": float(
            1.0 / math.sqrt(
                1.0 + (
                    math.sqrt(DIMENSION) / (SCALE * math.sqrt(12.0))
                ) ** 2
            )
        ),
        "passed": bool(
            np.min(cosines) >= MIN_CONTROL_COSINE
            and np.mean(cosines) >= MIN_MEAN_CONTROL_COSINE
        ),
        "cases": cases,
    }
    if not audit["passed"]:
        raise OverlayBuildError(
            "Historical V4 compatibility gate failed: "
            f"min={audit['minimumCosine']:.6f}, mean={audit['meanCosine']:.6f}"
        )
    return audit


def write_overlay(
    output: Path,
    candidates: list[dict],
    vectors: np.ndarray,
    seed_metadata: Path,
    compatibility: dict,
    v4_manifest_sha: str,
) -> dict:
    if output.exists():
        raise OverlayBuildError("Overlay output already exists")
    output.mkdir(parents=True)

    q8 = quantize(vectors)
    vectors_path = output / "vectors.i8"
    vectors_path.write_bytes(np.ascontiguousarray(q8).tobytes())

    digests = bytearray()
    vector_records = []
    saturation = 0
    for ordinal, row in enumerate(q8):
        raw = row.tobytes()
        digest = hashlib.sha256(raw).digest()
        digests.extend(digest)
        saturation += int(np.count_nonzero(np.abs(row.astype(np.int16)) == SCALE))
        vector_records.append({
            "ordinal": ordinal,
            "identity": candidates[ordinal]["identity"],
            "textSha256": candidates[ordinal]["textSha256"],
            "vectorSha256": digest.hex(),
        })

    digest_path = output / "vector-digests.sha256.bin"
    digest_path.write_bytes(digests)

    index_path = output / "vector-index.jsonl.gz"
    with index_path.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
            for record in vector_records:
                zipped.write(
                    (json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n")
                    .encode("utf-8")
                )

    metadata_target = output / "overlay-metadata.jsonl.gz"
    metadata_target.write_bytes(seed_metadata.read_bytes())

    compatibility_path = output / "v4-compatibility-audit.json"
    compatibility_path.write_text(
        json.dumps(compatibility, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )

    manifest = {
        "schemaVersion": SCHEMA,
        "status": "built-unpublished",
        "documentCount": len(candidates),
        "dimension": DIMENSION,
        "embedding": {
            "model": MODEL,
            "revision": MODEL_REVISION,
            "documentsUseInstruction": False,
            "pooling": "checkpoint SentenceTransformers last-token pooling",
            "normalization": "L2 float32",
            "historicalTextContract": "semantic-retrieval-v3.3-document-text-v1",
            "maxCharacters": MAX_CHARACTERS,
        },
        "quantization": {
            "dtype": "int8",
            "scale": SCALE,
            "formula": "round(clip(normalized_vector,-1,1)*127)",
            "saturatedComponents": saturation,
        },
        "v4Compatibility": {
            "sourceManifestSha256": v4_manifest_sha,
            "auditPath": compatibility_path.name,
            "auditSha256": sha256_file(compatibility_path),
            "passed": compatibility["passed"],
            "minimumCosine": compatibility["minimumCosine"],
            "meanCosine": compatibility["meanCosine"],
        },
        "artifacts": {
            "vectors": {
                "path": vectors_path.name,
                "bytes": vectors_path.stat().st_size,
                "sha256": sha256_file(vectors_path),
            },
            "digests": {
                "path": digest_path.name,
                "bytes": digest_path.stat().st_size,
                "sha256": sha256_file(digest_path),
            },
            "index": {
                "path": index_path.name,
                "bytes": index_path.stat().st_size,
                "sha256": sha256_file(index_path),
            },
            "metadata": {
                "path": metadata_target.name,
                "bytes": metadata_target.stat().st_size,
                "sha256": sha256_file(metadata_target),
                "containsAbstractBody": False,
            },
        },
        "productionEnabled": False,
        "publishedToHf": False,
    }
    manifest_path = output / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    manifest["manifestSha256"] = sha256_file(manifest_path)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidates", required=True, type=Path)
    parser.add_argument("--seed-metadata", required=True, type=Path)
    parser.add_argument("--v4-manifest", required=True, type=Path)
    parser.add_argument("--v4-source-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--batch-size", type=int, default=2)
    args = parser.parse_args()

    try:
        if not 1 <= args.batch_size <= 16:
            raise OverlayBuildError("batch-size must be 1..16")
        manifest, manifest_sha = read_manifest(args.v4_manifest, synthetic_fixture=False)
        if manifest["document_count"] != 451823 or manifest["dimension"] != DIMENSION:
            raise OverlayBuildError("Unexpected V4 source contract")

        candidates = load_candidates(args.candidates)
        controls = choose_controls(manifest, args.v4_source_root)
        source_vectors = source_control_vectors(
            manifest, args.v4_source_root, controls
        )

        model = load_model(args.device)
        control_embeddings = embed(
            model, [item["text"] for item in controls], batch_size=1
        )
        compatibility = compatibility_audit(
            controls, control_embeddings, source_vectors
        )

        candidate_embeddings = embed(
            model, [item["documentText"] for item in candidates], args.batch_size
        )
        overlay = write_overlay(
            args.output,
            candidates,
            candidate_embeddings,
            args.seed_metadata,
            compatibility,
            manifest_sha,
        )

        summary = {
            "status": overlay["status"],
            "documents": overlay["documentCount"],
            "vectorBytes": overlay["artifacts"]["vectors"]["bytes"],
            "digestBytes": overlay["artifacts"]["digests"]["bytes"],
            "metadataBytes": overlay["artifacts"]["metadata"]["bytes"],
            "minimumControlCosine": overlay["v4Compatibility"]["minimumCosine"],
            "meanControlCosine": overlay["v4Compatibility"]["meanCosine"],
            "model": MODEL,
            "revision": MODEL_REVISION,
            "published": False,
            "productionEnabled": False,
        }
        print(json.dumps(summary, sort_keys=True))
        return 0
    except (OverlayBuildError, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"RA12-C5-B overlay build ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
