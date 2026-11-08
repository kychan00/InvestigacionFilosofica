#!/usr/bin/env python3
"""Build a deterministic OpenAlex Work ID -> V4 document-vector location lookup.

Offline-only operation, with an explicit optional download of pinned source files.
Does not call a model, FAISS, search APIs, or publish artifacts.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import struct
import sys
import tempfile
from urllib.request import Request, urlopen

SCHEMA = "research-atlas-qwen-document-lookup-v1"
SOURCE_REVISION = "5a4a195085de54bf607a6c4397092ffb32716dcc"
SOURCE_MANIFEST_SHA256 = "0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa"
SOURCE_BASE_URL = (
    "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/"
    + SOURCE_REVISION
    + "/semantic-retrieval/v3.3/browser-static-v4/20261010-v4"
)
WORK_ID_RE = re.compile(r"^(?:(?:https://openalex\.org/)|(?:openalex:))?W([1-9][0-9]*)/?$", re.I)


class LookupError(Exception):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode_json(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def normalize_work_id(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    match = WORK_ID_RE.fullmatch(value.strip())
    if not match:
        return None
    return "W" + str(int(match.group(1)))


def read_manifest(path: Path, synthetic_fixture: bool) -> tuple[dict, str]:
    raw = path.read_bytes()
    digest = sha256(raw)
    if not synthetic_fixture and digest != SOURCE_MANIFEST_SHA256:
        raise LookupError(f"Source manifest SHA mismatch: {digest} != {SOURCE_MANIFEST_SHA256}")
    manifest = json.loads(raw)
    if manifest.get("schema_version") != "qwen3-browser-semantic-static-artifacts-v4":
        raise LookupError("Unsupported manifest schema")
    n = manifest.get("document_count")
    dim = manifest.get("dimension")
    clusters = manifest.get("clusters", [])
    pages = manifest.get("metadata", {}).get("pages", [])
    if not isinstance(n, int) or n < 1 or not isinstance(dim, int) or dim < 1:
        raise LookupError("Invalid document count / dimension")
    if not synthetic_fixture:
        if (n, dim, len(clusters), len(pages)) != (451823, 1024, 256, 883):
            raise LookupError("V4 pinned shape mismatch")
    if not clusters or not pages or manifest.get("routing", {}).get("cluster_count") != len(clusters):
        raise LookupError("Cluster/metadata manifest mismatch")
    if manifest.get("quantization", {}).get("dtype") != "int8":
        raise LookupError("Expected int8 vectors")
    return manifest, digest


def safe_file(root: Path, relative: str) -> Path:
    path = PurePosixPath(relative)
    if path.is_absolute() or not path.parts or any(part in {".", ".."} for part in path.parts):
        raise LookupError(f"Unsafe manifest path: {relative}")
    return root.joinpath(*path.parts)


def verified_file(root: Path, record: dict, fetch_missing: bool) -> Path:
    name = record["path"]
    destination = safe_file(root, name)
    expected_size = int(record["bytes"])
    expected_sha = record["sha256"]
    if not destination.is_file():
        if not fetch_missing:
            raise LookupError(f"Missing V4 source asset: {destination}; pass --fetch-missing explicitly")
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + ".partial")
        try:
            request = Request(SOURCE_BASE_URL + "/" + name, headers={"User-Agent": "research-atlas-ra12b/1.0"})
            with urlopen(request, timeout=90) as response, temporary.open("wb") as file:
                size = 0
                while True:
                    chunk = response.read(1 << 20)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > expected_size:
                        raise LookupError(f"Downloaded oversized asset: {name}")
                    file.write(chunk)
                if size != expected_size:
                    raise LookupError(f"Downloaded wrong-sized asset: {name} ({size} != {expected_size})")
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
    digest = hashlib.sha256()
    with destination.open("rb") as file:
        total = 0
        while True:
            chunk = file.read(1 << 20)
            if not chunk:
                break
            total += len(chunk)
            digest.update(chunk)
    if total != expected_size or digest.hexdigest() != expected_sha:
        raise LookupError(f"V4 asset size/hash mismatch: {name}")
    return destination


def read_records(path: Path, expected: dict, first_id: int, n: int):
    read = 0
    try:
        with gzip.open(path, "rt", encoding="utf-8") as data:
            for line in data:
                if not line.strip():
                    raise LookupError(f"Unexpected blank metadata record: {path}")
                item = json.loads(line)
                expected_id = first_id + read
                if type(item.get("vector_id")) is not int or item["vector_id"] != expected_id:
                    raise LookupError(f"Unexpected metadata vector ID {item.get('vector_id')} at {path}")
                if not (0 <= item["vector_id"] < n):
                    raise LookupError(f"Vector ID outside corpus: {path}")
                read += 1
                yield item
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise LookupError(f"Unreadable metadata {path}: {exc}") from exc
    if read != expected["count"]:
        raise LookupError(f"Metadata page count mismatch: {path} ({read} != {expected['count']})")


def inspect_record(record: dict) -> tuple[str | None, str]:
    explicit = record.get("openalex_id")
    alternative = record.get("id")
    from_primary = normalize_work_id(explicit)
    from_id = normalize_work_id(alternative)
    if explicit not in (None, "") and from_primary is None:
        return None, "invalid_explicit"
    if from_primary and from_id and from_primary != from_id:
        return None, "conflicting_fields"
    if from_primary:
        return from_primary, "openalex_id"
    if from_id:
        return from_id, "id_alias"
    return None, "no_openalex_id"


def get_metadata_rows(manifest: dict, root: Path, fetch_missing: bool, maximum_pages: int | None = None):
    pages = manifest["metadata"]["pages"]
    if maximum_pages is not None:
        pages = pages[:maximum_pages]
    current = 0
    for number, page in enumerate(pages):
        if page["first_vector_id"] != current or page["last_vector_id"] != current + page["count"] - 1:
            raise LookupError(f"Metadata page {number} non-contiguous")
        file = verified_file(root, page, fetch_missing)
        for item in read_records(file, page, current, manifest["document_count"]):
            yield item
        current += page["count"]
    if maximum_pages is None and current != manifest["document_count"]:
        raise LookupError("Metadata source is not a full corpus partition")


def build_locations(manifest: dict, root: Path, fetch_missing: bool):
    n = manifest["document_count"]
    cluster_for = [-1] * n
    ordinal_for = [-1] * n
    count = 0
    for i, cluster in enumerate(manifest["clusters"]):
        if cluster.get("cluster") != i:
            raise LookupError(f"Cluster order mismatch: {i}")
        ids_path = verified_file(root, cluster["ids"], fetch_missing)
        data = ids_path.read_bytes()
        if len(data) != cluster["count"] * 4:
            raise LookupError(f"Cluster ID count mismatch: {i}")
        if cluster["vectors"]["bytes"] != cluster["count"] * manifest["dimension"]:
            raise LookupError(f"Vector bytes / dimension mismatch for cluster {i}")
        prev = -1
        for ordinal, (vector_id,) in enumerate(struct.iter_unpack("<I", data)):
            if vector_id >= n or vector_id <= prev:
                raise LookupError(f"Cluster IDs outside corpus or not sorted: {i}")
            if cluster_for[vector_id] >= 0:
                raise LookupError(f"Vector ID belongs to multiple clusters: {vector_id}")
            prev = vector_id
            cluster_for[vector_id] = i
            ordinal_for[vector_id] = ordinal
            count += 1
    if count != n or any(cluster < 0 for cluster in cluster_for):
        raise LookupError(f"Incomplete cluster-ID partition: {count} != {n}")
    return cluster_for, ordinal_for


def sample_metadata(manifest: dict, root: Path, fetch_missing: bool, sample_pages: int) -> dict:
    if not 1 <= sample_pages <= len(manifest["metadata"]["pages"]):
        raise LookupError("sample-pages outside 1..page_count")
    reasons: dict[str, int] = {}
    count = 0
    for row in get_metadata_rows(manifest, root, fetch_missing, sample_pages):
        _key, reason = inspect_record(row)
        reasons[reason] = reasons.get(reason, 0) + 1
        count += 1
    return {"mode": "sample", "sampledPages": sample_pages, "sampledRecords": count,
            "reasons": dict(sorted(reasons.items())), "coverageScope": "sample-only; not query or full corpus coverage"}


def gzip_deterministic(data: bytes) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", filename="", compresslevel=9, mtime=0) as compressed:
        compressed.write(data)
    return buffer.getvalue()


def build(manifest: dict, manifest_sha: str, root: Path, output: Path, fetch_missing: bool, synthetic_fixture: bool) -> dict:
    if output.exists():
        raise LookupError(f"Output already exists: {output}; use a fresh path")
    cluster_for, ordinal_for = build_locations(manifest, root, fetch_missing)
    locations: dict[str, tuple[int, int, int]] = {}
    conflicting_keys: set[str] = set()
    metrics = {"documents": 0, "explicitOpenAlexIds": 0, "idAliasOnly": 0,
               "noOpenAlexId": 0, "invalidExplicit": 0, "conflictingFields": 0,
               "duplicateWorkIdRecords": 0}
    for doc in get_metadata_rows(manifest, root, fetch_missing):
        metrics["documents"] += 1
        work, reason = inspect_record(doc)
        if reason == "openalex_id":
            metrics["explicitOpenAlexIds"] += 1
        elif reason == "id_alias":
            metrics["idAliasOnly"] += 1
        elif reason == "invalid_explicit":
            metrics["invalidExplicit"] += 1
        elif reason == "conflicting_fields":
            metrics["conflictingFields"] += 1
        else:
            metrics["noOpenAlexId"] += 1
        if work is None:
            continue
        if work in conflicting_keys:
            metrics["duplicateWorkIdRecords"] += 1
            continue
        if work in locations:
            conflicting_keys.add(work)
            del locations[work]
            metrics["duplicateWorkIdRecords"] += 1
            continue
        vector_id = doc["vector_id"]
        locations[work] = (vector_id, cluster_for[vector_id], ordinal_for[vector_id])
    if metrics["documents"] != manifest["document_count"]:
        raise LookupError("Metadata row count does not match manifest")
    partitions: list[list[tuple[str, tuple[int, int, int]]]] = [[] for _ in range(256)]
    for work, location in locations.items():
        prefix = hashlib.sha256(work.encode("ascii")).digest()[0]
        partitions[prefix].append((work, location))
    staging = Path(tempfile.mkdtemp(prefix="ra12b-lookup-", dir=output.parent))
    try:
        output_records = []
        for prefix, part in enumerate(partitions):
            if not part:
                continue
            part.sort(key=lambda item: int(item[0][1:]))
            payload = b"".join(encode_json([work, *location]) for work, location in part)
            compressed = gzip_deterministic(payload)
            name = f"lookup/part-{prefix:03d}.jsonl.gz"
            dest = safe_file(staging, name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(compressed)
            output_records.append({"prefix": prefix, "path": name, "count": len(part), "bytes": len(compressed), "sha256": sha256(compressed)})
        output_manifest = {
            "schemaVersion": SCHEMA,
            "status": "generated-unpublished-synthetic" if synthetic_fixture else "generated-unpublished",
            "source": {"dataset": "CristianPelayo/openalex-philosophy",
                       "revision": SOURCE_REVISION,
                       "prefix": "semantic-retrieval/v3.3/browser-static-v4/20261010-v4",
                       "manifestSha256": manifest_sha,
                       "faissSha256": manifest.get("source", {}).get("faiss_sha256"),
                       "metadataSqliteSha256": manifest.get("source", {}).get("metadata_sqlite_sha256")},
            "lookup": {"format": "gzip-jsonl-rows-[workId,vectorId,cluster,ordinal]",
                       "hashPartition": "first-byte-of-sha256(canonical-W-id)",
                       "partitionCount": 256, "entryCount": len(locations),
                       "ambiguousWorkIdsExcluded": len(conflicting_keys),
                       "partitions": output_records},
            "coverage": {**metrics,
                         "eligibleUniqueWorkIds": len(locations),
                         "unresolvedQueryCoverage": True,
                         "note": "Corpus metadata coverage only, not real SearchResponse join coverage"},
            "integrity": {"sourceAssetsSha256Verified": True,
                          "workIdCollisionsFailClosed": True,
                          "vectorClusterPartitionValidated": True},
            "productionEnabled": False,
        }
        (staging / "lookup-manifest.json").write_bytes(
            (json.dumps(output_manifest, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        )
        os.replace(staging, output)
        return output_manifest
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--artifact-root", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fetch-missing", action="store_true", help="Explicitly fetch missing pinned HF metadata and ID assets (~166 MB)")
    parser.add_argument("--sample-pages", type=int, help="Inspect first N real metadata pages; does not produce lookup")
    parser.add_argument("--synthetic-fixture", action="store_true", help="Test-only: permit reduced manifest, mark output synthetic")
    args = parser.parse_args(argv)
    try:
        manifest, manifest_sha = read_manifest(args.manifest, args.synthetic_fixture)
        if args.sample_pages is not None:
            if args.output:
                raise LookupError("Sample mode does not accept --output")
            report = sample_metadata(manifest, args.artifact_root, args.fetch_missing, args.sample_pages)
        else:
            if args.output is None:
                raise LookupError("Full build requires --output")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            report = build(manifest, manifest_sha, args.artifact_root, args.output,
                           args.fetch_missing, args.synthetic_fixture)
        print(json.dumps(report, sort_keys=True, ensure_ascii=False))
        return 0
    except (LookupError, OSError, ValueError, KeyError, TypeError) as exc:
        print(f"RA12-B lookup ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
