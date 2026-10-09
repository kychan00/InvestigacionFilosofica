from __future__ import annotations

import hashlib
import unittest

from scripts.retrieval.analyze_bounded_reranker_ab import (
    AB_SCHEMA,
    BLIND_SCHEMA,
    EXPERIMENT_ID,
    analyze_rows,
    dcg,
    ndcg,
)


def blind_item_id(query_id: str, document_id: str) -> str:
    value = f"blind\0{EXPERIMENT_ID}\0{query_id}\0{document_id}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()[:24]


def build_fixture(improve: bool = True):
    ab_rows = []
    judgments = []
    for query_number in range(1, 6):
        query_id = f"q{query_number}"
        query = f"Query {query_number}"
        pool = []
        for index in range(12):
            document_id = f"{query_id}-d{index}"
            pool.append(
                {
                    "id": document_id,
                    "title": f"Document {index}",
                    "abstract": f"Abstract {index}",
                    "rank": index + 1,
                    "semantic_score": 1.0 - index / 100,
                }
            )
        a = [dict(item, rank=rank) for rank, item in enumerate(pool[:10], start=1)]
        order = [11, 10, 0, 1, 2, 3, 4, 5, 6, 7] if improve else list(range(10))
        b = [dict(pool[index], rank=rank, rerank_score=12.0 - rank) for rank, index in enumerate(order, start=1)]
        ab_rows.append(
            {
                "schema_version": AB_SCHEMA,
                "experiment_id": EXPERIMENT_ID,
                "query_id": query_id,
                "query": query,
                "candidate_pool": pool,
                "condition_a": a,
                "condition_b": b,
            }
        )
        union_ids = {item["id"] for item in (*a, *b)}
        for document_id in sorted(union_ids):
            source = next(item for item in pool if item["id"] == document_id)
            index = int(document_id.rsplit("d", 1)[1])
            relevance = 3 if index >= 10 else 1
            judgments.append(
                {
                    "schema_version": BLIND_SCHEMA,
                    "experiment_id": EXPERIMENT_ID,
                    "item_id": blind_item_id(query_id, document_id),
                    "query_id": query_id,
                    "query": query,
                    "document": {
                        "id": document_id,
                        "title": source["title"],
                        "abstract": source["abstract"],
                    },
                    "judgment": {"relevance": relevance, "abstain": False, "note": None},
                }
            )
    return ab_rows, judgments


class BoundedRerankerAnalysisTests(unittest.TestCase):
    def test_dcg_and_ndcg(self):
        self.assertAlmostEqual(dcg([3]), 7.0)
        self.assertAlmostEqual(ndcg([3, 0], [3, 0]), 1.0)
        self.assertLess(ndcg([0, 3], [3, 0]), 1.0)

    def test_reranking_improvement_is_positive(self):
        ab_rows, judgments = build_fixture(improve=True)
        result = analyze_rows(ab_rows, judgments)
        primary = result["aggregate"]["primary_ndcg_at_10"]
        self.assertEqual(primary["eligible_queries"], 5)
        self.assertGreater(primary["macro_delta_b_minus_a"], 0.0)
        self.assertGreater(
            result["aggregate"]["secondary_precision_at_10"]["macro_delta_b_minus_a"],
            0.0,
        )

    def test_identical_rankings_tie(self):
        ab_rows, judgments = build_fixture(improve=False)
        result = analyze_rows(ab_rows, judgments)
        self.assertEqual(
            result["aggregate"]["primary_ndcg_at_10"]["macro_delta_b_minus_a"],
            0.0,
        )

    def test_missing_judgment_fails(self):
        ab_rows, judgments = build_fixture(improve=True)
        with self.assertRaises(RuntimeError):
            analyze_rows(ab_rows, judgments[:-1])

    def test_document_mismatch_fails(self):
        ab_rows, judgments = build_fixture(improve=True)
        judgments[0]["document"]["title"] = "Changed"
        with self.assertRaises(RuntimeError):
            analyze_rows(ab_rows, judgments)


if __name__ == "__main__":
    unittest.main()
