from __future__ import annotations

import json
import os
import tempfile
from itertools import zip_longest
from pathlib import Path
from typing import Any

from .abstract_enrichment import (
    API_CAPTURE_SCHEMA_VERSION,
    _atomic_json,
    normalize_openalex_id,
    read_targets,
    sha256_file,
)
from .config import RetrievalSettings
from .dataset_source import HuggingFaceDocumentSource

ENRICHED_CORPUS_SCHEMA_VERSION = "semantic-enriched-corpus-v3.3-build-v1"


def _normalized_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def load_validated_capture(
    *,
    targets_path: Path,
    capture_path: Path,
    capture_manifest_path: Path,
    expected_targets_sha256: str,
) -> tuple[list[str], dict[str, str], dict[str, Any]]:
    if sha256_file(targets_path) != expected_targets_sha256:
        raise ValueError("Frozen target set hash mismatch")
    targets = read_targets(targets_path)
    target_ids = [row["openalex_id"] for row in targets]
    if len(target_ids) != len(set(target_ids)):
        raise ValueError("Frozen target set contains duplicate IDs")

    manifest = json.loads(capture_manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != API_CAPTURE_SCHEMA_VERSION:
        raise ValueError("Unexpected API capture manifest schema")
    if manifest.get("status") != "complete":
        raise ValueError("API capture is not complete")
    if manifest.get("targets", {}).get("sha256") != expected_targets_sha256:
        raise ValueError("Capture manifest target hash mismatch")
    capture_contract = manifest.get("capture", {})
    if capture_contract.get("sha256") != sha256_file(capture_path):
        raise ValueError("Capture JSONL hash mismatch")
    if capture_contract.get("rows") != len(target_ids):
        raise ValueError("Capture row count does not match frozen targets")

    capture_rows: list[dict[str, Any]] = []
    with capture_path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            row["openalex_id"] = normalize_openalex_id(row.get("openalex_id"))
            if not isinstance(row.get("found"), bool):
                raise ValueError(f"Invalid found flag on capture line {line_number}")
            abstract = row.get("abstract")
            if abstract is not None and not isinstance(abstract, str):
                raise ValueError(f"Invalid abstract on capture line {line_number}")
            if row.get("abstract_length") != len(abstract or ""):
                raise ValueError(
                    f"Abstract length mismatch on capture line {line_number}"
                )
            capture_rows.append(row)

    if [row["openalex_id"] for row in capture_rows] != target_ids:
        raise ValueError("Capture row order does not match frozen target order")
    backfills = {
        row["openalex_id"]: row["abstract"]
        for row in capture_rows
        if _normalized_text(row.get("abstract"))
    }
    return target_ids, backfills, manifest


def validate_enriched_corpus(
    *,
    source_path: Path,
    output_path: Path,
    target_ids: list[str],
    backfills: dict[str, str],
    batch_size: int = 65_536,
) -> dict[str, Any]:
    try:
        import pyarrow.parquet as pq
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before validation."
        ) from error

    source = pq.ParquetFile(source_path)
    output = pq.ParquetFile(output_path)
    if source.schema_arrow != output.schema_arrow:
        raise ValueError("V3.3 Arrow schema differs from V3.2")
    if source.metadata.num_rows != output.metadata.num_rows:
        raise ValueError("V3.3 row count differs from V3.2")

    target_set = set(target_ids)
    seen_targets: set[str] = set()
    filled_ids: set[str] = set()
    row_count = 0
    columns = source.schema_arrow.names
    abstract_index = columns.index("abstract")
    work_id_index = columns.index("work_id")
    source_batches = source.iter_batches(batch_size=batch_size)
    output_batches = output.iter_batches(batch_size=batch_size)
    for source_batch, output_batch in zip_longest(source_batches, output_batches):
        if source_batch is None or output_batch is None:
            raise ValueError("V3.2 and V3.3 batch streams have different lengths")
        if source_batch.num_rows != output_batch.num_rows:
            raise ValueError("V3.2 and V3.3 batch sizes differ")
        row_count += source_batch.num_rows
        for column_index, name in enumerate(columns):
            if name == "abstract":
                continue
            if not source_batch.column(column_index).equals(
                output_batch.column(column_index)
            ):
                raise ValueError(f"Non-abstract column changed: {name}")

        source_abstracts = source_batch.column(abstract_index).to_pylist()
        output_abstracts = output_batch.column(abstract_index).to_pylist()
        work_ids = source_batch.column(work_id_index).to_pylist()
        for work_id, source_abstract, output_abstract in zip(
            work_ids, source_abstracts, output_abstracts
        ):
            openalex_id = normalize_openalex_id(work_id)
            if openalex_id in target_set:
                seen_targets.add(openalex_id)
            expected = backfills.get(openalex_id, source_abstract)
            if output_abstract != expected:
                raise ValueError(f"Unexpected abstract change for {openalex_id}")
            if openalex_id in backfills:
                if _normalized_text(source_abstract):
                    raise ValueError(
                        f"Attempted to overwrite existing abstract for {openalex_id}"
                    )
                filled_ids.add(openalex_id)

    if seen_targets != target_set:
        missing = sorted(target_set - seen_targets)[:5]
        raise ValueError(f"Frozen targets absent from V3.2: {missing}")
    if filled_ids != set(backfills):
        missing = sorted(set(backfills) - filled_ids)[:5]
        raise ValueError(f"Captured abstracts not applied: {missing}")
    return {
        "rows": row_count,
        "targets_seen": len(seen_targets),
        "abstracts_filled": len(filled_ids),
        "targets_still_missing": len(target_set) - len(filled_ids),
        "schema_equal": True,
        "non_abstract_columns_equal": True,
        "existing_abstracts_preserved": True,
    }


