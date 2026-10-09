from __future__ import annotations

from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any

from .config import RetrievalSettings


def eligible_for_search(record: Mapping[str, Any]) -> bool:
    tier = str(record.get("tier") or "").upper()
    role = str(record.get("document_role") or "").upper()
    return tier in {"CORE", "PROBABLE"} and role not in {
        "LOW_QUALITY",
        "PARATEXT",
    }


class HuggingFaceDocumentSource:
    """Streams the pinned Parquet artifact without loading it all into memory."""

    def __init__(self, settings: RetrievalSettings):
        self.settings = settings

    def download(self) -> Path:
        try:
            from huggingface_hub import hf_hub_download
        except ImportError as error:
            raise RuntimeError(
                "Install requirements-semantic-retrieval.txt before reading the "
                "Hugging Face corpus."
            ) from error

        return Path(
            hf_hub_download(
                repo_id=self.settings.dataset_repo,
                filename=self.settings.dataset_file,
                revision=self.settings.dataset_revision,
                repo_type="dataset",
                cache_dir=(
                    str(self.settings.hf_cache_dir)
                    if self.settings.hf_cache_dir
                    else None
                ),
            )
        )

    def iter_records(
        self,
        *,
        batch_size: int = 512,
        limit: int | None = None,
    ) -> Iterator[list[dict[str, Any]]]:
        try:
            import pyarrow.parquet as pq
        except ImportError as error:
            raise RuntimeError(
                "Install requirements-semantic-retrieval.txt before reading Parquet."
            ) from error

        parquet = pq.ParquetFile(self.download())
        emitted = 0

        for record_batch in parquet.iter_batches(batch_size=batch_size):
            output: list[dict[str, Any]] = []
            for record in record_batch.to_pylist():
                if not eligible_for_search(record):
                    continue
                output.append(record)
                emitted += 1
                if limit is not None and emitted >= limit:
                    if output:
                        yield output
                    return
            if output:
                yield output
