from __future__ import annotations

import unittest

from scripts.retrieval.run_public_presentation_smoke import QUERY, validate_capture


class PublicPresentationSmokeTests(unittest.TestCase):
    def test_validates_default_off_and_enabled_provenance(self):
        source = [
            {
                "id": "openalex-W2211243423",
                "title": "Quine and Ontology",
                "semantic_score": 0.8,
                "lexical_score": None,
                "rerank_score": None,
            },
            {
                "id": "openalex-W7069018285",
                "title": "Quine and Ontology",
                "semantic_score": 0.8,
                "lexical_score": None,
                "rerank_score": None,
            },
        ]
        health = {
            "status": "ready",
            "documents": 451823,
            "reranker_available": False,
            "presentation_hygiene_available": True,
        }
        default = {
            "query": QUERY,
            "mode": "semantic",
            "reranker_enabled": False,
            "presentation": {
                "requested": False,
                "available": True,
                "enabled": False,
                "applied": False,
                "fallback": False,
                "source_result_count": 2,
                "presented_result_count": 2,
                "collapsed_result_count": 0,
            },
            "results": source,
        }
        enabled = {
            "query": QUERY,
            "mode": "semantic",
            "reranker_enabled": False,
            "presentation": {
                "requested": True,
                "available": True,
                "enabled": True,
                "applied": True,
                "fallback": False,
                "source_result_count": 2,
                "presented_result_count": 1,
                "collapsed_result_count": 1,
            },
            "results": [
                {
                    **source[0],
                    "display": {"title": "Quine and Ontology", "abstract": ""},
                    "metadata_findings": [],
                    "presentation_rank": 1,
                    "source_rank": 1,
                    "work_identity": {
                        "classification": "exact_identity",
                        "member_count": 2,
                        "member_ids": [row["id"] for row in source],
                        "representative_id": source[0]["id"],
                        "members": [
                            {
                                "id": row["id"],
                                "source_rank": index,
                                "semantic_score": row["semantic_score"],
                                "lexical_score": None,
                                "rerank_score": None,
                            }
                            for index, row in enumerate(source, start=1)
                        ],
                    },
                }
            ],
        }

        summary = validate_capture(health, default, enabled, limit=2)
        self.assertEqual(summary["status"], "public_presentation_smoke_passed")
        self.assertTrue(summary["source_order_preserved"])

    def test_rejects_server_capability_off(self):
        with self.assertRaisesRegex(RuntimeError, "not enabled"):
            validate_capture(
                {
                    "status": "ready",
                    "documents": 451823,
                    "reranker_available": False,
                    "presentation_hygiene_available": False,
                },
                {},
                {},
                limit=10,
            )


if __name__ == "__main__":
    unittest.main()
