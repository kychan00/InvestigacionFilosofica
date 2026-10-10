from __future__ import annotations

import unittest

from scripts.retrieval.run_presentation_api_smoke import validate_responses


def source_result(document_id: str, score: float) -> dict:
    return {
        "id": document_id,
        "title": document_id,
        "semantic_score": score,
        "lexical_score": None,
        "rerank_score": None,
    }


class PresentationApiSmokeTests(unittest.TestCase):
    def test_validation_requires_complete_ordered_provenance(self):
        first = source_result("W1", 0.9)
        second = source_result("W2", 0.8)
        default = {
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
            "results": [first, second],
        }
        enabled = {
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
                    **first,
                    "work_identity": {
                        "representative_id": "W1",
                        "members": [
                            {
                                "id": "W1",
                                "semantic_score": 0.9,
                                "lexical_score": None,
                                "rerank_score": None,
                            },
                            {
                                "id": "W2",
                                "semantic_score": 0.8,
                                "lexical_score": None,
                                "rerank_score": None,
                            },
                        ],
                    },
                }
            ],
        }
        summary = validate_responses(default, enabled, expected_limit=2)
        self.assertEqual(summary["status"], "local_smoke_passed")
        self.assertTrue(summary["source_ids_preserved"])
        self.assertTrue(summary["scores_preserved"])

    def test_validation_rejects_changed_member_score(self):
        first = source_result("W1", 0.9)
        second = source_result("W2", 0.8)
        default_status = {
            "requested": False,
            "available": True,
            "enabled": False,
            "applied": False,
            "fallback": False,
            "source_result_count": 2,
            "presented_result_count": 2,
            "collapsed_result_count": 0,
        }
        enabled_status = {
            "requested": True,
            "available": True,
            "enabled": True,
            "applied": True,
            "fallback": False,
            "source_result_count": 2,
            "presented_result_count": 1,
            "collapsed_result_count": 1,
        }
        with self.assertRaisesRegex(RuntimeError, "changed a source score"):
            validate_responses(
                {"presentation": default_status, "results": [first, second]},
                {
                    "presentation": enabled_status,
                    "results": [
                        {
                            **first,
                            "work_identity": {
                                "representative_id": "W1",
                                "members": [
                                    {
                                        "id": "W1",
                                        "semantic_score": 0.9,
                                        "lexical_score": None,
                                        "rerank_score": None,
                                    },
                                    {
                                        "id": "W2",
                                        "semantic_score": 0.1,
                                        "lexical_score": None,
                                        "rerank_score": None,
                                    },
                                ],
                            },
                        }
                    ],
                },
                expected_limit=2,
            )


if __name__ == "__main__":
    unittest.main()
