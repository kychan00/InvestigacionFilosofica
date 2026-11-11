#!/usr/bin/env python3
import unittest
from scripts.cucsh.probe_sincronia_sparse import compare_catalogue, dialnet_code


def rec(issue, code, title, url=None):
    return {
        "journal": "Sincronía",
        "issueNumber": issue,
        "sourceId": "dialnet:" + code if code else None,
        "title": title,
        "authors": [{"name": "Autora Uno"}],
        "urls": {
            "canonical": url or
            "https://dialnet.unirioja.es/servlet/articulo?codigo=" + (code or "0")
        },
    }


class SparseComparisonTest(unittest.TestCase):
    def test_dialnet_id_matching(self):
        self.assertEqual(dialnet_code(rec(29, "123", "Título")), "123")

    def test_title_match_across_distinct_original_urls(self):
        original = rec(
            29, "", "Filosofía, teoría y práctica",
            "https://sincronia.cucsh.udg.mx/ensayo.htm",
        )
        dialnet = rec(29, "123", "Filosofia teoria y practica")
        report = compare_catalogue([original], [dialnet], (29,))
        self.assertEqual(report[0]["notMatchedByIdOrExactNormalizedTitle"], 0)

    def test_unmatched_dialnet_article_needs_human_review(self):
        original = rec(
            33, "", "Ensayo sobre Kant",
            "https://sincronia.cucsh.udg.mx/kant.htm",
        )
        dialnet = rec(33, "234", "Texto sobre Spinoza")
        report = compare_catalogue([original], [dialnet], (33,))
        self.assertEqual(report[0]["finding"], "possible_gaps")
        self.assertEqual(
            report[0]["potentialMissing"][0]["dialnetCode"], "234"
        )

    def test_unavailable_catalogue_is_not_reported_as_complete(self):
        report = compare_catalogue([rec(44,"1","Uno")], [], (44,))
        self.assertEqual(report[0]["finding"], "source_unavailable")


if __name__ == "__main__":
    unittest.main()
