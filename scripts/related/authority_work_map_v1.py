from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


SCHEMA_VERSION = "authority-work-map-v1"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def shard_for_work_identity(
    identity: str,
    shard_count: int,
) -> int:
    if shard_count <= 0 or shard_count > 256:
        raise ValueError("shard_count must be between 1 and 256")
    digest = hashlib.sha256(identity.encode("utf-8")).digest()
    return digest[0] % shard_count


@dataclass(frozen=True)
class AuthorityWorkInfo:
    work_identity: str
    author_count: int
    unresolved_count: int
    authority_refs: tuple[str, ...]


@dataclass(frozen=True)
class AuthorityWorkMap:
    manifest: dict[str, Any]
    works: dict[str, AuthorityWorkInfo]


def _authority_refs(raw: Any) -> tuple[str, ...]:
    if not isinstance(raw, list):
        raise RuntimeError("authority work row authors must be a list")

    refs = []
    seen = set()

    for item in raw:
        if not isinstance(item, dict):
            raise RuntimeError("authority work author entry must be an object")
        ref = str(item.get("r") or "").strip()
        if not ref:
            raise RuntimeError("authority work author entry is missing authority ref")
        if ref in seen:
            raise RuntimeError("authority work row contains duplicate authority ref")
        seen.add(ref)
        refs.append(ref)

    return tuple(sorted(refs))


def _parse_row(
    row: dict[str, Any],
) -> AuthorityWorkInfo:
    identity = str(row.get("w") or "").strip()
    if not identity.startswith("openalex:W"):
        raise RuntimeError("authority work row has invalid work identity")

    author_count = int(row.get("n", -1))
    unresolved_count = int(row.get("u", -1))
    if author_count < 0 or unresolved_count < 0:
        raise RuntimeError("authority work row has invalid author counts")
    if unresolved_count > author_count:
        raise RuntimeError("authority work unresolved count exceeds author count")

    refs = _authority_refs(row.get("a"))
    if len(refs) + unresolved_count > author_count:
        raise RuntimeError(
            "authority work resolved/unresolved counts exceed raw author count"
        )

    return AuthorityWorkInfo(
        work_identity=identity,
        author_count=author_count,
        unresolved_count=unresolved_count,
        authority_refs=refs,
    )


def load_authority_work_map(
    root: Path,
) -> AuthorityWorkMap:
    root = Path(root)
    manifest_path = root / "manifest.json"

    if not manifest_path.is_file():
        raise RuntimeError("authority work map manifest.json is missing")

    manifest = json.loads(
        manifest_path.read_text(encoding="utf-8")
    )

    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise RuntimeError("authority work map schema mismatch")

    partition = manifest.get("partition") or {}
    shard_count = int(partition.get("shardCount", 0))
    if shard_count <= 0 or shard_count > 256:
        raise RuntimeError("authority work map shard count is invalid")

    records = (manifest.get("files") or {}).get("shards") or []
    if len(records) != shard_count:
        raise RuntimeError("authority work map shard inventory is incomplete")

    works: dict[str, AuthorityWorkInfo] = {}

    for expected_shard, record in enumerate(records):
        if int(record.get("shard", -1)) != expected_shard:
            raise RuntimeError("authority work map shard order is invalid")

        path = root / str(record.get("path") or "")
        if not path.is_file():
            raise RuntimeError(f"authority work map shard is missing: {record.get('path')}")

        if record.get("sizeBytes") is not None:
            if path.stat().st_size != int(record["sizeBytes"]):
                raise RuntimeError(
                    f"authority work map shard size mismatch: {record.get('path')}"
                )

        if record.get("sha256"):
            if sha256_file(path) != record["sha256"]:
                raise RuntimeError(
                    f"authority work map shard hash mismatch: {record.get('path')}"
                )

        observed_rows = 0
        previous_identity: str | None = None

        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue

                info = _parse_row(json.loads(line))

                if shard_for_work_identity(info.work_identity, shard_count) != expected_shard:
                    raise RuntimeError("authority work row routed to incorrect shard")

                if previous_identity is not None and info.work_identity <= previous_identity:
                    raise RuntimeError(
                        "authority work rows must be strictly sorted within a shard"
                    )
                previous_identity = info.work_identity

                if info.work_identity in works:
                    raise RuntimeError(
                        "authority work identity appears in multiple shards"
                    )

                works[info.work_identity] = info
                observed_rows += 1

        if record.get("rows") is not None and observed_rows != int(record["rows"]):
            raise RuntimeError(
                f"authority work row count mismatch: {record.get('path')}"
            )

    declared = (manifest.get("counts") or {}).get("worksMapped")
    if declared is not None and len(works) != int(declared):
        raise RuntimeError("authority work map worksMapped count mismatch")

    return AuthorityWorkMap(
        manifest=manifest,
        works=works,
    )


