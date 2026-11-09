#!/usr/bin/env python3
"""RA12-C4: build source-agnostic V4 identity aliases for federated search results.

Transforms verified Qwen3 V4 metadata into deterministic sharded alias maps:
- openalex:<WID>
- doi:<normalized DOI>
- crossref:<normalized DOI> when the frozen metadata carries crossref_id
Each alias resolves to one canonical OpenAlex work + vector location.
Ambiguous aliases fail closed and are omitted.

No embeddings are generated. No live APIs. No publication.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

from build_ra12_vector_lookup import (
    LookupError, build_locations, encode_json, get_metadata_rows, normalize_work_id,
    read_manifest, safe_file, sha256, gzip_deterministic,
)

SCHEMA = "research-atlas-ra12c4-semantic-alias-index-v1"
DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$", re.I)


def normalize_doi(value):
    if not isinstance(value, str):
        return None
    text = value.strip()
    text = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", text, flags=re.I)
    text = re.sub(r"^doi:\s*", "", text, flags=re.I)
    text = text.strip().lower().rstrip(" .;,")
    return text if DOI_RE.match(text) else None


def canonical_aliases(row):
    values = []
    work = normalize_work_id(row.get("openalex_id")) or normalize_work_id(row.get("id"))
    if work:
        values.append("openalex:" + work)
    doi = normalize_doi(row.get("doi"))
    if doi:
        values.append("doi:" + doi)
    crossref = normalize_doi(row.get("crossref_id"))
    if crossref:
        values.append("crossref:" + crossref)
        if "doi:" + crossref not in values:
            values.append("doi:" + crossref)
    return values


def build(manifest, manifest_sha, root: Path, output: Path):
    if output.exists():
        raise LookupError("Alias output already exists")
    cluster_for, ordinal_for = build_locations(manifest, root, False)
    alias_to_location = {}
    ambiguous = set()
    work_count = 0
    alias_kind_counts = {}
    for row in get_metadata_rows(manifest, root, False):
        vector_id = row["vector_id"]
        work = normalize_work_id(row.get("openalex_id")) or normalize_work_id(row.get("id"))
        if not work:
            raise LookupError(f"V4 row lacks canonical OpenAlex work: {vector_id}")
        location = (work, vector_id, cluster_for[vector_id], ordinal_for[vector_id])
        work_count += 1
        for alias in canonical_aliases(row):
            kind = alias.split(":", 1)[0]
            alias_kind_counts[kind] = alias_kind_counts.get(kind, 0) + 1
            if alias in ambiguous:
                continue
            previous = alias_to_location.get(alias)
            if previous is None:
                alias_to_location[alias] = location
            elif previous != location:
                ambiguous.add(alias)
                del alias_to_location[alias]
    if work_count != manifest["document_count"]:
        raise LookupError("Incomplete metadata traversal")
    partitions = [[] for _ in range(256)]
    for alias, location in alias_to_location.items():
        prefix = hashlib.sha256(alias.encode("utf-8")).digest()[0]
        partitions[prefix].append((alias, location))
    staging = Path(tempfile.mkdtemp(prefix="ra12c4-alias-", dir=output.parent))
    try:
        records = []
        total_entries = total_bytes = 0
        for prefix, items in enumerate(partitions):
            items.sort(key=lambda item: item[0])
            payload = b"".join(encode_json([alias, *location]) for alias, location in items)
            compressed = gzip_deterministic(payload)
            name = f"aliases/part-{prefix:03d}.jsonl.gz"
            target = safe_file(staging, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(compressed)
            records.append({
                "prefix": prefix, "path": name, "count": len(items),
                "bytes": len(compressed), "sha256": sha256(compressed)
            })
            total_entries += len(items)
            total_bytes += len(compressed)
        manifest_out = {
            "schemaVersion": SCHEMA,
            "status": "generated-unpublished",
            "source": {
                "dataset": "CristianPelayo/openalex-philosophy",
                "revision": "5a4a195085de54bf607a6c4397092ffb32716dcc",
                "manifestSha256": manifest_sha,
                "documentCount": manifest["document_count"]
            },
            "identity": {
                "aliasTypes": ["openalex", "doi", "crossref"],
                "normalization": {
                    "openalex": "canonical-W-id",
                    "doi": "lowercase DOI without doi.org/doi: prefix",
                    "crossref": "normalized DOI when crossref_id is a DOI"
                },
                "titleFuzzyMatching": False,
                "providerLocalIdCrossProviderMerge": False,
                "ambiguousAliasesExcluded": len(ambiguous)
            },
            "index": {
                "partitionCount": 256,
                "partitionRule": "first-byte-sha256(canonical-alias)",
                "entryCount": total_entries,
                "compressedBytes": total_bytes,
                "partitions": records
            },
            "coverage": {
                "workRows": work_count,
                "rawAliasOccurrencesByKind": dict(sorted(alias_kind_counts.items())),
                "uniqueResolvedAliases": total_entries,
                "ambiguousAliases": len(ambiguous)
            },
            "productionEnabled": False,
            "publishedToHf": False
        }
        (staging / "alias-manifest.json").write_text(
            json.dumps(manifest_out, sort_keys=True, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8"
        )
        os.replace(staging, output)
        return manifest_out
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--artifact-root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    manifest, manifest_sha = read_manifest(args.manifest, synthetic_fixture=False)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = build(manifest, manifest_sha, args.artifact_root, args.output)
    print(json.dumps({
        "status": result["status"],
        "entries": result["index"]["entryCount"],
        "compressedBytes": result["index"]["compressedBytes"],
        "ambiguous": result["identity"]["ambiguousAliasesExcluded"],
        "kinds": result["coverage"]["rawAliasOccurrencesByKind"]
    }, sort_keys=True))


if __name__ == "__main__":
    main()
