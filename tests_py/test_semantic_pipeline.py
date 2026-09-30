from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

try:
    import faiss  # noqa: F401
    import numpy as np
    import pyarrow  # noqa: F401
except ImportError:
    np = None

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.models import SearchFilters

if np is not None:
    from semantic_retrieval.embedding_store import EmbeddingStoreBuilder
    from semantic_retrieval.embeddings import normalize_vectors
    from semantic_retrieval.index_manager import (
        FaissIndexBuilder,
        validate_current_index,
    )
    from semantic_retrieval.semantic_search import SemanticSearcher


class FakeSource:
    def __init__(self, rows):
        self.rows = rows

    def iter_records(self, *, batch_size=512, limit=None):
        rows = self.rows[:limit] if limit is not None else self.rows
        for start in range(0, len(rows), batch_size):
            yield rows[start : start + batch_size]


class FakeEmbeddingBackend:
    model_name = "test/embedding"
    model_revision = "a" * 40
    dimension = 4

    def __init__(self):
        self.query_calls = 0

    @staticmethod
    def _vector(text):
        normalized = text.casefold()
        return [
            float("quine" in normalized or "ontolog" in normalized),
            float(
                "kant" in normalized or "aesthe" in normalized or "estet" in normalized
            ),
            float(
                "marx" in normalized or "value" in normalized or "valor" in normalized
            ),
            0.1,
        ]

    def encode_documents(self, texts):
        return normalize_vectors(np.asarray([self._vector(text) for text in texts]))

    def encode_query(self, query):
        self.query_calls += 1
        return normalize_vectors(np.asarray([self._vector(query)]))[0]


@unittest.skipIf(np is None, "optional FAISS/Arrow dependencies are not installed")
class SemanticPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.settings = replace(
            RetrievalSettings(),
            artifacts_dir=Path(self.temporary.name),
            embedding_model=FakeEmbeddingBackend.model_name,
            embedding_model_revision=FakeEmbeddingBackend.model_revision,
            embedding_dimension=FakeEmbeddingBackend.dimension,
            enable_reranker=False,
            search_candidates=3,
        )
        self.backend = FakeEmbeddingBackend()
        self.rows = [
            {
                "work_id": 1,
                "title": "Quine and ontological commitment",
                "abstract": "Quantification and what there is.",
                "publication_year": 1953,
                "language": "en",
                "tier": "CORE",
                "document_role": "SCHOLARLY",
            },
            {
                "work_id": 2,
                "title": "Kantian aesthetics",
                "abstract": "A study of transcendental aesthetic judgment.",
                "publication_year": 2020,
                "language": "en",
                "tier": "CORE",
                "document_role": "SCHOLARLY",
            },
            {
                "work_id": 3,
                "title": "Marx and value",
                "abstract": "A critique of value theory.",
                "publication_year": 2018,
                "language": "es",
                "tier": "PROBABLE",
                "document_role": "SCHOLARLY",
            },
        ]

    def tearDown(self):
        self.temporary.cleanup()

    def test_offline_build_search_cache_and_incremental_update(self):
        first = EmbeddingStoreBuilder(
            self.settings,
            backend=self.backend,
            source=FakeSource(self.rows),
        ).build(source_batch_size=2)
        self.assertEqual(first["new_documents"], 3)

        index_manifest = FaissIndexBuilder(self.settings).build()
        self.assertEqual(index_manifest["document_count"], 3)

        searcher = SemanticSearcher(self.settings, embedding_backend=self.backend)
        try:
            results = searcher.search("Quine ontology", limit=2, candidates=3)
            self.assertEqual(results[0].document.id, "openalex-W1")
            self.assertIsNotNone(results[0].semantic_score)

            searcher.search("  quine   ontology ", limit=2, candidates=3)
            self.assertEqual(self.backend.query_calls, 1)

            filtered = searcher.search(
                "value theory",
                limit=2,
                candidates=3,
                filters=SearchFilters(languages=("es",)),
            )
            self.assertEqual([item.document.id for item in filtered], ["openalex-W3"])
        finally:
            searcher.close()

        extended_rows = [
            *self.rows,
            {
                "work_id": 4,
                "title": "Ontology after Quine",
                "abstract": "Contemporary ontological commitment.",
                "publication_year": 2024,
                "language": "en",
                "tier": "CORE",
                "document_role": "SCHOLARLY",
            },
        ]
        second = EmbeddingStoreBuilder(
            self.settings,
            backend=self.backend,
            source=FakeSource(extended_rows),
        ).build(source_batch_size=2)
        self.assertEqual(second["new_documents"], 1)
        self.assertEqual(second["unchanged_documents"], 3)

        incremental = FaissIndexBuilder(self.settings).build(incremental=True)
        self.assertEqual(incremental["previous_document_count"], 3)
        self.assertEqual(incremental["added_documents"], 1)
        self.assertEqual(validate_current_index(self.settings)["document_count"], 4)


if __name__ == "__main__":
    unittest.main()
