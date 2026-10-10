from __future__ import annotations

import copy
import unittest

from scripts.retrieval.build_presentation_hygiene import build_rows
from semantic_retrieval.result_hygiene import build_presentation_results


class PresentationHygieneTests(unittest.TestCase):
    def test_exact_identity_collapses_with_complete_provenance(self):
        source = [
            {
                "id": "W1",
                "title": "<i>Quine &amp; Ontology</i>",
                "abstract": "Shared abstract.",
                "year": 2003,
                "semantic_score": 0.9,
                "lexical_score": None,
                "rerank_score": None,
            },
            {
                "id": "W2",
                "title": "Quine & Ontology",
                "abstract": "Shared abstract.",
                "year": 2003,
                "semantic_score": 0.8,
                "lexical_score": None,
                "rerank_score": None,
            },
            {
                "id": "W3",
                "title": "Quine & Ontology",
                "abstract": "Different abstract.",
                "year": 2003,
                "semantic_score": 0.7,
                "lexical_score": None,
                "rerank_score": None,
            },
        ]
        original = copy.deepcopy(source)

        presented, stats = build_presentation_results(source)

        self.assertEqual(source, original)
        self.assertEqual(len(presented), 2)
        self.assertEqual(presented[0]["display"]["title"], "Quine & Ontology")
        self.assertEqual(
            presented[0]["work_identity"]["member_ids"], ["W1", "W2"]
        )
        self.assertEqual(
            [member["semantic_score"] for member in presented[0]["work_identity"]["members"]],
            [0.9, 0.8],
        )
        self.assertEqual(presented[1]["id"], "W3")
        self.assertEqual(stats["collapsed_result_count"], 1)
        self.assertTrue(stats["all_source_ids_preserved"])

    def test_missing_title_is_display_fallback_not_source_rewrite(self):
        source = [{"id": "W1", "title": "", "abstract": None, "year": 2020}]
        presented, stats = build_presentation_results(source)
        self.assertEqual(source[0]["title"], "")
        self.assertEqual(presented[0]["title"], "")
        self.assertEqual(presented[0]["display"]["title"], "Sin título")
        self.assertEqual(stats["title_fallback_count"], 1)

    def test_heldout_builder_rejects_overlap(self):
        source_rows = [
            {
                "query_id": "q1",
                "query": "Query",
                "results": [
                    {"id": f"W{rank}", "title": f"Title {rank}", "year": 2000 + rank}
                    for rank in range(1, 16)
                ],
            }
        ]
        excluded_rows = [
            {
                "query_id": "q1",
                "response": {"results": [{"id": "W11", "title": "Held out"}]},
            }
        ]
        with self.assertRaisesRegex(RuntimeError, "overlaps excluded IDs"):
            build_rows(source_rows, excluded_rows, rank_from=11, rank_to=15)


if __name__ == "__main__":
    unittest.main()
