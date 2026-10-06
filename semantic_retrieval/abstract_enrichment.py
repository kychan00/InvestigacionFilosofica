from __future__ import annotations

import hashlib
import json
import os
import tempfile
import urllib.parse
import urllib.request
from collections.abc import Iterable, Iterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import RetrievalSettings
from .dataset_source import HuggingFaceDocumentSource, eligible_for_search

ENRICHMENT_PREFLIGHT_SCHEMA_VERSION = "semantic-abstract-enrichment-preflight-v1"
TARGET_SCHEMA_VERSION = "semantic-abstract-enrichment-target-v1"
OPENALEX_API_URL = "https://api.openalex.org/works"
OPENALEX_MAX_BATCH_SIZE = 100
MEARMAN_DATASET_REPO = "Mearman/OpenAlex"
MEARMAN_ABSTRACTS_PATH = "data/works/abstracts"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_openalex_id(value: Any) -> str:
    if value is None:
        raise ValueError("OpenAlex work ID cannot be null")
    normalized = str(value).strip().removeprefix("https://openalex.org/")
    if normalized.upper().startswith("W"):
        normalized = normalized[1:]
    if not normalized.isdigit():
        raise ValueError(f"Invalid OpenAlex work ID: {value!r}")
    return f"W{normalized}"


def reconstruct_abstract(inverted_index: Any) -> str | None:
    if not inverted_index:
        return None
    if not isinstance(inverted_index, dict):
        raise ValueError("abstract_inverted_index must be an object or null")

    positioned_words: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        if not isinstance(word, str) or not isinstance(positions, list):
            raise ValueError("Malformed abstract_inverted_index entry")
        for position in positions:
            if not isinstance(position, int) or position < 0:
                raise ValueError("Abstract positions must be non-negative integers")
            positioned_words.append((position, word))

    if not positioned_words:
        return None
    positioned_words.sort(key=lambda item: (item[0], item[1]))
    positions = [position for position, _ in positioned_words]
    if len(positions) != len(set(positions)):
        raise ValueError("Duplicate positions in abstract_inverted_index")
    return " ".join(word for _, word in positioned_words).strip() or None


def iter_missing_abstract_targets(
    source_path: Path,
    *,
    batch_size: int = 4096,
) -> Iterator[dict[str, Any]]:
    try:
        import pyarrow.parquet as pq
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before building targets."
        ) from error

    columns = ("work_id", "abstract", "tier", "document_role")
    parquet = pq.ParquetFile(source_path)
    missing_columns = sorted(set(columns) - set(parquet.schema.names))
    if missing_columns:
        raise ValueError(f"Target columns missing from Parquet: {missing_columns}")

    sequence = 0
    for batch in parquet.iter_batches(batch_size=batch_size, columns=columns):
        for record in batch.to_pylist():
            if not eligible_for_search(record):
                continue
            abstract = " ".join(str(record.get("abstract") or "").split()).strip()
            if abstract:
                continue
            work_id = record.get("work_id")
            openalex_id = normalize_openalex_id(work_id)
            yield {
                "schema_version": TARGET_SCHEMA_VERSION,
                "sequence": sequence,
                "work_id": work_id,
                "openalex_id": openalex_id,
            }
            sequence += 1


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


def write_missing_abstract_targets(
    settings: RetrievalSettings,
    *,
    output_path: Path,
    batch_size: int = 4096,
) -> dict[str, Any]:
    source_path = HuggingFaceDocumentSource(settings).download()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=output_path.parent, prefix=f".{output_path.name}.", suffix=".tmp"
    )
    count = 0
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            for target in iter_missing_abstract_targets(
                source_path, batch_size=batch_size
            ):
                handle.write(
                    json.dumps(target, ensure_ascii=False, sort_keys=True) + "\n"
                )
                count += 1
        os.replace(temporary_name, output_path)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise

    return {
        "path": str(output_path),
        "rows": count,
        "sha256": sha256_file(output_path),
        "selection": (
            "Pinned V3.2 source order; retrieval-eligible rows with empty "
            "whitespace-normalized abstract"
        ),
    }


