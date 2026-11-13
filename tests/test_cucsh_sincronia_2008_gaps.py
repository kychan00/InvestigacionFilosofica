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

    def test_artifact_report_contract_matches_issue_coverage(self):
        """Integration check: the true audit JSON has no sourceAvailable key.

        The frozen source artifact is downloaded by the workflow before
        this test runs. Local standalone runs skip when it is absent.
        """
        import json
        from pathlib import Path
        from scripts.cucsh.backfill_sincronia_2008_verified_gaps import reconcile

        report_path = Path(
            "/tmp/sincronia-verified-audit/sincronia-2008-identity-report.json"
        )
        if not report_path.exists():
            self.skipTest("Frozen source audit artifact is not mounted")
        dataset = Path("src/data/cucsh-filosofia.json")
        source = json.loads(dataset.read_text(encoding="utf-8"))
        report = json.loads(report_path.read_text(encoding="utf-8"))
        for issue in (47, 48):
            row = next(x for x in report["issues"] if x["issue"] == issue)
            self.assertNotIn("sourceAvailable", row)
            self.assertEqual(row["status"], "needs_review")
        result, proof = reconcile(source, report)
        self.assertEqual(len(result["records"]), len(source["records"]) + 4)
        self.assertEqual(len(proof["newArticles"]), 4)
        previous = {r["id"]: r for r in source["records"]}
        revised = {r["id"]: r for r in result["records"]}
        self.assertTrue(all(previous[k] == revised[k] for k in previous))

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