def build_enriched_corpus(
    settings: RetrievalSettings,
    *,
    targets_path: Path,
    capture_path: Path,
    capture_manifest_path: Path,
    expected_targets_sha256: str,
    expected_source_sha256: str,
    output_path: Path,
    metadata_path: Path,
    batch_size: int = 65_536,
) -> dict[str, Any]:
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before building V3.3."
        ) from error

    source_path = HuggingFaceDocumentSource(settings).download()
    if sha256_file(source_path) != expected_source_sha256:
        raise ValueError("Pinned V3.2 source artifact hash mismatch")
    target_ids, backfills, capture_manifest = load_validated_capture(
        targets_path=targets_path,
        capture_path=capture_path,
        capture_manifest_path=capture_manifest_path,
        expected_targets_sha256=expected_targets_sha256,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=output_path.parent, prefix=f".{output_path.name}.", suffix=".tmp"
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    temporary_path.unlink()
    source = pq.ParquetFile(source_path)
    abstract_index = source.schema_arrow.names.index("abstract")
    work_id_index = source.schema_arrow.names.index("work_id")
    writer = None
    try:
        writer = pq.ParquetWriter(
            temporary_path,
            source.schema_arrow,
            compression="zstd",
            use_dictionary=True,
        )
        for batch in source.iter_batches(batch_size=batch_size):
            work_ids = batch.column(work_id_index).to_pylist()
            source_abstracts = batch.column(abstract_index).to_pylist()
            enriched_abstracts = []
            for work_id, source_abstract in zip(work_ids, source_abstracts):
                openalex_id = normalize_openalex_id(work_id)
                replacement = backfills.get(openalex_id)
                if replacement is not None:
                    if _normalized_text(source_abstract):
                        raise ValueError(
                            f"Refusing to overwrite abstract for {openalex_id}"
                        )
                    enriched_abstracts.append(replacement)
                else:
                    enriched_abstracts.append(source_abstract)
            enriched = batch.set_column(
                abstract_index,
                source.schema_arrow.field(abstract_index),
                pa.array(
                    enriched_abstracts,
                    type=source.schema_arrow.field(abstract_index).type,
                ),
            )
            writer.write_batch(enriched)
        writer.close()
        writer = None
        os.replace(temporary_path, output_path)
    except Exception:
        if writer is not None:
            writer.close()
        temporary_path.unlink(missing_ok=True)
        raise

    validation = validate_enriched_corpus(
        source_path=source_path,
        output_path=output_path,
        target_ids=target_ids,
        backfills=backfills,
        batch_size=batch_size,
    )
    metadata = {
        "schema_version": ENRICHED_CORPUS_SCHEMA_VERSION,
        "source": {
            "repo": settings.dataset_repo,
            "revision": settings.dataset_revision,
            "file": settings.dataset_file,
            "sha256": expected_source_sha256,
        },
        "capture": {
            "manifest": str(capture_manifest_path),
            "manifest_sha256": sha256_file(capture_manifest_path),
            "jsonl": str(capture_path),
            "jsonl_sha256": sha256_file(capture_path),
            "started_at": capture_manifest["started_at"],
            "completed_at": capture_manifest["updated_at"],
        },
        "targets": {
            "path": str(targets_path),
            "sha256": expected_targets_sha256,
            "rows": len(target_ids),
        },
        "output": {
            "path": str(output_path),
            "sha256": sha256_file(output_path),
            "size_bytes": output_path.stat().st_size,
        },
        "validation": validation,
        "gate": {
            "publication_allowed": True,
            "mass_embedding_build_allowed": False,
            "reason": (
                "The local V3.3 artifact passed structural invariants. Publication, "
                "revision pinning, abstract audit and real-model smoke remain required."
            ),
        },
    }
    _atomic_json(metadata_path, metadata)
    return metadata