def read_targets(path: Path, *, limit: int | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("schema_version") != TARGET_SCHEMA_VERSION:
                raise ValueError(f"Unexpected target schema on line {line_number}")
            row["openalex_id"] = normalize_openalex_id(row.get("openalex_id"))
            rows.append(row)
            if limit is not None and len(rows) >= limit:
                break
    return rows


def deterministic_sample_indices(total: int, count: int) -> list[int]:
    if total < 1:
        raise ValueError("total must be positive")
    if not 1 <= count <= total:
        raise ValueError("count must be between 1 and total")
    if count == 1:
        return [0]
    return [round(index * (total - 1) / (count - 1)) for index in range(count)]


def probe_mearman_snapshot(
    *,
    targets_path: Path,
    revision: str,
    output_path: Path,
    sample_count: int = 8,
) -> dict[str, Any]:
    try:
        import pyarrow.parquet as pq
        from huggingface_hub import HfApi, HfFileSystem
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before probing the snapshot."
        ) from error

    target_rows = read_targets(targets_path)
    target_ids = {
        int(normalize_openalex_id(row["openalex_id"])[1:]) for row in target_rows
    }
    if len(target_ids) != len(target_rows):
        raise ValueError("Target set contains duplicate OpenAlex IDs")

    api = HfApi()
    entries = [
        entry
        for entry in api.list_repo_tree(
            MEARMAN_DATASET_REPO,
            path_in_repo=MEARMAN_ABSTRACTS_PATH,
            recursive=True,
            revision=revision,
            repo_type="dataset",
        )
        if getattr(entry, "path", "").endswith(".parquet")
    ]
    entries.sort(key=lambda entry: entry.path)
    if not entries:
        raise RuntimeError("Pinned Mearman/OpenAlex revision has no abstract Parquet files")
    indices = deterministic_sample_indices(len(entries), sample_count)
    sampled_entries = [entries[index] for index in indices]
    filesystem = HfFileSystem()

    sampled_files: list[dict[str, Any]] = []
    matched_target_ids: set[int] = set()
    sampled_file_bytes = 0
    sampled_row_groups = 0
    matched_row_groups = 0
    work_id_compressed_bytes = 0
    text_compressed_bytes = 0
    matched_text_compressed_bytes = 0
    schema: list[dict[str, str]] | None = None

    for entry in sampled_entries:
        uri = f"hf://datasets/{MEARMAN_DATASET_REPO}@{revision}/{entry.path}"
        with filesystem.open(uri, "rb") as handle:
            parquet = pq.ParquetFile(handle)
            current_schema = [
                {"name": field.name, "type": str(field.type)}
                for field in parquet.schema_arrow
            ]
            if schema is None:
                schema = current_schema
            elif current_schema != schema:
                raise ValueError(f"Abstract schema changed within snapshot: {entry.path}")

            file_matches: set[int] = set()
            file_matched_groups = 0
            file_text_bytes = 0
            file_matched_text_bytes = 0
            file_work_id_bytes = 0
            for row_group_index in range(parquet.num_row_groups):
                metadata = parquet.metadata.row_group(row_group_index)
                group_work_id_bytes = 0
                group_text_bytes = 0
                for column_index in range(metadata.num_columns):
                    column = metadata.column(column_index)
                    if column.path_in_schema == "work_id":
                        group_work_id_bytes += column.total_compressed_size
                    else:
                        group_text_bytes += column.total_compressed_size

                work_ids = set(
                    parquet.read_row_group(
                        row_group_index, columns=["work_id"]
                    ).column(0).to_pylist()
                )
                group_matches = work_ids & target_ids
                if group_matches:
                    file_matched_groups += 1
                    file_matches.update(group_matches)
                    file_matched_text_bytes += group_text_bytes
                file_work_id_bytes += group_work_id_bytes
                file_text_bytes += group_text_bytes

            size = int(getattr(entry, "size", 0) or 0)
            sampled_file_bytes += size
            sampled_row_groups += parquet.num_row_groups
            matched_row_groups += file_matched_groups
            work_id_compressed_bytes += file_work_id_bytes
            text_compressed_bytes += file_text_bytes
            matched_text_compressed_bytes += file_matched_text_bytes
            matched_target_ids.update(file_matches)
            sampled_files.append(
                {
                    "path": entry.path,
                    "size_bytes": size,
                    "rows": parquet.metadata.num_rows,
                    "row_groups": parquet.num_row_groups,
                    "matched_row_groups": file_matched_groups,
                    "matched_target_ids": len(file_matches),
                    "work_id_compressed_bytes": file_work_id_bytes,
                    "text_compressed_bytes": file_text_bytes,
                    "matched_text_compressed_bytes": file_matched_text_bytes,
                }
            )

    report = {
        "schema_version": "mearman-openalex-abstract-source-probe-v1",
        "generated_at": _now(),
        "source": {
            "repo": MEARMAN_DATASET_REPO,
            "revision": revision,
            "path": MEARMAN_ABSTRACTS_PATH,
            "parquet_files": len(entries),
            "total_size_bytes": sum(
                int(getattr(entry, "size", 0) or 0) for entry in entries
            ),
            "schema": schema,
        },
        "targets": {
            "path": str(targets_path),
            "rows": len(target_rows),
            "unique_ids": len(target_ids),
            "sha256": sha256_file(targets_path),
        },
        "sampling": {
            "method": "evenly spaced indices over lexicographically sorted paths",
            "sample_count": sample_count,
            "indices": indices,
            "files": sampled_files,
        },
        "aggregate": {
            "sampled_file_bytes": sampled_file_bytes,
            "sampled_row_groups": sampled_row_groups,
            "matched_row_groups": matched_row_groups,
            "matched_row_groups_percent": round(
                matched_row_groups / sampled_row_groups * 100, 6
            ),
            "matched_target_ids": len(matched_target_ids),
            "work_id_compressed_bytes": work_id_compressed_bytes,
            "text_compressed_bytes": text_compressed_bytes,
            "matched_text_compressed_bytes": matched_text_compressed_bytes,
            "matched_text_bytes_percent": round(
                matched_text_compressed_bytes / text_compressed_bytes * 100, 6
            ),
        },
        "conclusion": (
            "Work IDs can be range-read cheaply, but absent Parquet page indexes, "
            "row groups containing targets require most token and position bytes."
        ),
    }
    _atomic_json(output_path, report)
    return report


