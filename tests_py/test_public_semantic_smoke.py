from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.retrieval.run_public_semantic_smoke import (
    RESULT_SCHEMA,
    build_result_row,
    load_queries,
    summarize,
    validate_health,
    validate_search_payload,
)


class PublicSemanticSmokeTests(unittest.TestCase):
    def test_load_queries_preserves_order_and_rejects_duplicates(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            query_path = Path(temp_dir) / "queries.jsonl"
            query_path.write_text(
                "\n".join(
                    [
                        json.dumps({"query_id": "q1", "query": "Quine"}),
                        json.dumps({"query_id": "q2", "query": "Kant"}),
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            self.assertEqual(
                [row["query_id"] for row in load_queries(query_path)],
                ["q1", "q2"],
            )
            query_path.write_text(
                "\n".join(
                    [
                        json.dumps({"query_id": "q1", "query": "Quine"}),
                        json.dumps({"query_id": "q1", "query": "Kant"}),
                    ]
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "duplicate query_id"):
                load_queries(query_path)

    def test_health_enforces_frozen_public_boundary(self):
        health = {
            "status": "ready",
            "documents": 451823,
            "reranker_available": False,
            "search_limits": {
                "concurrent_requests": 1,
                "requests_per_window": 10,
            },
        }
        validate_health(health, 5)
        health["reranker_available"] = True
        with self.assertRaisesRegex(RuntimeError, "reranker"):
            validate_health(health, 5)

    def test_search_validation_and_summary_do_not_claim_relevance(self):
        query = "Quine and ontology"
        results = [
            {
                "id": f"openalex-W{index}",
                "title": f"Document {index}",
                "semantic_score": 0.9 - index / 100,
                "rerank_score": None,
            }
            for index in range(2)
        ]
        payload = {
            "query": query,
            "mode": "semantic",
            "reranker_enabled": False,
            "results": results,
        }
        validate_search_payload(payload, query, 2)
        row = build_result_row(
            {"query_id": "q1", "query": query},
            payload,
            http_status=200,
            elapsed_seconds=1.25,
            requested_limit=2,
        )
        self.assertEqual(row["schema_version"], RESULT_SCHEMA)
        self.assertFalse(row["observation"]["fallback_exercised"])

        summary = summarize([row])
        self.assertEqual(summary["status"], "operational_smoke_passed")
        self.assertFalse(summary["human_relevance_reviewed"])
        self.assertIn("does not claim human relevance", summary["interpretation"])


if __name__ == "__main__":
    unittest.main()
