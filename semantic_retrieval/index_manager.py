from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from .config import RetrievalSettings

INDEX_SCHEMA_VERSION = "semantic-faiss-index-v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _connect_documents(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS documents (
            vector_id INTEGER PRIMARY KEY,
            id TEXT NOT NULL UNIQUE,
            content_hash TEXT NOT NULL,
            title TEXT NOT NULL,
            abstract TEXT,
            authors_json TEXT NOT NULL,
            year INTEGER,
            topics_json TEXT NOT NULL,
            keywords_json TEXT NOT NULL,
            journal TEXT,
            language TEXT,
            doi TEXT,
            source TEXT,
            publication_type TEXT,
            openalex_id TEXT,
            crossref_id TEXT,
            url TEXT,
            original_json TEXT NOT NULL,
            embedding_model TEXT NOT NULL,
            embedding_model_revision TEXT NOT NULL,
            embedded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS documents_year_idx ON documents(year);
        CREATE INDEX IF NOT EXISTS documents_language_idx ON documents(language);
        CREATE INDEX IF NOT EXISTS documents_source_idx ON documents(source);
        CREATE INDEX IF NOT EXISTS documents_type_idx ON documents(publication_type);
        CREATE INDEX IF NOT EXISTS documents_openalex_idx ON documents(openalex_id);
        CREATE INDEX IF NOT EXISTS documents_doi_idx ON documents(doi);
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
            id UNINDEXED,
            title,
            abstract,
            authors,
            topics,
            keywords,
            journal,
            doi,
            tokenize='unicode61 remove_diacritics 2'
        );
        """
    )
    connection.commit()
    return connection


def resolve_current_version(index_root: Path) -> Path:
    current_path = index_root / "CURRENT"
    if not current_path.exists():
        raise FileNotFoundError(
            f"No semantic index is active under {index_root}. "
            "Run scripts/retrieval/build_faiss_index.py first."
        )
    version_name = current_path.read_text(encoding="utf-8").strip()
    version_path = index_root / "versions" / version_name
    if not version_name or not version_path.is_dir():
        raise RuntimeError(f"Invalid semantic index pointer: {current_path}")
    return version_path


def read_current_manifest(settings: RetrievalSettings) -> dict[str, Any]:
    version = resolve_current_version(settings.index_dir)
    manifest_path = version / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError(f"Active index manifest is missing: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for filename in (manifest["faiss"]["file"], manifest["metadata_database"]):
        if not (version / filename).is_file():
            raise RuntimeError(
                f"Active index artifact is missing: {version / filename}"
            )
    return manifest


def _activate(index_root: Path, version_name: str) -> None:
    index_root.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=index_root, prefix=".CURRENT.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(version_name + "\n")
        os.replace(temporary_name, index_root / "CURRENT")
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def _read_embedding_manifest(settings: RetrievalSettings) -> dict[str, Any]:
    manifest_path = settings.embeddings_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"Embedding manifest not found: {manifest_path}. "
            "Run scripts/retrieval/build_embeddings.py first."
        )
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _insert_metadata(
    connection: sqlite3.Connection, rows: list[dict[str, Any]]
) -> None:
    document_rows = []
    fts_rows = []
    for row in rows:
        document_rows.append(
            (
                row["vector_id"],
                row["id"],
                row["content_hash"],
                row["title"],
                row.get("abstract"),
                row["authors_json"],
                row.get("year"),
                row["topics_json"],
                row["keywords_json"],
                row.get("journal"),
                row.get("language"),
                row.get("doi"),
                row.get("source"),
                row.get("publication_type"),
                row.get("openalex_id"),
                row.get("crossref_id"),
                row.get("url"),
                row["original_json"],
                row["embedding_model"],
                row["embedding_model_revision"],
                row["embedded_at"],
            )
        )
        fts_rows.append(
            (
                row["id"],
                row["title"],
                row.get("abstract") or "",
                " ".join(json.loads(row["authors_json"])),
                " ".join(json.loads(row["topics_json"])),
                " ".join(json.loads(row["keywords_json"])),
                row.get("journal") or "",
                row.get("doi") or "",
            )
        )

    connection.executemany(
        """
        INSERT INTO documents (
            vector_id, id, content_hash, title, abstract, authors_json, year,
            topics_json, keywords_json, journal, language, doi, source,
            publication_type, openalex_id, crossref_id, url, original_json,
            embedding_model, embedding_model_revision, embedded_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        """,
        document_rows,
    )
    connection.executemany(
        """
        INSERT INTO documents_fts (
            id, title, abstract, authors, topics, keywords, journal, doi
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        fts_rows,
    )


class FaissIndexBuilder:
    def __init__(self, settings: RetrievalSettings):
        self.settings = settings

    def build(self, *, incremental: bool = False) -> dict[str, Any]:
        try:
            import faiss
            import pyarrow.parquet as pq
        except ImportError as error:
            raise RuntimeError(
                "Install requirements-semantic-retrieval.txt before building FAISS."
            ) from error

        embedding_manifest = _read_embedding_manifest(self.settings)
        dimension = int(embedding_manifest["embedding"]["dimension"])
        versions_dir = self.settings.index_dir / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)
        build_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        temporary = versions_dir / f".{build_id}.tmp"
        version_dir = versions_dir / build_id
        suffix = 1
        while temporary.exists() or version_dir.exists():
            version_dir = versions_dir / f"{build_id}-{suffix}"
            temporary = versions_dir / f".{build_id}-{suffix}.tmp"
            suffix += 1
        temporary.mkdir(parents=True)

        index_path = temporary / "semantic.faiss"
        database_path = temporary / "documents.sqlite3"
        previous_count = 0

        if incremental:
            current = resolve_current_version(self.settings.index_dir)
            shutil.copy2(current / "semantic.faiss", index_path)
            shutil.copy2(current / "documents.sqlite3", database_path)
            index = faiss.read_index(str(index_path))
            connection = _connect_documents(database_path)
            previous_count = int(index.ntotal)
            known_vector_ids = {
                int(row[0])
                for row in connection.execute("SELECT vector_id FROM documents")
            }
        else:
            index = faiss.IndexIDMap2(faiss.IndexFlatIP(dimension))
            connection = _connect_documents(database_path)
            known_vector_ids: set[int] = set()

        added = 0
        try:
            for shard in embedding_manifest["shards"]:
                shard_path = self.settings.embeddings_dir / shard["file"]
                expected_hash = shard.get("sha256")
                if expected_hash:
                    actual_hash = _sha256(shard_path)
                    if actual_hash != expected_hash:
                        raise RuntimeError(
                            f"Embedding shard hash mismatch: {shard_path}"
                        )

                parquet = pq.ParquetFile(shard_path)
                for batch in parquet.iter_batches(batch_size=1024):
                    rows = batch.to_pylist()
                    pending = [
                        row
                        for row in rows
                        if int(row["vector_id"]) not in known_vector_ids
                    ]
                    if not pending:
                        continue
                    vectors = np.asarray(
                        [row.pop("embedding") for row in pending], dtype=np.float32
                    )
                    if vectors.shape[1] != dimension:
                        raise ValueError(
                            f"Shard {shard_path} has dimension {vectors.shape[1]}, "
                            f"expected {dimension}."
                        )
                    faiss.normalize_L2(vectors)
                    vector_ids = np.asarray(
                        [row["vector_id"] for row in pending], dtype=np.int64
                    )
                    index.add_with_ids(vectors, vector_ids)
                    _insert_metadata(connection, pending)
                    known_vector_ids.update(int(value) for value in vector_ids)
                    added += len(pending)
                connection.commit()

            document_count = connection.execute(
                "SELECT count(*) FROM documents"
            ).fetchone()[0]
            if int(index.ntotal) != int(document_count):
                raise RuntimeError(
                    f"FAISS/metadata mismatch: {index.ntotal} vectors and "
                    f"{document_count} documents."
                )

            connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            connection.commit()
            faiss.write_index(index, str(index_path))
        except Exception:
            connection.close()
            shutil.rmtree(temporary, ignore_errors=True)
            raise
        else:
            connection.close()

        index_hash = _sha256(index_path)
        manifest = {
            "schema_version": INDEX_SCHEMA_VERSION,
            "build_id": version_dir.name,
            "created_at": _now(),
            "mode": "incremental" if incremental else "full",
            "embedding_manifest": str(self.settings.embeddings_dir / "manifest.json"),
            "embedding_model": embedding_manifest["embedding"],
            "previous_document_count": previous_count,
            "added_documents": added,
            "document_count": int(index.ntotal),
            "faiss": {
                "index": "IndexIDMap2(IndexFlatIP)",
                "metric": "inner_product_on_l2_normalized_vectors",
                "file": "semantic.faiss",
                "sha256": index_hash,
            },
            "metadata_database": "documents.sqlite3",
        }
        (temporary / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, version_dir)
        _activate(self.settings.index_dir, version_dir.name)
        return manifest


def validate_current_index(settings: RetrievalSettings) -> dict[str, Any]:
    try:
        import faiss
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before validating FAISS."
        ) from error

    version = resolve_current_version(settings.index_dir)
    manifest = json.loads((version / "manifest.json").read_text(encoding="utf-8"))
    index_path = version / manifest["faiss"]["file"]
    actual_hash = _sha256(index_path)
    if actual_hash != manifest["faiss"]["sha256"]:
        raise RuntimeError("Active FAISS index hash does not match its manifest")
    index = faiss.read_index(str(index_path))
    connection = sqlite3.connect(version / manifest["metadata_database"])
    count = connection.execute("SELECT count(*) FROM documents").fetchone()[0]
    connection.close()
    if int(index.ntotal) != int(count) or int(count) != manifest["document_count"]:
        raise RuntimeError("Active FAISS index and metadata database are inconsistent")
    return manifest
