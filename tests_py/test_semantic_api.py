from __future__ import annotations

import unittest

try:
    from pydantic import ValidationError

    from semantic_retrieval.api import (
        SearchFiltersRequest,
        SearchRequest,
        resolve_reranker_enabled,
    )
except ImportError:
    SearchFiltersRequest = None
    SearchRequest = None
    ValidationError = ValueError
    resolve_reranker_enabled = None


@unittest.skipIf(
    SearchRequest is None, "optional FastAPI/Pydantic dependencies missing"
)
class SemanticApiContractTests(unittest.TestCase):
    def test_request_supports_singular_and_plural_filter_names(self):
        filters = SearchFiltersRequest(
            language="es",
            languages=["en"],
            source="OpenAlex",
            sources=["Crossref"],
            publication_type="article",
            publication_types=["book"],
        ).to_domain()

        self.assertEqual(filters.languages, ("en", "es"))
        self.assertEqual(filters.sources, ("Crossref", "OpenAlex"))
        self.assertEqual(filters.publication_types, ("book", "article"))

    def test_request_rejects_inverted_year_range(self):
        with self.assertRaises(ValidationError):
            SearchRequest(
                query="Kant",
                filters={"year_from": 2020, "year_to": 1900},
            )

    def test_request_cannot_enable_a_server_disabled_reranker(self):
        self.assertFalse(resolve_reranker_enabled(False, True))
        self.assertFalse(resolve_reranker_enabled(False, None))
        self.assertTrue(resolve_reranker_enabled(True, True))
        self.assertTrue(resolve_reranker_enabled(True, None))
        self.assertFalse(resolve_reranker_enabled(True, False))


if __name__ == "__main__":
    unittest.main()