def shared_authority_refs(
    left: AuthorityWorkInfo | None,
    right: AuthorityWorkInfo | None,
) -> tuple[str, ...]:
    if not left or not right:
        return ()

    return tuple(
        sorted(
            set(left.authority_refs)
            .intersection(right.authority_refs)
        )
    )


def authorship_relations(
    left: AuthorityWorkInfo | None,
    right: AuthorityWorkInfo | None,
) -> dict[str, tuple[str, ...]]:
    shared = shared_authority_refs(left, right)

    if not shared:
        return {}

    output = {
        "same-author": shared,
    }

    if (
        left is not None
        and right is not None
        and left.author_count > 1
        and right.author_count > 1
    ):
        output["shared-coauthor"] = shared

    return output


def build_authority_candidate_index(
    metadata: Sequence[Any],
    authority_map: AuthorityWorkMap | None,
    representative_by_identity: dict[str, int],
) -> dict[str, tuple[int, ...]]:
    if authority_map is None:
        return {}

    buckets: dict[str, set[int]] = {}

    for row in metadata:
        if representative_by_identity.get(row.identity) != row.vector_id:
            continue

        work_identity = getattr(row, "openalex_identity", None)
        if not work_identity:
            continue

        info = authority_map.works.get(work_identity)
        if not info:
            continue

        for authority_ref in info.authority_refs:
            buckets.setdefault(authority_ref, set()).add(row.vector_id)

    return {
        authority_ref: tuple(sorted(vector_ids))
        for authority_ref, vector_ids in buckets.items()
    }


def authority_candidate_vector_ids(
    seed: Any,
    metadata: Sequence[Any],
    authority_map: AuthorityWorkMap | None,
    candidate_index: dict[str, tuple[int, ...]],
    *,
    limit: int,
) -> list[int]:
    if authority_map is None or limit <= 0:
        return []

    work_identity = getattr(seed, "openalex_identity", None)
    if not work_identity:
        return []

    seed_info = authority_map.works.get(work_identity)
    if not seed_info:
        return []

    shared_by_target: dict[int, set[str]] = {}

    for authority_ref in seed_info.authority_refs:
        for vector_id in candidate_index.get(authority_ref, ()):
            if vector_id == seed.vector_id:
                continue
            shared_by_target.setdefault(vector_id, set()).add(authority_ref)

    def year_distance(vector_id: int) -> int:
        target_year = getattr(metadata[vector_id], "year", None)
        seed_year = getattr(seed, "year", None)
        if target_year is None or seed_year is None:
            return 10**9
        return abs(int(target_year) - int(seed_year))

    ordered = sorted(
        shared_by_target,
        key=lambda vector_id: (
            -len(shared_by_target[vector_id]),
            year_distance(vector_id),
            vector_id,
        ),
    )

    return ordered[:limit]


def authority_map_source_summary(
    authority_map: AuthorityWorkMap | None,
) -> dict[str, Any] | None:
    if authority_map is None:
        return None

    manifest = authority_map.manifest

    return {
        "schemaVersion": manifest.get("schemaVersion"),
        "buildRevision": manifest.get("buildRevision"),
        "source": manifest.get("source"),
        "counts": manifest.get("counts"),
    }