def _safe_request_url(openalex_ids: Iterable[str]) -> str:
    normalized = [normalize_openalex_id(value) for value in openalex_ids]
    if not normalized:
        raise ValueError("At least one OpenAlex ID is required")
    if len(normalized) > OPENALEX_MAX_BATCH_SIZE:
        raise ValueError(
            f"OpenAlex batches cannot exceed {OPENALEX_MAX_BATCH_SIZE} IDs"
        )
    query = urllib.parse.urlencode(
        {
            "filter": f"openalex_id:{'|'.join(normalized)}",
            "select": "id,abstract_inverted_index,updated_date",
            "per-page": str(OPENALEX_MAX_BATCH_SIZE),
        }
    )
    return f"{OPENALEX_API_URL}?{query}"


def fetch_openalex_batch(
    openalex_ids: Iterable[str],
    *,
    timeout_seconds: float = 60,
    api_key: str | None = None,
) -> dict[str, Any]:
    ids = [normalize_openalex_id(value) for value in openalex_ids]
    safe_url = _safe_request_url(ids)
    request_url = safe_url
    if api_key:
        request_url = f"{safe_url}&{urllib.parse.urlencode({'api_key': api_key})}"

    request = urllib.request.Request(
        request_url,
        headers={"User-Agent": "InvestigacionFilosofica-abstract-enrichment/1.0"},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        response_bytes = response.read()
        response_headers = {
            key.lower(): value
            for key, value in response.headers.items()
            if key.lower().startswith("x-ratelimit")
            or key.lower() in {"retry-after", "etag", "last-modified"}
        }
        status = response.status

    payload = json.loads(response_bytes)
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise ValueError("OpenAlex response lacks a results array")

    returned: dict[str, dict[str, Any]] = {}
    for result in payload["results"]:
        result_id = normalize_openalex_id(result.get("id"))
        if result_id not in ids:
            raise ValueError(f"OpenAlex returned an unrequested ID: {result_id}")
        if result_id in returned:
            raise ValueError(f"OpenAlex returned duplicate ID: {result_id}")
        returned[result_id] = result

    normalized_rows = []
    for openalex_id in ids:
        result = returned.get(openalex_id)
        abstract = (
            reconstruct_abstract(result.get("abstract_inverted_index"))
            if result
            else None
        )
        normalized_rows.append(
            {
                "openalex_id": openalex_id,
                "found": result is not None,
                "abstract": abstract,
                "abstract_length": len(abstract or ""),
                "source_updated_date": result.get("updated_date") if result else None,
            }
        )

    return {
        "requested_at": _now(),
        "safe_url": safe_url,
        "status": status,
        "headers": response_headers,
        "response_bytes": response_bytes,
        "response_sha256": hashlib.sha256(response_bytes).hexdigest(),
        "payload": payload,
        "rows": normalized_rows,
    }


def run_openalex_probe(
    settings: RetrievalSettings,
    *,
    targets_path: Path,
    output_dir: Path,
    batch_size: int = OPENALEX_MAX_BATCH_SIZE,
    timeout_seconds: float = 60,
    api_key: str | None = None,
) -> dict[str, Any]:
    if not 1 <= batch_size <= OPENALEX_MAX_BATCH_SIZE:
        raise ValueError(
            f"batch_size must be between 1 and {OPENALEX_MAX_BATCH_SIZE}"
        )
    targets = read_targets(targets_path, limit=batch_size)
    if len(targets) != batch_size:
        raise ValueError(
            f"Requested a {batch_size}-ID probe but found {len(targets)} targets"
        )

    result = fetch_openalex_batch(
        [row["openalex_id"] for row in targets],
        timeout_seconds=timeout_seconds,
        api_key=api_key,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = output_dir / "openalex-api-probe-response.json"
    raw_path.write_bytes(result["response_bytes"])
    normalized_path = output_dir / "openalex-api-probe-normalized.jsonl"
    with normalized_path.open("w", encoding="utf-8") as handle:
        for row in result["rows"]:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

    found = sum(bool(row["found"]) for row in result["rows"])
    with_abstract = sum(bool(row["abstract"]) for row in result["rows"])
    report = {
        "schema_version": ENRICHMENT_PREFLIGHT_SCHEMA_VERSION,
        "generated_at": _now(),
        "base_dataset": {
            "repo": settings.dataset_repo,
            "revision": settings.dataset_revision,
            "file": settings.dataset_file,
        },
        "target_set": {
            "path": str(targets_path),
            "sha256": sha256_file(targets_path),
        },
        "source": {
            "kind": "live_openalex_api_probe",
            "endpoint": OPENALEX_API_URL,
            "snapshot_pinned": False,
            "warning": (
                "This probe is evidence of selective acquisition feasibility; "
                "it is not an immutable replacement for the frozen Mearman/OpenAlex snapshot."
            ),
        },
        "request": {
            "batch_size": batch_size,
            "safe_url": result["safe_url"],
            "requested_at": result["requested_at"],
            "api_key_used": bool(api_key),
        },
        "response": {
            "status": result["status"],
            "headers": result["headers"],
            "requested_ids": batch_size,
            "found_ids": found,
            "with_abstract": with_abstract,
            "without_abstract_or_missing": batch_size - with_abstract,
            "raw_path": str(raw_path),
            "raw_sha256": sha256_file(raw_path),
            "normalized_path": str(normalized_path),
            "normalized_sha256": sha256_file(normalized_path),
        },
        "gate": {
            "mass_embedding_build_allowed": False,
            "v3_3_publish_allowed": False,
            "reason": (
                "The source-of-truth route remains unresolved: pinned snapshot "
                "scan versus timestamped live API acquisition."
            ),
        },
    }
    report_path = output_dir / "abstract-enrichment-preflight.json"
    _atomic_json(report_path, report)
    return {**report, "report_path": str(report_path)}
