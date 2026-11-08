#!/usr/bin/env python3
"""Independently check every emitted RA12-B2 lookup row against pinned V4 sources.

Offline: no URL fetches, no publication, no browser runtime changes.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys

from build_ra12_vector_lookup import (
    LookupError, build_locations, get_metadata_rows, inspect_record,
    normalize_work_id, read_manifest, safe_file
)


def verify_lookup(source_manifest: dict, artifact_root: Path, lookup_dir: Path, synthetic_fixture: bool = False) -> dict:
    path = lookup_dir / "lookup-manifest.json"
    result = json.loads(path.read_text(encoding="utf-8"))
    if result.get("schemaVersion") != "research-atlas-qwen-document-lookup-v1":
        raise LookupError("Unexpected lookup schema")
    if result.get("status") != ("generated-unpublished-synthetic" if synthetic_fixture else "generated-unpublished") or result.get("productionEnabled") is not False:
        raise LookupError("Lookup is not a non-production real build")
    if result.get("source", {}).get("revision") != "5a4a195085de54bf607a6c4397092ffb32716dcc":
        raise LookupError("Source revision changed")

    source_locations = build_locations(source_manifest, artifact_root, False)
    references: dict[str, list[int]] = {}
    for row in get_metadata_rows(source_manifest, artifact_root, False):
        work, reason = inspect_record(row)
        if work is not None:
            references.setdefault(work, []).append(row["vector_id"])

    unique_references = {work: vector_ids[0] for work, vector_ids in references.items() if len(vector_ids) == 1}
    ambiguous = sum(1 for vector_ids in references.values() if len(vector_ids) > 1)
    if ambiguous != result["lookup"]["ambiguousWorkIdsExcluded"]:
        raise LookupError("Ambiguous Work ID count mismatch")
    if len(unique_references) != result["lookup"]["entryCount"]:
        raise LookupError("Unique Work ID count mismatch")

    seen = set()
    partitions = result["lookup"]["partitions"]
    if len({item["prefix"] for item in partitions}) != len(partitions):
        raise LookupError("Duplicate partition in lookup manifest")
    bytes_total = 0
    for item in partitions:
        prefix = item["prefix"]
        if not (type(prefix) is int and 0 <= prefix < 256):
            raise LookupError("Invalid partition prefix")
        if item["path"] != f"lookup/part-{prefix:03d}.jsonl.gz":
            raise LookupError("Unexpected partition path")
        data = safe_file(lookup_dir, item["path"]).read_bytes()
        if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise LookupError("Lookup partition size/hash mismatch")
        bytes_total += len(data)
        rows = gzip.decompress(data).decode("utf-8").splitlines()
        if len(rows) != item["count"]:
            raise LookupError("Lookup partition record count mismatch")
        previous = -1
        for row in rows:
            vector = json.loads(row)
            if not isinstance(vector, list) or len(vector) != 4:
                raise LookupError("Invalid lookup record schema")
            work, vector_id, cluster, ordinal = vector
            if not isinstance(work, str) or normalize_work_id(work) != work:
                raise LookupError("Work ID is not canonical")
            numeric = int(work[1:])
            if numeric <= previous:
                raise LookupError("Work IDs within partition not strictly sorted")
            previous = numeric
            if hashlib.sha256(work.encode("ascii")).digest()[0] != prefix:
                raise LookupError("Work ID belongs to another partition")
            if work in seen:
                raise LookupError("Duplicate Work ID across partitions")
            seen.add(work)
            if unique_references.get(work) != vector_id:
                raise LookupError("Lookup Work ID and V4 metadata do not match")
            if (type(cluster) is not int or type(ordinal) is not int or
                    not 0 <= vector_id < source_manifest["document_count"] or
                    (cluster, ordinal) != (source_locations[0][vector_id], source_locations[1][vector_id])):
                raise LookupError("Lookup cluster/ordinal mismatch with V4 u32 array")
    if seen != set(unique_references):
        raise LookupError("Lookup missing or added Work IDs")

    return {
        "schemaVersion": "research-atlas-ra12b2-independent-validation-v1",
        "status": "pass",
        "realCorpusRecords": source_manifest["document_count"],
        "uniqueOpenAlexWorkIds": len(unique_references),
        "ambiguousWorkIdsExcluded": ambiguous,
        "verifiedPartitions": len(partitions),
        "verifiedLookupBytes": bytes_total,
        "sourceMetadataAndIdsVerified": True,
        "queryCoverageMeasured": False,
        "publishedToHuggingFace": False,
        "productionChanged": False
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--lookup", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--synthetic-fixture", action="store_true", help="Test-only: allow reduced synthetic manifest")
    args = parser.parse_args()
    try:
        manifest, digest = read_manifest(args.manifest, args.synthetic_fixture)
        lookup_manifest = json.loads((args.lookup / "lookup-manifest.json").read_text(encoding="utf-8"))
        if lookup_manifest.get("source", {}).get("manifestSha256") != digest:
            raise LookupError("Source manifest SHA lineage mismatch")
        result = verify_lookup(manifest, args.artifact_root, args.lookup, args.synthetic_fixture)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, sort_keys=True))
        return 0
    except (LookupError, OSError, ValueError, KeyError, TypeError, UnicodeError, EOFError) as error:
        print(f"RA12-B2 independent validator ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
