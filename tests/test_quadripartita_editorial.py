#!/usr/bin/env python3
"""Offline unit tests for the verified Quadripartita editorial policy."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "cucsh"))

from quadripartita_editorial import editorial_metadata, ISSUE_YEARS


class EditorialMetadataTests(unittest.TestCase):
    def record(self, issue=20, article=185, year=2026, date="2026-05-20"):
        return {
            "journal": "Quadripartita Ratio",
            "doi": f"10.32870/qr.v10i{issue}.{article}",
            "year": year,
            "date": date,
            "title": "Sample title",
            "urls": {
                "canonical":
                    f"https://quadripartitaratio.cucsh.udg.mx/index.php/QR/article/view/{article}"
            },
        }

    def test_editorial_archive_covers_all_21_numbers(self):
        self.assertEqual(sorted(ISSUE_YEARS), list(range(1, 22)))

    def test_doi_exception_without_rewriting_identity(self):
        original = self.record()
        updated = editorial_metadata(original)
        self.assertEqual(updated["doi"], original["doi"])
        self.assertEqual(updated["issueNumber"], 21)
        self.assertEqual(updated["issueYear"], 2026)
        self.assertEqual(updated["publicationDate"], "2026-05-20")
        self.assertEqual(updated["date"], "2026-05-20")
        self.assertEqual(updated["publicationYear"], 2026)
        self.assertEqual(original["year"], 2026)
        self.assertEqual(editorial_metadata(updated), updated)

    def test_retains_late_publication_year(self):
        record = self.record(issue=19, article=186, year=2026, date="2026-07-02")
        result = editorial_metadata(record)
        self.assertEqual(result["issueNumber"], 19)
        self.assertEqual(result["year"], 2025)
        self.assertEqual(result["publicationYear"], 2026)
        self.assertEqual(result["date"], "2026-07-02")

    def test_pre_release_date_kept_separately(self):
        record = self.record(issue=5, article=71, year=2017, date="2017-12-31")
        result = editorial_metadata(record)
        self.assertEqual(result["issueYear"], 2018)
        self.assertEqual(result["publicationYear"], 2017)
        self.assertEqual(result["date"], "2017-12-31")

    def test_fail_closed_for_wrong_canonical_identity(self):
        record = self.record()
        record["urls"]["canonical"] += "0"
        self.assertEqual(editorial_metadata(record), record)

    def test_fail_closed_for_unrecognized_doi(self):
        record = self.record()
        record["doi"] = "10.1000/not-our-journal"
        self.assertEqual(editorial_metadata(record), record)

    def test_does_not_change_other_journals(self):
        record = self.record()
        record["journal"] = "Protrepsis"
        self.assertEqual(editorial_metadata(record), record)


if __name__ == "__main__":
    unittest.main()
