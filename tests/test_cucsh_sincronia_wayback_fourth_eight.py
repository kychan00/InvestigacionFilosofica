"""Offline deterministic tests for fourth eight-work Wayback probe."""
import copy
import unittest

from scripts.cucsh.probe_sincronia_wayback_fourth_eight import (
    TARGET_IDS, make_report,
)


def fixture():
    rows = [
        {
            "id": rid,
            "issueNumber": [16, 12, 13, 13, 11, 4, 18, 14][i],
            "year": 2000 if i == 0 else 1999 if i in (1,4) else 1997 if i == 5 else 2001,
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
        for i in range(30)
    )
    return {
        "totalSincroniaRecords": 1454,
        "pendingAuthorRecords": 38,
        "highConfidenceEditorialNavigationCount": 2,
        "records": rows,
    }


class ArchiveFourthEightTests(unittest.TestCase):
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
        self.assertEqual(result["inputMissingAuthors"], 38)
        self.assertEqual(result["inputCorpusRecords"], 1454)

    def test_refuse_stale_counts_missing_ids_or_duplicate_work(self):
        for k,v in (
            ("totalSincroniaRecords", 1453),
            ("pendingAuthorRecords", 43),
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


    def test_try_later_capture_after_first_fetch_fails(self):
        from unittest.mock import patch
        from scripts.cucsh.probe_sincronia_wayback_fourth_eight import inspect_with_alternates
        row = fixture()["records"][0]
        primary = {
            "snapshots": [
                {"snapshotUrl": "https://web.archive.org/web/20010101010101/http://site.invalid/original.htm",
                 "snapshotFetchStatus": "fetch-error"},
                {"snapshotUrl": "https://web.archive.org/web/20020101010101/http://site.invalid/original.htm"},
            ],
            "authorAttribution": None,
        }
        with patch(
            "scripts.cucsh.probe_sincronia_wayback_fourth_eight.inspect_entry",
            return_value=primary
        ), patch(
            "scripts.cucsh.probe_sincronia_wayback_fourth_eight.fetch_snapshot_excerpt",
            return_value={"snapshotFetchStatus": "html-response",
                          "unverifiedOpeningExcerpt": "Signed article by X"}
        ) as later:
            result = inspect_with_alternates(row)
        self.assertEqual(result["snapshots"][1]["snapshotFetchStatus"], "html-response")
        self.assertIsNone(result["authorAttribution"])
        later.assert_called_once()

if __name__ == "__main__":
    unittest.main()
