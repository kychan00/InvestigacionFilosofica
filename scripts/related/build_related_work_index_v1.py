#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import shutil
import sqlite3
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

from authority_work_map_v1 import (
    AuthorityWorkMap,
    authority_candidate_vector_ids,
    authority_map_source_summary,
    authorship_relations,
    build_authority_candidate_index,
    build_work_authority_info_index,
    load_authority_work_map,
)


SCHEMA_VERSION = "related-work-index-v1"
GENERATOR_VERSION = "related-work-index-builder-v1a"
DEFAULT_NEIGHBORS = 48
DEFAULT_AUTHORITY_NEIGHBORS = 24
DEFAULT_SEARCH_MULTIPLIER = 4
DEFAULT_SHARDS = 256
DEFAULT_BATCH_SIZE = 256


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_doi(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    text = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", text, flags=re.I)
    text = re.sub(r"^doi:\s*", "", text, flags=re.I)
    text = text.strip().lower()
    if not text.startswith("10.") or "/" not in text:
        return None
    return text


def normalize_openalex_work_id(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    match = re.search(r"(?:openalex\.org/)?(W\d+)$", text, flags=re.I)
    if not match:
        return None
    return match.group(1).upper()


def openalex_work_identity(value: Any) -> str | None:
    work_id = normalize_openalex_work_id(value)
    return f"openalex:{work_id}" if work_id else None


def canonical_work_identity(document: dict[str, Any]) -> str:
    doi = normalize_doi(document.get("doi"))
    if doi:
        return f"doi:{doi}"

    for key in ("openalex_id", "id"):
        openalex = normalize_openalex_work_id(document.get(key))
        if openalex:
            return f"openalex:{openalex}"

    crossref = str(document.get("crossref_id") or "").strip()
    if crossref:
        normalized = normalize_doi(crossref)
        if normalized:
            return f"doi:{normalized}"
        return "crossref:" + crossref.lower()

    source = str(document.get("source") or "unknown").strip().lower()
    source_id = str(document.get("id") or "").strip()
    if not source_id:
        source_id = "vector:" + str(document.get("vector_id", "unknown"))

    digest = sha256_text(source + "\0" + source_id)[:24]
    return f"record:{digest}"


def _structured_topic_id(value: Any) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        openalex_match = re.search(
            r"(?:openalex\.org/)?(T\d+)$",
            text,
            flags=re.I,
        )
        if openalex_match:
            return "openalex:" + openalex_match.group(1).upper()
        return text

    if not isinstance(value, dict):
        return None

    for key in (
        "id",
        "topic_id",
        "openalex_id",
        "topicId",
        "openalexId",
    ):
        if value.get(key):
            return _structured_topic_id(value[key])

    return None


def extract_topic_ids(raw: Any) -> tuple[str, ...]:
    if raw is None:
        return ()

    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return ()
        try:
            raw = json.loads(text)
        except json.JSONDecodeError:
            return ()

    if not isinstance(raw, list):
        return ()

    output: list[str] = []
    seen: set[str] = set()
    for item in raw:
        topic_id = _structured_topic_id(item)
        if topic_id and topic_id not in seen:
            seen.add(topic_id)
            output.append(topic_id)
    return tuple(output)


@dataclass(frozen=True)
class WorkMetadata:
    vector_id: int
    identity: str
    openalex_identity: str | None
    topics: tuple[str, ...]
    year: int | None


def load_metadata(database: Path) -> list[WorkMetadata]:
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    try:
        rows = connection.execute(
            """
            SELECT vector_id, id, year, topics_json, doi, source,
                   openalex_id, crossref_id
            FROM documents
            ORDER BY vector_id
            """
        ).fetchall()
    finally:
        connection.close()

    if not rows:
        return []

    output: list[WorkMetadata] = []
    expected_vector_id = 0
    for (
        vector_id,
        source_id,
        year,
        topics_json,
        doi,
        source,
        openalex_id,
        crossref_id,
    ) in rows:
        vector_id = int(vector_id)
        if vector_id != expected_vector_id:
            raise RuntimeError(
                "Metadata vector IDs must be unique, sequential and zero-based"
            )
        document = {
            "vector_id": vector_id,
            "id": source_id,
            "year": year,
            "topics_json": topics_json,
            "doi": doi,
            "source": source,
            "openalex_id": openalex_id,
            "crossref_id": crossref_id,
        }
        output.append(
            WorkMetadata(
                vector_id=vector_id,
                identity=canonical_work_identity(document),
                openalex_identity=(
                    openalex_work_identity(openalex_id)
                    or openalex_work_identity(source_id)
                ),
                topics=extract_topic_ids(topics_json),
                year=int(year) if year is not None else None,
            )
        )
        expected_vector_id += 1

    return output


def representative_vector_ids(
    metadata: Sequence[WorkMetadata],
) -> tuple[list[int], dict[str, int]]:
    representative: dict[str, int] = {}
    for row in metadata:
        representative.setdefault(row.identity, row.vector_id)
    ordered = sorted(representative.values())
    return ordered, representative


def shard_for_identity(identity: str, shard_count: int) -> int:
    if shard_count <= 0 or shard_count > 256:
        raise ValueError("shard_count must be between 1 and 256")
    digest = hashlib.sha256(identity.encode("utf-8")).digest()
    return digest[0] % shard_count


def semantic_signal(raw_score: float) -> float:
    if not math.isfinite(raw_score):
        return 0.0
    return round(max(0.0, min(1.0, float(raw_score))), 6)


def semantic_strength(score: float) -> str:
    return "strong" if score >= 0.8 else "supporting"


def compact_neighbor(
    seed: WorkMetadata,
    target: WorkMetadata,
    raw_score: float | None,
    *,
    observed_vector_id: int | None = None,
    authority_work_map: AuthorityWorkMap | None = None,
    authority_info_by_vector: dict[int, Any] | None = None,
) -> dict[str, Any]:
    relations: list[str] = []
    evidence: dict[str, Any] = {}

    neighbor: dict[str, Any] = {
        "t": target.identity,
        "v": target.vector_id,
        "r": relations,
        "e": evidence,
    }

    if raw_score is not None:
        score = semantic_signal(raw_score)
        relations.append("semantic-affinity")
        evidence["semanticScore"] = score
        neighbor["s"] = score

        if (
            observed_vector_id is not None
            and observed_vector_id != target.vector_id
        ):
            neighbor["o"] = int(observed_vector_id)

    shared_topics = sorted(set(seed.topics).intersection(target.topics))
    if shared_topics:
        relations.append("shared-topic")
        evidence["topicIds"] = shared_topics

    if authority_work_map is not None:
        seed_authority = (
            authority_info_by_vector.get(seed.vector_id)
            if authority_info_by_vector is not None
            else (
                authority_work_map.works.get(seed.openalex_identity)
                if seed.openalex_identity
                else None
            )
        )
        target_authority = (
            authority_info_by_vector.get(target.vector_id)
            if authority_info_by_vector is not None
            else (
                authority_work_map.works.get(target.openalex_identity)
                if target.openalex_identity
                else None
            )
        )
        authority_relations = authorship_relations(
            seed_authority,
            target_authority,
        )

        same_author_refs = authority_relations.get("same-author")
        if same_author_refs:
            relations.append("same-author")
            evidence["authorityRefs"] = list(same_author_refs)

        shared_coauthor_refs = authority_relations.get("shared-coauthor")
        if shared_coauthor_refs:
            relations.append("shared-coauthor")
            evidence["sharedAuthorityRefs"] = list(shared_coauthor_refs)

    if not relations:
        raise RuntimeError("Related Work candidate has no supported relation")

    return neighbor


def expand_compact_edge(
    seed_identity: str,
    seed_vector_id: int,
    neighbor: dict[str, Any],
) -> dict[str, Any]:
    target_identity = str(neighbor["t"])
    target_vector_id = int(neighbor["v"])
    relations = list(neighbor.get("r", []))
    compact_evidence = neighbor.get("e", {})

    evidence: list[dict[str, Any]] = []
    reasons: list[dict[str, Any]] = []
    signals: dict[str, float] = {}

    if "semantic-affinity" in relations:
        semantic_score = float(compact_evidence["semanticScore"])
        observed_vector_id = int(
            neighbor.get("o", target_vector_id)
        )
        semantic_evidence_id = (
            f"semantic:{seed_vector_id}:{target_vector_id}"
        )
        evidence.append(
            {
                "id": semantic_evidence_id,
                "class": "semantic",
                "strength": semantic_strength(semantic_score),
                "source": "qwen3-browser-static-v4",
                "semanticScore": semantic_score,
                "observedVectorId": observed_vector_id,
            }
        )
        reasons.append(
            {
                "code": "semantic-affinity",
                "relationType": "semantic-affinity",
                "evidenceRefs": [semantic_evidence_id],
            }
        )
        signals["semantic"] = semantic_score

    topic_ids = list(compact_evidence.get("topicIds", []))
    if "shared-topic" in relations:
        topic_evidence_id = (
            f"topic:{seed_vector_id}:{target_vector_id}"
        )
        evidence.append(
            {
                "id": topic_evidence_id,
                "class": "contextual",
                "strength": "supporting",
                "source": "openalex-philosophy-metadata",
                "topicIds": topic_ids,
            }
        )
        reasons.append(
            {
                "code": "shared-topic",
                "relationType": "shared-topic",
                "evidenceRefs": [topic_evidence_id],
            }
        )
        signals["topic"] = 1.0

    authority_refs = list(compact_evidence.get("authorityRefs", []))
    if "same-author" in relations:
        author_evidence_id = (
            f"author:{seed_vector_id}:{target_vector_id}"
        )
        evidence.append(
            {
                "id": author_evidence_id,
                "class": "bibliographic",
                "strength": "strong",
                "source": "author-authority-graph-v1",
                "structuredIdentity": True,
                "authorityRefs": authority_refs,
            }
        )
        reasons.append(
            {
                "code": "same-author",
                "relationType": "same-author",
                "evidenceRefs": [author_evidence_id],
            }
        )
        signals["author"] = 1.0

    shared_authority_refs = list(
        compact_evidence.get("sharedAuthorityRefs", [])
    )
    if "shared-coauthor" in relations:
        coauthor_evidence_id = (
            f"coauthor:{seed_vector_id}:{target_vector_id}"
        )
        evidence.append(
            {
                "id": coauthor_evidence_id,
                "class": "bibliographic",
                "strength": "strong",
                "source": "author-authority-graph-v1",
                "structuredIdentity": True,
                "sharedAuthorityRefs": shared_authority_refs,
            }
        )
        reasons.append(
            {
                "code": "shared-coauthor",
                "relationType": "shared-coauthor",
                "evidenceRefs": [coauthor_evidence_id],
            }
        )
        signals["coauthor"] = 1.0

    return {
        "schemaVersion": "related-work-v1",
        "id": f"rw:{seed_vector_id}:{target_vector_id}",
        "seed": {"identity": seed_identity},
        "target": {"identity": target_identity},
        "relationTypes": relations,
        "signals": signals,
        "evidence": evidence,
        "reasons": reasons,
        "identity": {"sameIntellectualWork": False},
    }


def select_neighbors(
    seed: WorkMetadata,
    candidates: Iterable[tuple[int, float]],
    metadata: Sequence[WorkMetadata],
    representative_by_identity: dict[str, int],
    *,
    limit: int,
    minimum_semantic_score: float,
    authority_work_map: AuthorityWorkMap | None = None,
    authority_info_by_vector: dict[int, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    accepted: list[dict[str, Any]] = []
    seen_targets: set[str] = set()
    counters = {
        "self": 0,
        "duplicate_identity": 0,
        "non_representative_target": 0,
        "below_floor": 0,
        "invalid_target": 0,
    }

    for target_vector_id, raw_score in candidates:
        target_vector_id = int(target_vector_id)
        observed_vector_id = target_vector_id
        if target_vector_id < 0 or target_vector_id >= len(metadata):
            counters["invalid_target"] += 1
            continue

        target = metadata[target_vector_id]

        if target.identity == seed.identity:
            counters["self"] += 1
            continue

        representative = representative_by_identity.get(target.identity)
        if representative != target.vector_id:
            counters["non_representative_target"] += 1
            target = metadata[representative]

        if target.identity in seen_targets:
            counters["duplicate_identity"] += 1
            continue

        score = semantic_signal(raw_score)
        if score < minimum_semantic_score:
            counters["below_floor"] += 1
            continue

        seen_targets.add(target.identity)
        accepted.append(
            compact_neighbor(
                seed,
                target,
                raw_score,
                observed_vector_id=observed_vector_id,
                authority_work_map=authority_work_map,
                authority_info_by_vector=authority_info_by_vector,
            )
        )

        if len(accepted) >= limit:
            break

    return accepted, counters



def select_authority_neighbors(
    seed: WorkMetadata,
    metadata: Sequence[WorkMetadata],
    authority_work_map: AuthorityWorkMap | None,
    authority_candidate_index: dict[str, tuple[int, ...]],
    authority_info_by_vector: dict[int, Any],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    if authority_work_map is None or limit <= 0:
        return []

    vector_ids = authority_candidate_vector_ids(
        seed,
        metadata,
        authority_work_map,
        authority_candidate_index,
        limit=limit,
        work_info_by_vector=authority_info_by_vector,
    )

    output = []
    for vector_id in vector_ids:
        target = metadata[vector_id]
        output.append(
            compact_neighbor(
                seed,
                target,
                None,
                authority_work_map=authority_work_map,
                authority_info_by_vector=authority_info_by_vector,
            )
        )

    return output


def merge_neighbor_sets(
    semantic_neighbors: Sequence[dict[str, Any]],
    authority_neighbors: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    output = list(semantic_neighbors)
    seen = {str(item["t"]) for item in output}

    for neighbor in authority_neighbors:
        identity = str(neighbor["t"])
        if identity in seen:
            continue
        seen.add(identity)
        output.append(neighbor)

    return output


def _artifact_record(
    path: Path,
    root: Path,
    **extra: Any,
) -> dict[str, Any]:
    return {
        "path": path.relative_to(root).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        **extra,
    }


def _write_gzip_jsonl(
    path: Path,
    rows: Sequence[dict[str, Any]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(
            filename="",
            mode="wb",
            fileobj=raw,
            mtime=0,
        ) as compressed:
            for row in rows:
                compressed.write(
                    (canonical_json(row) + "\n").encode("utf-8")
                )


def build_from_neighbor_provider(
    *,
    metadata: Sequence[WorkMetadata],
    neighbor_provider: Callable[[Sequence[int]], dict[int, list[tuple[int, float]]]],
    output_dir: Path,
    source: dict[str, Any],
    neighbors_per_seed: int = DEFAULT_NEIGHBORS,
    authority_neighbors_per_seed: int = DEFAULT_AUTHORITY_NEIGHBORS,
    authority_work_map: AuthorityWorkMap | None = None,
    search_multiplier: int = DEFAULT_SEARCH_MULTIPLIER,
    shard_count: int = DEFAULT_SHARDS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    minimum_semantic_score: float = 0.0,
) -> dict[str, Any]:
    if not metadata:
        raise RuntimeError("Metadata corpus is empty")
    if neighbors_per_seed <= 0:
        raise ValueError("neighbors_per_seed must be positive")
    if authority_neighbors_per_seed < 0:
        raise ValueError("authority_neighbors_per_seed must be >= 0")
    if search_multiplier < 1:
        raise ValueError("search_multiplier must be >= 1")
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    if not 0 <= minimum_semantic_score <= 1:
        raise ValueError("minimum_semantic_score must be between 0 and 1")

    seed_vector_ids, representative_by_identity = (
        representative_vector_ids(metadata)
    )
    authority_info_by_vector = build_work_authority_info_index(
        metadata,
        authority_work_map,
        representative_by_identity,
    )
    authority_candidate_index = build_authority_candidate_index(
        metadata,
        authority_work_map,
        representative_by_identity,
        authority_info_by_vector,
    )

    if output_dir.exists() and any(output_dir.iterdir()):
        raise RuntimeError("Output directory must be absent or empty")

    output_dir.parent.mkdir(parents=True, exist_ok=True)

    staging = Path(
        tempfile.mkdtemp(
            prefix="related-work-index-v1-",
            dir=output_dir.parent,
        )
    )

    shard_rows: list[list[dict[str, Any]]] = [
        [] for _ in range(shard_count)
    ]
    counters = {
        "documents": len(metadata),
        "unique_seed_identities": len(seed_vector_ids),
        "duplicate_seed_documents": len(metadata) - len(seed_vector_ids),
        "edges": 0,
        "seeds_without_edges": 0,
        "self": 0,
        "duplicate_identity": 0,
        "non_representative_target": 0,
        "below_floor": 0,
        "invalid_target": 0,
        "authority_candidates": 0,
        "authority_only_edges": 0,
        "same_author_edges": 0,
        "shared_coauthor_edges": 0,
    }

    try:
        for start in range(0, len(seed_vector_ids), batch_size):
            batch = seed_vector_ids[start : start + batch_size]
            observed = neighbor_provider(batch)

            for seed_vector_id in batch:
                seed = metadata[seed_vector_id]
                candidates = observed.get(seed_vector_id, [])
                semantic_selected, local = select_neighbors(
                    seed,
                    candidates,
                    metadata,
                    representative_by_identity,
                    limit=neighbors_per_seed,
                    minimum_semantic_score=minimum_semantic_score,
                    authority_work_map=authority_work_map,
                    authority_info_by_vector=authority_info_by_vector,
                )
                for key, value in local.items():
                    counters[key] += value

                authority_selected = select_authority_neighbors(
                    seed,
                    metadata,
                    authority_work_map,
                    authority_candidate_index,
                    authority_info_by_vector,
                    limit=authority_neighbors_per_seed,
                )
                counters["authority_candidates"] += len(authority_selected)

                selected = merge_neighbor_sets(
                    semantic_selected,
                    authority_selected,
                )

                if not selected:
                    counters["seeds_without_edges"] += 1

                counters["edges"] += len(selected)
                counters["authority_only_edges"] += sum(
                    1
                    for neighbor in selected
                    if "semantic-affinity" not in neighbor.get("r", [])
                    and (
                        "same-author" in neighbor.get("r", [])
                        or "shared-coauthor" in neighbor.get("r", [])
                    )
                )
                counters["same_author_edges"] += sum(
                    1
                    for neighbor in selected
                    if "same-author" in neighbor.get("r", [])
                )
                counters["shared_coauthor_edges"] += sum(
                    1
                    for neighbor in selected
                    if "shared-coauthor" in neighbor.get("r", [])
                )
                row = {
                    "s": seed.identity,
                    "v": seed.vector_id,
                    "n": selected,
                }
                shard_rows[
                    shard_for_identity(seed.identity, shard_count)
                ].append(row)

        shard_records = []
        non_empty_shards = 0
        for shard, rows in enumerate(shard_rows):
            rows.sort(key=lambda row: row["s"])
            path = staging / "shards" / f"shard-{shard:02x}.jsonl.gz"
            _write_gzip_jsonl(path, rows)
            edge_count = sum(len(row["n"]) for row in rows)
            if rows:
                non_empty_shards += 1
            shard_records.append(
                _artifact_record(
                    path,
                    staging,
                    shard=shard,
                    seed_count=len(rows),
                    edge_count=edge_count,
                )
            )

        manifest = {
            "schema_version": SCHEMA_VERSION,
            "generator_version": GENERATOR_VERSION,
            "document_count": len(metadata),
            "unique_seed_count": len(seed_vector_ids),
            "neighbors_per_seed": (
                neighbors_per_seed
                + (
                    authority_neighbors_per_seed
                    if authority_work_map is not None
                    else 0
                )
            ),
            "semantic_neighbors_per_seed": neighbors_per_seed,
            "authority_neighbors_per_seed": (
                authority_neighbors_per_seed
                if authority_work_map is not None
                else 0
            ),
            "candidate_search_k": neighbors_per_seed * search_multiplier + 1,
            "minimum_semantic_score": minimum_semantic_score,
            "source": source,
            "authority": authority_map_source_summary(authority_work_map),
            "partition": {
                "method": "sha256-first-byte-mod-shard-count",
                "shard_count": shard_count,
                "shard_name": "shard-{byte:02x}.jsonl.gz",
            },
            "identity": {
                "preference": [
                    "doi",
                    "openalex-work-id",
                    "crossref-id",
                    "provider-record-hash",
                ],
                "duplicate_policy": "lowest-vector-id-representative",
            },
            "relations": {
                "generated": [
                    "semantic-affinity",
                    "shared-topic",
                    *(
                        [
                            "same-author",
                            "shared-coauthor",
                        ]
                        if authority_work_map is not None
                        else []
                    ),
                ],
                "not_generated_without_authority_graph": (
                    []
                    if authority_work_map is not None
                    else [
                        "same-author",
                        "shared-coauthor",
                    ]
                ),
                "not_generated_without_reference_graph": [
                    "cited-by-seed",
                    "cites-seed",
                    "bibliographic-reference",
                ],
            },
            "metadata_lookup": {
                "key": "vector_id",
                "external": True,
                "recommended_source": "qwen3-browser-semantic-static-v4 metadata pages",
            },
            "shards": shard_records,
            "totals": {
                **counters,
                "non_empty_shards": non_empty_shards,
                "artifact_bytes": sum(record["bytes"] for record in shard_records),
            },
        }

        manifest_path = staging / "manifest.json"
        manifest_path.write_text(
            canonical_json(manifest) + "\n",
            encoding="utf-8",
        )

        report = {
            "schema_version": "related-work-index-build-report-v1",
            "status": "built",
            "manifest_sha256": sha256_file(manifest_path),
            "totals": manifest["totals"],
        }
        (staging / "build-report.json").write_text(
            json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )

        if output_dir.exists():
            if any(output_dir.iterdir()):
                raise RuntimeError("Output directory changed during build")
            output_dir.rmdir()
        staging.rename(output_dir)

        return {
            "status": "built",
            "output": str(output_dir),
            "manifest_sha256": sha256_file(output_dir / "manifest.json"),
            "unique_seed_count": len(seed_vector_ids),
            "edge_count": counters["edges"],
        }
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        raise


def faiss_neighbor_provider(
    *,
    index: Any,
    metadata_count: int,
    search_k: int,
) -> Callable[[Sequence[int]], dict[int, list[tuple[int, float]]]]:
    import numpy as np
    import faiss

    if int(index.ntotal) != metadata_count:
        raise RuntimeError("FAISS document count does not match metadata")
    if int(index.d) <= 0:
        raise RuntimeError("FAISS dimension is invalid")
    if getattr(index, "metric_type", None) != faiss.METRIC_INNER_PRODUCT:
        raise RuntimeError(
            "Related Work V1 requires the frozen inner-product FAISS index"
        )

    ids = faiss.vector_to_array(index.id_map).astype(np.int64, copy=False)
    expected = np.arange(metadata_count, dtype=np.int64)
    if not np.array_equal(ids, expected):
        raise RuntimeError("FAISS IDs must be sequential and match vector_id")

    inner = faiss.downcast_index(index.index)

    def provider(seed_vector_ids: Sequence[int]) -> dict[int, list[tuple[int, float]]]:
        seed_ids = np.asarray(seed_vector_ids, dtype=np.int64)
        queries = np.asarray(
            inner.reconstruct_batch(seed_ids),
            dtype=np.float32,
        )
        norms = np.linalg.norm(queries, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        queries = np.ascontiguousarray(queries / norms, dtype=np.float32)
        scores, neighbors = index.search(queries, search_k)

        output: dict[int, list[tuple[int, float]]] = {}
        for row, seed_vector_id in enumerate(seed_vector_ids):
            output[int(seed_vector_id)] = [
                (int(target), float(score))
                for target, score in zip(neighbors[row], scores[row], strict=True)
                if int(target) >= 0
            ]
        return output

    return provider


def fixture_neighbor_provider(
    payload: dict[str, Any],
) -> Callable[[Sequence[int]], dict[int, list[tuple[int, float]]]]:
    raw = payload.get("neighbors", {})

    def provider(seed_vector_ids: Sequence[int]) -> dict[int, list[tuple[int, float]]]:
        output = {}
        for seed_vector_id in seed_vector_ids:
            rows = raw.get(str(seed_vector_id), raw.get(seed_vector_id, []))
            output[int(seed_vector_id)] = [
                (int(target), float(score))
                for target, score in rows
            ]
        return output

    return provider


def load_fixture_metadata(payload: dict[str, Any]) -> list[WorkMetadata]:
    documents = sorted(
        payload.get("documents", []),
        key=lambda row: int(row["vector_id"]),
    )
    output = []
    for expected, row in enumerate(documents):
        vector_id = int(row["vector_id"])
        if vector_id != expected:
            raise RuntimeError("Fixture vector IDs must be sequential and zero-based")
        output.append(
            WorkMetadata(
                vector_id=vector_id,
                identity=canonical_work_identity(row),
                openalex_identity=(
                    openalex_work_identity(row.get("openalex_id"))
                    or openalex_work_identity(row.get("id"))
                ),
                topics=extract_topic_ids(row.get("topics", [])),
                year=int(row["year"]) if row.get("year") is not None else None,
            )
        )
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--neighbors", type=int, default=DEFAULT_NEIGHBORS)
    parser.add_argument(
        "--authority-neighbors",
        type=int,
        default=DEFAULT_AUTHORITY_NEIGHBORS,
    )
    parser.add_argument(
        "--authority-work-map",
        type=Path,
    )
    parser.add_argument(
        "--search-multiplier",
        type=int,
        default=DEFAULT_SEARCH_MULTIPLIER,
    )
    parser.add_argument("--shards", type=int, default=DEFAULT_SHARDS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--minimum-semantic-score", type=float, default=0.0)

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--fixture-json", type=Path)
    mode.add_argument("--faiss", type=Path)

    parser.add_argument("--metadata-db", type=Path)
    parser.add_argument("--semantic-manifest", type=Path)
    args = parser.parse_args()

    if args.fixture_json:
        payload = json.loads(args.fixture_json.read_text(encoding="utf-8"))
        metadata = load_fixture_metadata(payload)
        provider = fixture_neighbor_provider(payload)
        source = {
            "mode": "fixture",
            "fixture_sha256": sha256_file(args.fixture_json),
        }
    else:
        if not args.metadata_db or not args.semantic_manifest:
            parser.error(
                "--faiss production mode requires --metadata-db and --semantic-manifest"
            )

        import faiss

        manifest = json.loads(
            args.semantic_manifest.read_text(encoding="utf-8")
        )
        faiss_sha = sha256_file(args.faiss)
        if manifest.get("source", {}).get("faiss_sha256") != faiss_sha:
            raise RuntimeError("FAISS lineage does not match semantic manifest")

        metadata = load_metadata(args.metadata_db)
        if manifest.get("document_count") != len(metadata):
            raise RuntimeError("Metadata count does not match semantic manifest")

        index = faiss.read_index(str(args.faiss))
        search_k = args.neighbors * args.search_multiplier + 1
        provider = faiss_neighbor_provider(
            index=index,
            metadata_count=len(metadata),
            search_k=search_k,
        )
        source = {
            "mode": "frozen-faiss",
            "faiss_sha256": faiss_sha,
            "metadata_sqlite_sha256": sha256_file(args.metadata_db),
            "semantic_manifest_sha256": sha256_file(args.semantic_manifest),
            "semantic_artifact_version": manifest.get("artifact_version"),
            "document_count": manifest.get("document_count"),
            "dimension": manifest.get("dimension"),
        }

    authority_work_map = (
        load_authority_work_map(args.authority_work_map)
        if args.authority_work_map
        else None
    )

    result = build_from_neighbor_provider(
        metadata=metadata,
        neighbor_provider=provider,
        output_dir=args.output_dir,
        source=source,
        neighbors_per_seed=args.neighbors,
        authority_neighbors_per_seed=args.authority_neighbors,
        authority_work_map=authority_work_map,
        search_multiplier=args.search_multiplier,
        shard_count=args.shards,
        batch_size=args.batch_size,
        minimum_semantic_score=args.minimum_semantic_score,
    )
    print(canonical_json(result))


if __name__ == "__main__":
    main()
