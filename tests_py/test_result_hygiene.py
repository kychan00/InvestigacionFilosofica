from __future__ import annotations

import unittest

from semantic_retrieval.result_hygiene import (
    audit_smoke_rows,
    metadata_findings,
    normalize_doi,
    normalize_identity_text,
)


class ResultHygieneTests(unittest.TestCase):
    def test_identity_normalization_is_comparison_only(self):
        source = "  <i>Quine &amp; Ontology</i>  "
        self.assertEqual(normalize_identity_text(source), "quine ontology")
        self.assertEqual(source, "  <i>Quine &amp; Ontology</i>  ")
        self.assertEqual(normalize_doi("https://doi.org/10.1/ABC"), "10.1/abc")

    def test_metadata_findings_are_explicit_and_non_destructive(self):
        document = {
            "title": "<i>Investiga????es</i>",
            "abstract": "Texto â€œcorrompidoâ€",
        }
        codes = {
            (finding["code"], finding["field"])
            for finding in metadata_findings(document)
        }
        self.assertIn(("literal_html_markup", "title"), codes)
        self.assertIn(("suspected_mojibake", "title"), codes)
        self.assertIn(("suspected_mojibake", "abstract"), codes)

    def test_audit_separates_exact_and_probable_duplicate_groups(self):
        shared = {
            "title": "Quine and Ontology",
            "abstract": "A study of ontological commitment.",
            "year": 2003,
            "doi": None,
        }
        rows = [
            {
                "query_id": "q1",
                "response": {
                    "results": [
                        {"id": "W1", **shared},
                        {"id": "W2", **shared},
                        {
                            "id": "W3",
                            **shared,
                            "abstract": "A revised study of ontological commitment.",
                        },
                        {
                            "id": "W4",
                            "title": "",
                            "abstract": "Useful content.",
                            "year": 2020,
                        },
                    ]
                },
            }
        ]

        findings, groups, summary = audit_smoke_rows(rows)

        self.assertEqual([finding["code"] for finding in findings], ["missing_title"])
        exact = [group for group in groups if group["classification"] == "exact_identity"]
        probable = [
            group for group in groups if group["classification"] == "probable_same_work"
        ]
        self.assertEqual(exact[0]["member_ids"], ["W1", "W2"])
        self.assertEqual(probable[0]["member_ids"], ["W1", "W2", "W3"])
        self.assertEqual(summary["conservative_collapse_count"], 1)
        self.assertFalse(summary["human_labels_used"])
        self.assertFalse(summary["source_scores_or_order_modified"])


if __name__ == "__main__":
    unittest.main()
