import unittest

from scripts.cucsh.audit_sincronia_pending_authors import audit_pending_authors


class PendingAuthorsAuditTests(unittest.TestCase):
    def test_reports_missing_authors_without_mutation_or_guessing(self):
        rows = [
            {"id": "a", "journal": "Sincronía", "issueNumber": 2,
             "title": "Article A", "authors": [],
             "urls": {"canonical": "https://old.example/a"},
             "legacyAccessStatus": {"status": "original-page-unavailable"},
             "legacyAuthorEvidence": {"sourceUrl": "https://library.example/a"}},
            {"id": "b", "journal": "Sincronía", "issueNumber": 1,
             "title": "Article B", "authors": None,
             "urls": {"canonical": "https://old.example/b"}},
            {"id": "c", "journal": "Sincronía", "issueNumber": 3,
             "title": "Article C", "authors": [{"name": "Researcher"}]},
            {"id": "d", "journal": "Protrepsis", "issueNumber": 4,
             "title": "Article D", "authors": []},
        ]
        import copy
        baseline = copy.deepcopy(rows)
        report = audit_pending_authors(rows)
        self.assertEqual(rows, baseline)
        self.assertEqual(report["totalSincroniaRecords"], 3)
        self.assertEqual(report["pendingAuthorRecords"], 2)
        self.assertEqual(report["titlesWithUnicodeReplacementCharacter"], 0)
        self.assertEqual([item["id"] for item in report["records"]], ["a", "b"])
        self.assertEqual(
            report["records"][0]["sourceAvailability"],
            "original-page-unavailable",
        )
        self.assertEqual(
            report["records"][0]["reviewPriority"],
            "inspect_bibliographic_evidence",
        )
        self.assertEqual(
            report["records"][1]["sourceAvailability"],
            "not_verified",
        )
        self.assertFalse(any("author" in item for item in report["records"]))

    def test_encoding_alert_is_informational(self):
        report = audit_pending_authors([
            {"id": "x", "journal": "Sincronía", "title": "P\ufffdrez", "authors": []}
        ])
        self.assertEqual(report["titlesWithUnicodeReplacementCharacter"], 1)
        self.assertEqual(report["pendingAuthorRecords"], 1)


if __name__ == "__main__":
    unittest.main()
