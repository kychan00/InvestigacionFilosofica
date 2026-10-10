from __future__ import annotations

import unittest
from dataclasses import replace
from unittest.mock import patch

try:
    from pydantic import ValidationError

    from semantic_retrieval.api import (
        SearchFiltersRequest,
        SearchRequest,
        SlidingWindowRateLimiter,
        _search,
        apply_optional_presentation_hygiene,
        resolve_presentation_hygiene_enabled,
        resolve_reranker_enabled,
    )
    from semantic_retrieval.config import RetrievalSettings
    from semantic_retrieval.models import Document, SearchResult
except ImportError:
    SearchFiltersRequest = None
    SearchRequest = None
    ValidationError = ValueError
    resolve_reranker_enabled = None
    resolve_presentation_hygiene_enabled = None
    SlidingWindowRateLimiter = None


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

    def test_presentation_hygiene_requires_both_opt_ins(self):
        self.assertFalse(resolve_presentation_hygiene_enabled(False, True))
        self.assertFalse(resolve_presentation_hygiene_enabled(True, None))
        self.assertFalse(resolve_presentation_hygiene_enabled(True, False))
        self.assertTrue(resolve_presentation_hygiene_enabled(True, True))

    def test_default_off_presentation_preserves_results_exactly(self):
        source = [
            {
                "id": "W1",
                "title": "<i>Quine</i>",
                "abstract": "Ontology",
                "year": 1953,
                "semantic_score": 0.9,
            }
        ]
        presented, status = apply_optional_presentation_hygiene(
            source,
            server_available=False,
            requested=True,
        )
        self.assertIs(presented, source)
        self.assertEqual(presented, source)
        self.assertFalse(status.enabled)
        self.assertFalse(status.applied)
        self.assertFalse(status.fallback)

    def test_enabled_presentation_collapses_only_exact_identity(self):
        source = [
            {
                "id": "W1",
                "title": "<i>Quine &amp; Ontology</i>",
                "abstract": "Shared abstract.",
                "year": 1953,
                "semantic_score": 0.9,
            },
            {
                "id": "W2",
                "title": "Quine & Ontology",
                "abstract": "Shared abstract.",
                "year": 1953,
                "semantic_score": 0.8,
            },
            {
                "id": "W3",
                "title": "Quine & Ontology",
                "abstract": "Different abstract.",
                "year": 1953,
                "semantic_score": 0.7,
            },
        ]
        presented, status = apply_optional_presentation_hygiene(
            source,
            server_available=True,
            requested=True,
        )
        self.assertTrue(status.applied)
        self.assertFalse(status.fallback)
        self.assertEqual(status.source_result_count, 3)
        self.assertEqual(status.presented_result_count, 2)
        self.assertEqual(status.collapsed_result_count, 1)
        self.assertEqual([result["id"] for result in presented], ["W1", "W3"])
        self.assertEqual(presented[0]["work_identity"]["member_ids"], ["W1", "W2"])
        self.assertEqual(
            [
                member["semantic_score"]
                for member in presented[0]["work_identity"]["members"]
            ],
            [0.9, 0.8],
        )
        self.assertEqual(presented[0]["display"]["title"], "Quine & Ontology")
        self.assertEqual(presented[1]["semantic_score"], 0.7)

    def test_presentation_failure_falls_back_to_source_results(self):
        source = [
            {"id": "W1", "title": "First"},
            {"id": "W1", "title": "Duplicate ID"},
        ]
        with self.assertLogs("semantic_retrieval.api", level="ERROR"):
            presented, status = apply_optional_presentation_hygiene(
                source,
                server_available=True,
                requested=True,
            )
        self.assertIs(presented, source)
        self.assertTrue(status.enabled)
        self.assertFalse(status.applied)
        self.assertTrue(status.fallback)

    def test_search_applies_presentation_after_retrieval_without_overfetch(self):
        class FakeService:
            def __init__(self):
                self.limit = None

            def search_semantic(self, _query, *, limit, **_kwargs):
                self.limit = limit
                return [
                    SearchResult(
                        Document("W1", "<i>Shared</i>", "Abstract", year=2020),
                        semantic_score=0.9,
                    ),
                    SearchResult(
                        Document("W2", "Shared", "Abstract", year=2020),
                        semantic_score=0.8,
                    ),
                    SearchResult(
                        Document("W3", "Distinct", "Other", year=2021),
                        semantic_score=0.7,
                    ),
                ]

        service = FakeService()
        enabled_settings = replace(
            RetrievalSettings(), enable_presentation_hygiene=True
        )
        payload = SearchRequest(
            query="Quine ontology",
            limit=3,
            enable_reranker=False,
            enable_presentation_hygiene=True,
        )
        with (
            patch("semantic_retrieval.api.settings", enabled_settings),
            patch("semantic_retrieval.api.get_service", return_value=service),
        ):
            response = _search(payload, "semantic")
        self.assertEqual(service.limit, 3)
        self.assertTrue(response.presentation.applied)
        self.assertEqual(response.presentation.source_result_count, 3)
        self.assertEqual(response.presentation.presented_result_count, 2)
        self.assertEqual([result["id"] for result in response.results], ["W1", "W3"])

    def test_search_rate_limit_uses_a_sliding_window_per_client(self):
        limiter = SlidingWindowRateLimiter(requests=2, window_seconds=10)
        self.assertEqual(limiter.allow("first", now=0), (True, 0))
        self.assertEqual(limiter.allow("first", now=1), (True, 0))
        self.assertEqual(limiter.allow("second", now=1), (True, 0))
        allowed, retry_after = limiter.allow("first", now=2)
        self.assertFalse(allowed)
        self.assertEqual(retry_after, 8)
        self.assertEqual(limiter.allow("first", now=10), (True, 0))


if __name__ == "__main__":
    unittest.main()
