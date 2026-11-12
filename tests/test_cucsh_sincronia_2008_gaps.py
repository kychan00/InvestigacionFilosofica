import unittest

from scripts.cucsh.backfill_sincronia_2008_verified_gaps import (
    EXPECTED, SOURCE_TO_EXISTING, MISSING_BIBLIOGRAPHY,
    check_source, verify_issue,
)


class Verified2008GapsTest(unittest.TestCase):
    def test_four_new_articles_exactly(self):
        self.assertEqual(
            set().union(*(item["missing"] for item in EXPECTED.values())),
            set(MISSING_BIBLIOGRAPHY),
        )
        self.assertEqual(len(MISSING_BIBLIOGRAPHY), 4)
        self.assertEqual(EXPECTED[47]["local"], 14)
        self.assertEqual(EXPECTED[48]["local"], 10)

    def test_all_thirteen_title_shortening_pairs_are_declared(self):
        self.assertEqual(len(SOURCE_TO_EXISTING[47]), 6)
        self.assertEqual(len(SOURCE_TO_EXISTING[48]), 7)
        self.assertEqual(len(set(SOURCE_TO_EXISTING[47].values())), 6)
        self.assertEqual(len(set(SOURCE_TO_EXISTING[48].values())), 7)

    def test_source_urls_require_exact_article_id(self):
        entry = {
            "sourceId": "dialnet:3296017",
            "title": "Contrabando de tabaco en la Nueva España",
            "authors": ["Alfredo Barragán Cabral"],
            "url": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296017",
        }
        self.assertTrue(check_source(entry, 47))
        with self.assertRaisesRegex(ValueError, "URL"):
            check_source({**entry, "url": "https://malicious.example/record"}, 47)

    def test_unavailable_issue_never_authorizes_additions(self):
        existing = [
            {"id": f"original:{i}", "journal": "Sincronía", "issueNumber": 47}
            for i in range(14)
        ]
        with self.assertRaisesRegex(ValueError, "evidence missing"):
            verify_issue(existing, {}, 47)

    def test_metadata_from_different_code_does_not_pass(self):
        entry = {
            "sourceId": "dialnet:3296017",
            "title": "Contrabando de tabaco en la Nueva España",
            "authors": ["Alfredo Barragán Cabral"],
            "url": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296366",
        }
        with self.assertRaises(ValueError):
            check_source(entry, 47)


if __name__ == "__main__":
    unittest.main()
