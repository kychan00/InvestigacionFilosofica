from __future__ import annotations

import unittest

from semantic_retrieval.config import RetrievalSettings
from semantic_retrieval.dataset_source import eligible_for_search
from semantic_retrieval.documents import (
    build_document_text,
    content_hash,
    normalize_document,
)
from semantic_retrieval.filters import matches_filters
from semantic_retrieval.lexical_search import fts_query
from semantic_retrieval.models import SearchFilters


class DocumentNormalizationTests(unittest.TestCase):
    def test_openalex_identity_and_original_record_are_preserved(self):
        record = {
            "work_id": 123456,
            "title": "  Kant and aesthetic judgment  ",
            "abstract": "A study of reflective judgment.",
            "publication_year": 2021,
            "language": "en",
            "type": "article",
            "ontology_keyword_id": "aesthetics",
            "tier": "CORE",
        }

        document = normalize_document(record)

        self.assertEqual(document.id, "openalex-W123456")
        self.assertEqual(document.openalex_id, "W123456")
        self.assertEqual(document.url, "https://openalex.org/W123456")
        self.assertEqual(document.year, 2021)
        self.assertEqual(document.keywords, ("aesthetics",))
        self.assertEqual(document.original["work_id"], 123456)

    def test_embedding_text_omits_missing_fields(self):
        document = normalize_document(
            {
                "work_id": 10,
                "title": "Quine and Ontological Commitment",
                "abstract": "An analysis of quantification and ontology.",
            }
        )

        text = build_document_text(document)

        self.assertIn("Title:\nQuine and Ontological Commitment", text)
        self.assertIn("Abstract:\nAn analysis", text)
        self.assertNotIn("Authors:", text)
        self.assertNotIn("Topics:", text)
        self.assertNotIn("Keywords:", text)

    def test_content_hash_changes_when_embedding_text_changes(self):
        first = normalize_document({"work_id": 1, "title": "Logic"})
        second = normalize_document({"work_id": 1, "title": "Logic and ontology"})
        self.assertNotEqual(content_hash(first), content_hash(second))


class DatasetAndFilterTests(unittest.TestCase):
    def test_search_eligibility_matches_v32_contract(self):
        self.assertTrue(
            eligible_for_search({"tier": "CORE", "document_role": "SCHOLARLY"})
        )
        self.assertTrue(
            eligible_for_search(
                {"tier": "PROBABLE", "document_role": "SECOND_SIGNAL_RESCUE"}
            )
        )
        self.assertFalse(
            eligible_for_search({"tier": "BORDERLINE", "document_role": "SCHOLARLY"})
        )
        self.assertFalse(
            eligible_for_search({"tier": "CORE", "document_role": "PARATEXT"})
        )

    def test_metadata_filters_do_not_require_a_model(self):
        document = normalize_document(
            {
                "id": "crossref-10.1/test",
                "title": "Ética y lenguaje",
                "authors": ["María Pérez"],
                "year": 2020,
                "topics": ["Ethics", "Philosophy of language"],
                "language": "es",
                "journal": "Revista de Filosofía",
                "source": "Crossref",
                "type": "journal-article",
            }
        )
        filters = SearchFilters(
            year_from=2019,
            year_to=2021,
            author="maria perez",
            languages=("es", "en"),
            journal="filosofia",
            sources=("Crossref",),
            topic="ethics",
            publication_types=("journal-article",),
        )
        self.assertTrue(matches_filters(document, filters))
        self.assertFalse(matches_filters(document, SearchFilters(year_from=2022)))

    def test_lexical_query_is_tokenized_instead_of_interpolated(self):
        expression = fts_query('Quine "ontological commitment" OR *')
        self.assertEqual(
            expression,
            '"quine" OR "ontological" OR "commitment" OR "or"',
        )


class ConfigurationTests(unittest.TestCase):
    def test_model_and_dataset_revisions_are_pinned(self):
        settings = RetrievalSettings()
        self.assertEqual(settings.embedding_model, "Qwen/Qwen3-Embedding-0.6B")
        self.assertEqual(settings.reranker_model, "Qwen/Qwen3-Reranker-0.6B")
        self.assertEqual(len(settings.embedding_model_revision), 40)
        self.assertEqual(len(settings.reranker_model_revision), 40)
        self.assertEqual(len(settings.dataset_revision), 40)
        self.assertIn("philosophically relevant", settings.retrieval_instruction)
        self.assertFalse(settings.enable_reranker)


if __name__ == "__main__":
    unittest.main()
