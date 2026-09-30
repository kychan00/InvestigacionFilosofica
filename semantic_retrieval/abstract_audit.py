from __future__ import annotations

import hashlib
import heapq
import json
import os
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from .config import RetrievalSettings
from .dataset_source import HuggingFaceDocumentSource, eligible_for_search
from .documents import build_document_text, normalize_document

AUDIT_SCHEMA_VERSION = "semantic-abstract-coverage-audit-v1"
SAMPLE_SEED = 20260930
USEFUL_ABSTRACT_CHARACTERS = 200
AUDIT_COLUMNS = (
    "work_id",
    "title",
    "abstract",
    "publication_year",
    "language",
    "type",
    "tier",
    "document_role",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _normalized_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def _openalex_id(work_id: Any) -> str | None:
    if work_id is None:
        return None
    value = str(work_id).removeprefix("https://openalex.org/").removeprefix("W")
    return f"W{value}"


def _display_key(value: Any) -> str:
    normalized = _normalized_text(value)
    return normalized or "__missing__"


def _sample_row(record: dict[str, Any], abstract: str) -> dict[str, Any]:
    work_id = record.get("work_id")
    return {
        "work_id": work_id,
        "openalex_id": _openalex_id(work_id),
        "title": _normalized_text(record.get("title")),
        "year": record.get("publication_year"),
        "language": _normalized_text(record.get("language")) or None,
        "abstract": abstract or None,
        "abstract_length": len(abstract),
        "tier": _normalized_text(record.get("tier")) or None,
        "document_role": _normalized_text(record.get("document_role")) or None,
        "publication_type": _normalized_text(record.get("type")) or None,
    }


class DeterministicSampler:
    def __init__(self, *, capacity: int, seed: int, label: str):
        self.capacity = capacity
        self.seed = seed
        self.label = label
        self._heap: list[tuple[int, str, dict[str, Any]]] = []

    def add(self, identity: str, row: dict[str, Any]) -> None:
        payload = f"{self.seed}\0{self.label}\0{identity}".encode()
        priority = int.from_bytes(hashlib.sha256(payload).digest(), "big")
        item = (-priority, identity, row)
        if len(self._heap) < self.capacity:
            heapq.heappush(self._heap, item)
        elif priority < -self._heap[0][0]:
            heapq.heapreplace(self._heap, item)

    def rows(self) -> list[dict[str, Any]]:
        ordered = sorted(
            ((-priority, identity, row) for priority, identity, row in self._heap),
            key=lambda item: (item[0], item[1]),
        )
        return [row for _, _, row in ordered]


def _increment_breakdown(
    breakdown: dict[str, dict[str, int]], key: str, *, has_abstract: bool
) -> None:
    item = breakdown[key]
    item["eligible"] += 1
    if has_abstract:
        item["with_abstract"] += 1
    else:
        item["without_abstract"] += 1


def _finalize_breakdown(
    breakdown: dict[str, dict[str, int]],
) -> list[dict[str, Any]]:
    output = []
    for value in sorted(breakdown, key=lambda item: (item == "__missing__", item)):
        item = breakdown[value]
        output.append(
            {
                "value": value,
                **item,
                "coverage_percent": round(
                    item["with_abstract"] / item["eligible"] * 100, 6
                ),
            }
        )
    return output


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, path)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def _atomic_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        os.replace(temporary_name, path)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def _smoke_inputs(artifacts_dir: Path, limit: int) -> dict[str, Any]:
    try:
        import pyarrow.parquet as pq
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before auditing smoke inputs."
        ) from error

    manifest_path = artifacts_dir / "embeddings" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows: list[dict[str, Any]] = []
    for shard in manifest["shards"]:
        path = artifacts_dir / "embeddings" / shard["file"]
        table = pq.read_table(
            path,
            columns=["vector_id", "id", "abstract", "original_json"],
        )
        for record in table.to_pylist():
            if not _normalized_text(record.get("abstract")):
                continue
            original = json.loads(record["original_json"])
            document = normalize_document(original)
            embedding_input = build_document_text(document)
            rows.append(
                {
                    "vector_id": record["vector_id"],
                    "document_id": record["id"],
                    "openalex_id": document.openalex_id,
                    "title": document.title,
                    "abstract_length": len(document.abstract or ""),
                    "embedding_input": embedding_input,
                    "embedding_input_sha256": hashlib.sha256(
                        embedding_input.encode("utf-8")
                    ).hexdigest(),
                    "abstract_block_present": bool(
                        document.abstract
                        and f"Abstract:\n{document.abstract}" in embedding_input
                    ),
                }
            )
            if len(rows) >= limit:
                return {"manifest": str(manifest_path), "documents": rows}
    return {"manifest": str(manifest_path), "documents": rows}


