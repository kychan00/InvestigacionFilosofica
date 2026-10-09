from __future__ import annotations

import unittest

from scripts.retrieval.run_bounded_reranker_ab import (
    CANDIDATE_COUNT,
    RESULT_LIMIT,
    build_ab_row,
    build_blind_items,
)
from semantic_retrieval.models import Document, SearchResult


class BoundedRerankerABTests(unittest.TestCase):
    def setUp(self):
        self.query = {
            "query_id": "sem-v1-test",
            "query": "Quine and ontology",
            "review_dimensions": ["relevance"],
        }
        self.candidates = [
            SearchResult(
                document=Document(
                    id=f"openalex-W{index}",
                    title=f"Document {index}",
                    abstract=f"Abstract {index}",
                    language="en",
                ),
                semantic_score=1.0 - index / 100,
            )
            for index in range(CANDIDATE_COUNT)
        ]
        self.reranked = list(reversed(self.candidates))
        for index, item in enumerate(self.reranked):
            item.rerank_score = float(CANDIDATE_COUNT - index)

    def test_same_pool_and_blind_contract(self):
        row = build_ab_row(self.query, self.candidates, self.reranked)
        self.assertEqual(len(row["candidate_pool"]), CANDIDATE_COUNT)
        self.assertEqual(len(row["condition_a"]), RESULT_LIMIT)
        self.assertEqual(len(row["condition_b"]), RESULT_LIMIT)
        self.assertEqual(
            {item["id"] for item in row["candidate_pool"]},
            {item.document.id for item in self.reranked},
        )

        blind = build_blind_items([row])
        expected_union = {
            item["id"] for item in (*row["condition_a"], *row["condition_b"])
        }
        self.assertEqual(len(blind), len(expected_union))
        self.assertEqual(
            {item["document"]["id"] for item in blind}, expected_union
        )
        forbidden = {
            "rank",
            "semantic_score",
            "lexical_score",
            "rerank_score",
            "condition",
            "candidate_pool_fingerprint",
        }
        for item in blind:
            self.assertTrue(forbidden.isdisjoint(item["document"]))
            self.assertEqual(
                item["judgment"],
                {"relevance": None, "abstain": None, "note": None},
            )

    def test_pool_mismatch_fails(self):
        with self.assertRaises(RuntimeError):
            build_ab_row(self.query, self.candidates, self.reranked[:-1])


if __name__ == "__main__":
    unittest.main()
