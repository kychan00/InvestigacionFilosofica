#!/usr/bin/env python3
import unittest

from scripts.cucsh.backfill_sincronia_44 import (
    backfill_snapshot, issue44_additions,
)


def original(number):
    return {
        "id": "original:" + str(number),
        "journal": "Sincronía",
        "issueNumber": 44,
        "title": "An existing historical paper " + str(number),
        "year": 2007,
        "authors": [],
        "urls": {"canonical": "https://old.example.net/" + str(number)},
    }


class SincroniaIssue44BackfillTest(unittest.TestCase):
    def test_exact_eight_source_evidence_records(self):
        additions = issue44_additions()
        self.assertEqual(len(additions), 8)
        self.assertEqual(len({r["id"] for r in additions}), 8)
        self.assertTrue(all(r["issueNumber"] == 44 for r in additions))
        self.assertTrue(all(r["year"] == 2007 for r in additions))
        self.assertTrue(all(r["legacyMetadataSource"] == "Dialnet" for r in additions))

    def test_preserves_other_journals_and_existing_articles(self):
        other = {"journal": "Protrepsis", "id": "prot:1", "year": 2020,
                 "title": "Another article", "urls": {}}
        before = {"schemaVersion": 1, "provider": "CUCSH Filosofía",
                  "records": [other, original(1), original(2)]}
        after, report = backfill_snapshot(before)
        self.assertEqual(report["added"], 8)
        self.assertEqual(report["after"], 10)
        self.assertEqual(len(after["records"]), 11)
        self.assertTrue(all(r in after["records"] for r in before["records"]))
        second, report2 = backfill_snapshot(after)
        self.assertEqual(report2["added"], 0)
        self.assertEqual(after, second)

    def test_rejects_conflicting_existing_dialnet_id(self):
        prior = issue44_additions()[0].copy()
        prior["issueNumber"] = 43
        data = {"records": [original(1), original(2), prior]}
        with self.assertRaisesRegex(ValueError, "Conflicting record"):
            backfill_snapshot(data)


if __name__ == "__main__":
    unittest.main()
