from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from .config import RetrievalSettings
from .dataset_source import HuggingFaceDocumentSource
from .documents import build_document_text, content_hash, normalize_document
from .embeddings import EmbeddingBackend, SentenceTransformerEmbeddingBackend
from .models import Document

SCHEMA_VERSION = "semantic-embeddings-v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _connect_state(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS embedded_documents (
            document_id TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL,
            vector_id INTEGER NOT NULL UNIQUE,
            shard TEXT NOT NULL,
            embedded_at TEXT NOT NULL
        )
        """
    )
    connection.commit()
    return connection


def _existing(connection: sqlite3.Connection, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    rows = connection.execute(
        f"SELECT document_id, content_hash FROM embedded_documents "
        f"WHERE document_id IN ({placeholders})",
        ids,
    ).fetchall()
    return {str(document_id): str(checksum) for document_id, checksum in rows}


def _metadata_row(
    document: Document,
    *,
    vector_id: int,
    checksum: str,
    embedding: np.ndarray,
    backend: EmbeddingBackend,
    embedded_at: str,
) -> dict[str, Any]:
    return {
        "vector_id": vector_id,
        "id": document.id,
        "content_hash": checksum,
        "title": document.title,
        "abstract": document.abstract,
        "authors_json": json.dumps(list(document.authors), ensure_ascii=False),
        "year": document.year,
        "topics_json": json.dumps(list(document.topics), ensure_ascii=False),
        "keywords_json": json.dumps(list(document.keywords), ensure_ascii=False),
        "journal": document.journal,
        "language": document.language,
        "doi": document.doi,
        "source": document.source,
        "publication_type": document.publication_type,
        "openalex_id": document.openalex_id,
        "crossref_id": document.crossref_id,
        "url": document.url,
        "original_json": json.dumps(document.original, ensure_ascii=False),
        "embedding_model": backend.model_name,
        "embedding_model_revision": backend.model_revision,
        "embedded_at": embedded_at,
        "embedding": embedding.tolist(),
    }


class EmbeddingStoreBuilder:
    def __init__(
        self,
        settings: RetrievalSettings,
        *,
        backend: EmbeddingBackend | None = None,
        source: HuggingFaceDocumentSource | None = None,
    ):
        self.settings = settings
        self._backend = backend
        self.source = source or HuggingFaceDocumentSource(settings)
        self.root = settings.embeddings_dir
        self.shards_dir = self.root / "shards"
        self.manifest_path = self.root / "manifest.json"
        self.state_path = self.root / "state.sqlite3"

    @property
    def backend(self) -> EmbeddingBackend:
        if self._backend is None:
            self._backend = SentenceTransformerEmbeddingBackend(self.settings)
        return self._backend

    @property
    def backend_contract(self) -> tuple[str, str, int]:
        if self._backend is not None:
            return (
                self._backend.model_name,
                self._backend.model_revision,
                self._backend.dimension,
            )
        return (
            self.settings.embedding_model,
            self.settings.embedding_model_revision,
            self.settings.embedding_dimension,
        )

    def _load_manifest(self) -> dict[str, Any]:
        model_name, model_revision, dimension = self.backend_contract
        dataset_source = {
            "repo": self.settings.dataset_repo,
            "revision": self.settings.dataset_revision,
            "file": self.settings.dataset_file,
        }
        if not self.manifest_path.exists():
            return {
                "schema_version": SCHEMA_VERSION,
                "dataset": dataset_source,
                "dataset_sources": [dataset_source],
                "embedding": {
                    "model": model_name,
                    "revision": model_revision,
                    "dimension": dimension,
                },
                "created_at": _now(),
                "updated_at": None,
                "document_count": 0,
                "shards": [],
            }
        payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        expected = (
            model_name,
            model_revision,
            dimension,
        )
        actual = (
            payload["embedding"]["model"],
            payload["embedding"]["revision"],
            payload["embedding"]["dimension"],
        )
        if actual != expected:
            raise ValueError(
                "Existing embeddings use a different model contract. "
                "Use a new artifacts directory for a full rebuild."
            )
        return payload

    def _changed_existing_ids(
        self,
        connection: sqlite3.Connection,
        *,
        limit: int | None,
        source_batch_size: int,
    ) -> list[str]:
        changed: list[str] = []
        for source_records in self.source.iter_records(
            batch_size=source_batch_size, limit=limit
        ):
            documents = [normalize_document(record) for record in source_records]
            known = _existing(connection, [document.id for document in documents])
            for document in documents:
                old_checksum = known.get(document.id)
                if old_checksum is None:
                    continue
                new_checksum = content_hash(
                    document, self.settings.embedding_max_characters
                )
                if old_checksum != new_checksum:
                    changed.append(document.id)
                    if len(changed) >= 20:
                        return changed
        return changed

    def _write_shard(self, rows: list[dict[str, Any]], shard_name: str) -> Path:
        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
        except ImportError as error:
            raise RuntimeError(
                "Install requirements-semantic-retrieval.txt before writing embeddings."
            ) from error

        self.shards_dir.mkdir(parents=True, exist_ok=True)
        table = pa.Table.from_pylist(rows)
        temporary = self.shards_dir / f".{shard_name}.tmp"
        final = self.shards_dir / shard_name
        pq.write_table(table, temporary, compression="zstd")
        os.replace(temporary, final)
        return final

    def build(
        self,
        *,
        limit: int | None = None,
        source_batch_size: int = 512,
        progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        report = progress or (lambda _event: None)
        self.root.mkdir(parents=True, exist_ok=True)
        manifest = self._load_manifest()
        connection = _connect_state(self.state_path)
        next_vector_id = connection.execute(
            "SELECT coalesce(max(vector_id), -1) + 1 FROM embedded_documents"
        ).fetchone()[0]
        new_count = 0
        unchanged_count = 0

        existing_count = connection.execute(
            "SELECT count(*) FROM embedded_documents"
        ).fetchone()[0]
        if existing_count:
            report(
                {
                    "stage": "incremental_preflight",
                    "existing_documents": existing_count,
                }
            )
            changed_ids = self._changed_existing_ids(
                connection,
                limit=limit,
                source_batch_size=source_batch_size,
            )
            if changed_ids:
                sample = ", ".join(changed_ids[:5])
                connection.close()
                raise RuntimeError(
                    f"Detected changed existing documents ({sample}). Incremental "
                    "mode only adds new documents; use a new artifacts directory "
                    "for a full rebuild."
                )
            report(
                {
                    "stage": "incremental_preflight_complete",
                    "existing_documents": existing_count,
                }
            )

        try:
            report(
                {
                    "stage": "source_scan",
                    "dataset_repo": self.settings.dataset_repo,
                    "dataset_revision": self.settings.dataset_revision,
                    "limit": limit,
                }
            )
            for source_records in self.source.iter_records(
                batch_size=source_batch_size, limit=limit
            ):
                documents = [normalize_document(record) for record in source_records]
                checksums = {
                    document.id: content_hash(
                        document, self.settings.embedding_max_characters
                    )
                    for document in documents
                }
                known = _existing(connection, [document.id for document in documents])
                pending: list[Document] = []

                for document in documents:
                    old_checksum = known.get(document.id)
                    if old_checksum is None:
                        pending.append(document)
                    elif old_checksum == checksums[document.id]:
                        unchanged_count += 1
                    else:
                        raise RuntimeError(
                            "Corpus changed between incremental preflight and write pass"
                        )

                if not pending:
                    continue

                report(
                    {
                        "stage": "embedding_batch",
                        "batch_documents": len(pending),
                        "new_documents_so_far": new_count,
                    }
                )
                texts = [
                    build_document_text(
                        document, self.settings.embedding_max_characters
                    )
                    for document in pending
                ]
                backend = self.backend
                vectors = backend.encode_documents(texts)
                if vectors.shape != (len(pending), backend.dimension):
                    raise ValueError(
                        "Embedding backend returned an unexpected matrix shape: "
                        f"{vectors.shape}"
                    )

                embedded_at = _now()
                shard_name = (
                    f"part-{next_vector_id:012d}-"
                    f"{next_vector_id + len(pending) - 1:012d}.parquet"
                )
                rows = []
                state_rows = []
                for offset, (document, vector) in enumerate(zip(pending, vectors)):
                    vector_id = next_vector_id + offset
                    checksum = checksums[document.id]
                    rows.append(
                        _metadata_row(
                            document,
                            vector_id=vector_id,
                            checksum=checksum,
                            embedding=vector,
                            backend=backend,
                            embedded_at=embedded_at,
                        )
                    )
                    state_rows.append(
                        (
                            document.id,
                            checksum,
                            vector_id,
                            shard_name,
                            embedded_at,
                        )
                    )

                shard_path = self._write_shard(rows, shard_name)
                connection.executemany(
                    "INSERT INTO embedded_documents "
                    "(document_id, content_hash, vector_id, shard, embedded_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    state_rows,
                )
                connection.commit()

                shard_hash = _sha256(shard_path)
                manifest["shards"].append(
                    {
                        "file": f"shards/{shard_name}",
                        "rows": len(rows),
                        "first_vector_id": next_vector_id,
                        "last_vector_id": next_vector_id + len(rows) - 1,
                        "sha256": shard_hash,
                    }
                )
                next_vector_id += len(rows)
                new_count += len(rows)
                manifest["document_count"] = next_vector_id
                manifest["updated_at"] = _now()
                _atomic_json(self.manifest_path, manifest)
                report(
                    {
                        "stage": "embedding_batch_complete",
                        "batch_documents": len(rows),
                        "new_documents_so_far": new_count,
                        "total_documents": manifest["document_count"],
                        "shard": shard_name,
                    }
                )
        finally:
            try:
                connection.close()
            except sqlite3.ProgrammingError:
                pass

        source_contract = {
            "repo": self.settings.dataset_repo,
            "revision": self.settings.dataset_revision,
            "file": self.settings.dataset_file,
        }
        sources = manifest.setdefault("dataset_sources", [manifest["dataset"]])
        if source_contract not in sources:
            sources.append(source_contract)
            manifest["updated_at"] = _now()
            _atomic_json(self.manifest_path, manifest)

        return {
            "new_documents": new_count,
            "unchanged_documents": unchanged_count,
            "total_documents": manifest["document_count"],
            "manifest": str(self.manifest_path),
        }
