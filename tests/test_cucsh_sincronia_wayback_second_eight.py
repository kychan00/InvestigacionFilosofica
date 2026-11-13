"""Offline deterministic tests for second eight-work Wayback probe."""
import copy
import unittest

from scripts.cucsh.probe_sincronia_wayback_second_eight import (
    TARGET_IDS, make_report,
)


def fixture():
    rows = [
        {
            "id": rid,
            "issueNumber": [5, 9, 9, 11, 11, 12, 13, 13][i],
            "year": 1998 if i == 0 else 1999 if i < 6 else 2000,
            "title": f"Archived index title #{i}",
            "originalUrl": f"http://fuentes.csh.udg.mx/CUCSH/Sincronia/work{i}.htm",
            "sourceAvailability": "original-page-archived-only",
        }
        for i, rid in enumerate(TARGET_IDS)
    ]
    rows.extend(
        {
            "id": f"other-{i}",
            "issueNumber": 18, "year": 2001, "title": f"Later {i}",
            "originalUrl": f"http://sincronia.cucsh.udg.mx/later{i}.html",
            "sourceAvailability": "original-page-unavailable",
        }
        for i in range(39)
    )
    return {
        "totalSincroniaRecords": 1454,
        "pendingAuthorRecords": 47,
        "highConfidenceEditorialNavigationCount": 2,
        "records": rows,
    }


class ArchiveSecondEightTests(unittest.TestCase):
    def test_exact_eight_unique_frozen_ids(self):
        self.assertEqual(len(TARGET_IDS), len(set(TARGET_IDS)))
        self.assertEqual(len(TARGET_IDS), 8)
        self.assertTrue(all(v.startswith("cucsh:sincronia-legacy:") for v in TARGET_IDS))

    def test_evidence_probing_does_not_modify_records(self):
        data = fixture()
        previous = copy.deepcopy(data)
        checked = []
        def inspect(row):
            checked.append(row["id"])
            return {
                "id": row["id"],
                "snapshots": [{"timestamp": "19990101010101"}],
                "authorAttribution": None,
            }
        result = make_report(data, inspect=inspect)
        self.assertEqual(checked, TARGET_IDS)
        self.assertEqual(data, previous)
        self.assertEqual(result["selected"], 8)
        self.assertEqual(result["withSnapshotLeads"], 8)
        self.assertFalse(result["originalCorpusModified"])
        self.assertFalse(result["authorAttributionAllowed"])
        self.assertTrue(result["manualVerificationRequired"])
        self.assertTrue(all(r["authorAttribution"] is None for r in result["records"]))

    def test_empty_archive_results_are_not_authorship_evidence(self):
        result = make_report(fixture(), inspect=lambda r: {
            "id": r["id"], "snapshots": [], "authorAttribution": None,
        })
        self.assertEqual(result["withSnapshotLeads"], 0)
        self.assertEqual(result["inputMissingAuthors"], 47)
        self.assertEqual(result["inputCorpusRecords"], 1454)

    def test_refuse_stale_counts_missing_ids_or_duplicate_work(self):
        for k,v in (
            ("totalSincroniaRecords", 1453),
            ("pendingAuthorRecords", 51),
            ("highConfidenceEditorialNavigationCount", 1),
        ):
            with self.subTest(key=k):
                data = fixture()
                data[k] = v
                with self.assertRaises(ValueError):
                    make_report(data, inspect=lambda r:r)
        data = fixture()
        data["records"].pop(0)
        with self.assertRaises(ValueError):
            make_report(data, inspect=lambda r:r)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            make_report(data, inspect=lambda r:r)


if __name__ == "__main__":
    unittest.main()