def audit_abstracts(
    settings: RetrievalSettings,
    *,
    output_path: Path,
    sample_size: int = 50,
    seed: int = SAMPLE_SEED,
    batch_size: int = 4096,
    smoke_artifacts_dir: Path | None = None,
    smoke_input_count: int = 5,
    progress_interval: int = 100_000,
    decision: str = "PENDING_REVIEW",
    decision_reason: str | None = None,
) -> dict[str, Any]:
    allowed_decisions = {"PENDING_REVIEW", "PASS", "NEEDS_ENRICHMENT"}
    if decision not in allowed_decisions:
        raise ValueError(f"Unsupported gate decision: {decision}")
    if decision != "PENDING_REVIEW" and not decision_reason:
        raise ValueError("A final gate decision requires a reason")

    try:
        import pyarrow.parquet as pq
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before auditing Parquet."
        ) from error

    source = HuggingFaceDocumentSource(settings)
    source_path = source.download()
    parquet = pq.ParquetFile(source_path)
    total_rows = parquet.metadata.num_rows
    missing_columns = sorted(set(AUDIT_COLUMNS) - set(parquet.schema.names))
    if missing_columns:
        raise ValueError(f"Audit columns missing from Parquet: {missing_columns}")

    samplers = {
        "with_abstract": DeterministicSampler(
            capacity=sample_size, seed=seed, label="with_abstract"
        ),
        "without_abstract": DeterministicSampler(
            capacity=sample_size, seed=seed, label="without_abstract"
        ),
        "short_abstract": DeterministicSampler(
            capacity=sample_size, seed=seed, label="short_abstract_1_199"
        ),
    }
    breakdowns: dict[str, dict[str, dict[str, int]]] = {
        field: defaultdict(
            lambda: {"eligible": 0, "with_abstract": 0, "without_abstract": 0}
        )
        for field in ("tier", "document_role", "publication_year", "language", "type")
    }
    bins = {
        "0": 0,
        "1-49": 0,
        "50-199": 0,
        "200-499": 0,
        "500-999": 0,
        "1000+": 0,
    }
    lengths: list[int] = []
    scanned_rows = 0
    eligible_rows = 0

    for batch in parquet.iter_batches(batch_size=batch_size, columns=AUDIT_COLUMNS):
        for record in batch.to_pylist():
            scanned_rows += 1
            if not eligible_for_search(record):
                continue
            eligible_rows += 1
            abstract = _normalized_text(record.get("abstract"))
            length = len(abstract)
            has_abstract = length > 0
            identity = _openalex_id(record.get("work_id")) or str(scanned_rows)
            row = _sample_row(record, abstract)
            if has_abstract:
                lengths.append(length)
                samplers["with_abstract"].add(identity, row)
            else:
                samplers["without_abstract"].add(identity, row)

            if length == 0:
                bins["0"] += 1
            elif length < 50:
                bins["1-49"] += 1
                samplers["short_abstract"].add(identity, row)
            elif length < 200:
                bins["50-199"] += 1
                samplers["short_abstract"].add(identity, row)
            elif length < 500:
                bins["200-499"] += 1
            elif length < 1000:
                bins["500-999"] += 1
            else:
                bins["1000+"] += 1

            for field, breakdown in breakdowns.items():
                _increment_breakdown(
                    breakdown,
                    _display_key(record.get(field)),
                    has_abstract=has_abstract,
                )
        if progress_interval and scanned_rows % progress_interval < batch_size:
            print(
                json.dumps(
                    {
                        "stage": "scan",
                        "scanned_rows": scanned_rows,
                        "total_rows": total_rows,
                        "eligible_rows": eligible_rows,
                    }
                ),
                flush=True,
            )

    if scanned_rows != total_rows:
        raise RuntimeError(
            f"Scanned {scanned_rows} rows but metadata reports {total_rows}"
        )

    values = np.asarray(lengths, dtype=np.int64)
    useful = values[values >= USEFUL_ABSTRACT_CHARACTERS]
    with_abstract = len(lengths)
    sample_dir = output_path.parent / f"{output_path.stem}-samples"
    sample_paths = {}
    for label, sampler in samplers.items():
        path = sample_dir / f"{label}.jsonl"
        rows = sampler.rows()
        _atomic_jsonl(path, rows)
        sample_paths[label] = {
            "path": str(path),
            "rows": len(rows),
            "sha256": _sha256(path),
        }

    smoke = None
    if smoke_artifacts_dir is not None:
        smoke = _smoke_inputs(smoke_artifacts_dir, smoke_input_count)
        smoke_path = sample_dir / "smoke-embedding-inputs.jsonl"
        _atomic_jsonl(smoke_path, smoke["documents"])
        smoke["path"] = str(smoke_path)
        smoke["sha256"] = _sha256(smoke_path)

    length_statistics = {
        "count": with_abstract,
        "mean_characters": round(float(values.mean()), 6) if values.size else None,
        "median_characters": (
            float(np.percentile(values, 50)) if values.size else None
        ),
        "percentile_25_characters": (
            float(np.percentile(values, 25)) if values.size else None
        ),
        "percentile_75_characters": (
            float(np.percentile(values, 75)) if values.size else None
        ),
        "minimum_nonempty_characters": int(values.min()) if values.size else None,
        "minimum_useful_characters_observed": int(useful.min())
        if useful.size
        else None,
        "maximum_characters": int(values.max()) if values.size else None,
    }

    report = {
        "schema_version": AUDIT_SCHEMA_VERSION,
        "generated_at": _now(),
        "dataset": {
            "repo": settings.dataset_repo,
            "revision": settings.dataset_revision,
            "file": settings.dataset_file,
            "resolved_path": str(source_path),
            "sha256": _sha256(source_path),
        },
        "eligibility": {
            "tiers": ["CORE", "PROBABLE"],
            "excluded_document_roles": ["LOW_QUALITY", "PARATEXT"],
            "implementation": "semantic_retrieval.dataset_source.eligible_for_search",
        },
        "definitions": {
            "abstract_normalization": "collapse whitespace and strip",
            "with_abstract": "normalized length > 0",
            "short_abstract": "normalized length 1-199",
            "useful_abstract_minimum_characters": USEFUL_ABSTRACT_CHARACTERS,
        },
        "counts": {
            "total_rows": total_rows,
            "eligible_rows": eligible_rows,
            "with_abstract": with_abstract,
            "without_abstract": eligible_rows - with_abstract,
            "coverage_percent": round(with_abstract / eligible_rows * 100, 6),
        },
        "abstract_lengths_nonempty": length_statistics,
        "length_bins": bins,
        "breakdowns": {
            field: _finalize_breakdown(breakdown)
            for field, breakdown in breakdowns.items()
        },
        "samples": {
            "seed": seed,
            "method": "lowest SHA-256 priority by seed, category and OpenAlex ID",
            **sample_paths,
        },
        "smoke_embedding_inputs": smoke,
        "gate": {
            "decision": decision,
            "reason": decision_reason
            or "Coverage and reproducible samples require review before PASS or NEEDS_ENRICHMENT.",
            "mass_embedding_build_allowed": decision == "PASS",
        },
    }
    _atomic_json(output_path, report)
    return report
