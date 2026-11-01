#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

from build_related_work_index_v1 import (
    SCHEMA_VERSION,
    expand_compact_edge,
    shard_for_identity,
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
    if path.stat().st_size != int(record["bytes"]):
        raise RuntimeError(f"Size mismatch: {record['path']}")
    if sha256_file(path) != record["sha256"]:
        raise RuntimeError(f"SHA-256 mismatch: {record['path']}")
    return path


def load_rows(path: Path) -> list[dict[str, Any]]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return [
            json.loads(line)
            for line in handle
            if line.strip()
        ]


def validate_neighbor(
    seed: dict[str, Any],
    neighbor: dict[str, Any],
    *,
    document_count: int,
) -> None:
    target = str(neighbor.get("t") or "")
    if not target:
        raise RuntimeError("Neighbor identity is missing")
    if target == seed["s"]:
        raise RuntimeError("Self relation survived into artifact")

    target_vector_id = int(neighbor.get("v", -1))
    if target_vector_id < 0 or target_vector_id >= document_count:
        raise RuntimeError("Neighbor vector ID is outside corpus bounds")

    relations = neighbor.get("r")
    if not isinstance(relations, list) or not relations:
        raise RuntimeError("Neighbor must declare at least one relation")

    evidence = neighbor.get("e")
    if not isinstance(evidence, dict):
        raise RuntimeError("Compact evidence payload is missing")

    if "semantic-affinity" in relations:
        observed_vector_id = int(neighbor.get("o", target_vector_id))
        if observed_vector_id < 0 or observed_vector_id >= document_count:
            raise RuntimeError("Observed semantic vector ID is outside corpus bounds")

        score = float(neighbor.get("s", -1))
        if not 0 <= score <= 1:
            raise RuntimeError("Semantic signal is outside [0, 1]")

        semantic_score = float(evidence.get("semanticScore", -1))
        if semantic_score != score:
            raise RuntimeError("Compact semantic score does not match signal")
    else:
        if "s" in neighbor or "semanticScore" in evidence or "o" in neighbor:
            raise RuntimeError(
                "Authority-only neighbor contains semantic evidence without semantic-affinity"
            )

    topic_ids = evidence.get("topicIds", [])
    if "shared-topic" in relations:
        if not isinstance(topic_ids, list) or not topic_ids:
            raise RuntimeError("shared-topic requires topicIds")
    elif topic_ids:
        raise RuntimeError("topicIds present without shared-topic relation")

    authority_refs = evidence.get("authorityRefs", [])
    if "same-author" in relations:
        if (
            not isinstance(authority_refs, list)
            or not authority_refs
            or len(set(authority_refs)) != len(authority_refs)
            or not all(str(value).strip() for value in authority_refs)
        ):
            raise RuntimeError("same-author requires unique authorityRefs")
    elif authority_refs:
        raise RuntimeError("authorityRefs present without same-author relation")

    shared_authority_refs = evidence.get("sharedAuthorityRefs", [])
    if "shared-coauthor" in relations:
        if (
            not isinstance(shared_authority_refs, list)
            or not shared_authority_refs
            or len(set(shared_authority_refs)) != len(shared_authority_refs)
            or not all(str(value).strip() for value in shared_authority_refs)
        ):
            raise RuntimeError(
                "shared-coauthor requires unique sharedAuthorityRefs"
            )
        if not set(shared_authority_refs).issubset(set(authority_refs)):
            raise RuntimeError(
                "shared-coauthor refs must also be present in same-author authorityRefs"
            )
        if "same-author" not in relations:
            raise RuntimeError(
                "shared-coauthor requires same-author in Related Work V1C"
            )
    elif shared_authority_refs:
        raise RuntimeError(
            "sharedAuthorityRefs present without shared-coauthor relation"
        )

    # Expansion is the compatibility bridge to the public RelatedWorkEdge V1
    # contract. Python checks structural equivalence here; JavaScript tests run
    # the authoritative contract validator over the same compact shape.
    expanded = expand_compact_edge(
        str(seed["s"]),
        int(seed["v"]),
        neighbor,
    )
    if expanded["seed"]["identity"] != seed["s"]:
        raise RuntimeError("Expanded seed identity changed")
    if expanded["target"]["identity"] != target:
        raise RuntimeError("Expanded target identity changed")


def validate_artifact(
    artifact_dir: Path,
) -> dict[str, Any]:
    manifest_path = artifact_dir / "manifest.json"
    if not manifest_path.is_file():
        raise RuntimeError("manifest.json is missing")

    manifest = json.loads(
        manifest_path.read_text(encoding="utf-8")
    )

    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise RuntimeError("Related Work manifest schema mismatch")

    document_count = int(manifest["document_count"])
    unique_seed_count = int(manifest["unique_seed_count"])
    neighbors_per_seed = int(manifest["neighbors_per_seed"])
    shard_count = int(manifest["partition"]["shard_count"])

    if document_count <= 0:
        raise RuntimeError("document_count must be positive")
    if unique_seed_count <= 0 or unique_seed_count > document_count:
        raise RuntimeError("unique_seed_count is inconsistent")
    if neighbors_per_seed <= 0:
        raise RuntimeError("neighbors_per_seed must be positive")
    if shard_count <= 0 or shard_count > 256:
        raise RuntimeError("shard_count is invalid")

    records = manifest.get("shards", [])
    if len(records) != shard_count:
        raise RuntimeError("Manifest shard count does not match partition contract")

    observed_seed_count = 0
    observed_edge_count = 0
    observed_non_empty_shards = 0
    observed_seeds: set[str] = set()

    for expected_shard, record in enumerate(records):
        if int(record["shard"]) != expected_shard:
            raise RuntimeError("Shard records are not in deterministic order")

        expected_name = f"shards/shard-{expected_shard:02x}.jsonl.gz"
        if record["path"] != expected_name:
            raise RuntimeError(f"Unexpected shard path: {record['path']}")

        path = verify_file(artifact_dir, record)
        rows = load_rows(path)

        if len(rows) != int(record["seed_count"]):
            raise RuntimeError(f"Seed count mismatch in shard {expected_shard}")

        edge_count = sum(len(row.get("n", [])) for row in rows)
        if edge_count != int(record["edge_count"]):
            raise RuntimeError(f"Edge count mismatch in shard {expected_shard}")

        if rows:
            observed_non_empty_shards += 1

        identities = [str(row.get("s") or "") for row in rows]
        if identities != sorted(identities):
            raise RuntimeError(f"Seeds are not sorted in shard {expected_shard}")

        for row in rows:
            identity = str(row.get("s") or "")
            if not identity:
                raise RuntimeError("Seed identity is missing")
            if identity in observed_seeds:
                raise RuntimeError("Seed identity appears in multiple shards")
            observed_seeds.add(identity)

            if shard_for_identity(identity, shard_count) != expected_shard:
                raise RuntimeError("Seed routed to incorrect shard")

            seed_vector_id = int(row.get("v", -1))
            if seed_vector_id < 0 or seed_vector_id >= document_count:
                raise RuntimeError("Seed vector ID is outside corpus bounds")

            neighbors = row.get("n")
            if not isinstance(neighbors, list):
                raise RuntimeError("Seed neighbors must be a list")
            if len(neighbors) > neighbors_per_seed:
                raise RuntimeError("Seed exceeds neighbors_per_seed")

            targets: set[str] = set()
            for neighbor in neighbors:
                target = str(neighbor.get("t") or "")
                if target in targets:
                    raise RuntimeError("Duplicate target identity in a seed")
                targets.add(target)

                validate_neighbor(
                    row,
                    neighbor,
                    document_count=document_count,
                )

        observed_seed_count += len(rows)
        observed_edge_count += edge_count

    totals = manifest.get("totals", {})
    if observed_seed_count != unique_seed_count:
        raise RuntimeError("Unique seed count mismatch")
    if observed_seed_count != int(totals.get("unique_seed_identities", -1)):
        raise RuntimeError("Totals unique seed count mismatch")
    if observed_edge_count != int(totals.get("edges", -1)):
        raise RuntimeError("Totals edge count mismatch")
    if observed_non_empty_shards != int(totals.get("non_empty_shards", -1)):
        raise RuntimeError("Totals non-empty shard count mismatch")

    artifact_bytes = sum(int(record["bytes"]) for record in records)
    if artifact_bytes != int(totals.get("artifact_bytes", -1)):
        raise RuntimeError("Artifact byte total mismatch")

    report_path = artifact_dir / "build-report.json"
    if not report_path.is_file():
        raise RuntimeError("build-report.json is missing")

    build_report = json.loads(
        report_path.read_text(encoding="utf-8")
    )
    if build_report.get("manifest_sha256") != sha256_file(manifest_path):
        raise RuntimeError("Build report manifest hash mismatch")

    return {
        "schema_version": "related-work-index-validation-v1",
        "status": "pass",
        "manifest_sha256": sha256_file(manifest_path),
        "document_count": document_count,
        "unique_seed_count": observed_seed_count,
        "edge_count": observed_edge_count,
        "non_empty_shards": observed_non_empty_shards,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    report = validate_artifact(args.artifact_dir)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(
                report,
                ensure_ascii=False,
                sort_keys=True,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    print(
        json.dumps(
            report,
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
