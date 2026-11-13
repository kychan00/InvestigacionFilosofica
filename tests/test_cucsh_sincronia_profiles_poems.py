"""Offline source-only tests for six biographical profiles and two literary texts."""
import copy
import unittest

from scripts.cucsh.research_sincronia_profiles_poems import (
    TARGET_IDS, make_report,
)


def fixture():
    targets = [
        {
            "id": rid, "issueNumber": 7 if i < 6 else 8,
            "year": 1998, "title": f"Index title {i}",
            "originalUrl": (
                f"http://fuentes.csh.udg.mx/CUCSH/Sincronia/{i}.htm"
            ),
            "sourceAvailability": "original-page-unavailable",
        }
        for i, rid in enumerate(TARGET_IDS)
    ]
    others = [
        {
            "id": f"pending-{i}", "issueNumber": 15, "year": 2000,
            "title": f"Other unsourced {i}",
            "originalUrl": f"http://sincronia.cucsh.udg.mx/work{i}.html",
            "sourceAvailability": "original-page-unavailable",
        }
        for i in range(4)
    ]
    return {
        "totalSincroniaRecords": 1454,
        "pendingAuthorRecords": 12,
        "highConfidenceEditorialNavigationCount": 2,
        "records": targets + others,
    }


class EightProfilesAndPoemsTests(unittest.TestCase):
    def test_eight_unique_historical_records_not_mutated(self):
        self.assertEqual(len(TARGET_IDS), 8)
        self.assertEqual(len(set(TARGET_IDS)), 8)
        d = fixture()
        original = copy.deepcopy(d)
        def fake_probe(record):
            return {
                "id": record["id"],
                "authorAttribution": None,
                "originalRecordModified": False,
                "candidateSourceCaptures": [],
            }
        report = make_report(d, probe=fake_probe)
        self.assertEqual(report["selectionCount"], 8)
        self.assertEqual(report["inputMissingAuthors"], 12)
        self.assertEqual(report["inputSincroniaCount"], 1454)
        self.assertFalse(report["metadataMutation"])
        self.assertFalse(report["automaticAuthorAssignment"])
        self.assertEqual([r["id"] for r in report["records"]], TARGET_IDS)
        self.assertEqual(d, original)

    def test_refuse_stale_inputs_or_record_dedup_errors(self):
        for key, value in (
            ("totalSincroniaRecords", 1453),
            ("pendingAuthorRecords", 13),
            ("highConfidenceEditorialNavigationCount", 1),
        ):
            with self.subTest(key=key):
                d = fixture()
                d[key] = value
                with self.assertRaises(ValueError):
                    make_report(d, probe=lambda r: r)
        d = fixture()
        d["records"].pop(0)
        with self.assertRaises(ValueError):
            make_report(d, probe=lambda r: r)
        d = fixture()
        d["records"][1]["id"] = d["records"][0]["id"]
        with self.assertRaises(ValueError):
            make_report(d, probe=lambda r: r)

    def test_biography_subject_is_not_assigned_as_article_author(self):
        d = fixture()
        r = make_report(d, probe=lambda record: {
            "id": record["id"], "authorAttribution": None,
            "originalRecordModified": False,
            "candidateSourceCaptures": [
                {"candidateUrl": record["originalUrl"],
                 "urlIdentity": "exact-frozen-original",
                 "captures": [{"fetchStatus": "html",
                               "unverifiedArticleText": record["title"]}]}
            ],
        })
        self.assertTrue(all(x["authorAttribution"] is None for x in r["records"]))
        self.assertIn("not work bylines", r["classificationWarning"])
        self.assertIn("Dante directory path", r["classificationWarning"])


if __name__ == "__main__":
    unittest.main()
