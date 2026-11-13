"""Offline deterministic tests for seventh eight-work Wayback probe."""
import copy
import unittest

from scripts.cucsh.probe_sincronia_wayback_seventh_eight import (
    TARGET_IDS, make_report,
)


def fixture():
    rows = [
        {
            "id": rid,
            "issueNumber": [12, 13, 13, 14, 15, 18, 18, 18][i],
            "year": 1999 if i == 0 else 2000 if i < 5 else 2001,
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
        for i in range(19)
    )
    return {
        "totalSincroniaRecords": 1454,
        "pendingAuthorRecords": 27,
        "highConfidenceEditorialNavigationCount": 2,
        "records": rows,
    }


class ArchiveSeventhEightTests(unittest.TestCase):
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
        self.assertEqual(set(checked), set(TARGET_IDS))
        self.assertEqual([r["id"] for r in result["records"]], TARGET_IDS)
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
        self.assertEqual(result["inputMissingAuthors"], 32
        self.assertEqual(result["inputCorpusRecords"], 1454)

    def test_refuse_stale_counts_missing_ids_or_duplicate_work(self):
        for k,v in (
            ("totalSincroniaRecords", 1453),
            ("pendingAuthorRecords", 32),
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
        from scripts.cucsh.probe_sincronia_wayback_seventh_eight import inspect_with_alternates
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
            "scripts.cucsh.probe_sincronia_wayback_seventh_eight.inspect_entry",
            return_value=primary
        ), patch(
            "scripts.cucsh.probe_sincronia_wayback_seventh_eight.fetch_snapshot_excerpt",
            return_value={"snapshotFetchStatus": "html-response",
                          "unverifiedOpeningExcerpt": "Signed article by X"}
        ) as later:
            result = inspect_with_alternates(row)
        self.assertEqual(result["snapshots"][1]["snapshotFetchStatus"], "html-response")
        self.assertIsNone(result["authorAttribution"])
        later.assert_called_once()


    def test_alternative_host_evidence_is_separate_and_unverified(self):
        from unittest.mock import patch
        from scripts.cucsh.probe_sincronia_wayback_seventh_eight import (
            inspect_with_alternates_and_hosts,
        )
        row = fixture()["records"][0]
        primary = {
            "id": row["id"], "originalUrl": row["originalUrl"],
            "snapshots": [], "authorAttribution": None,
        }
        with patch(
            "scripts.cucsh.probe_sincronia_wayback_seventh_eight.inspect_with_alternates",
            return_value=primary
        ), patch(
            "scripts.cucsh.probe_sincronia_wayback_seventh_eight.get_json",
            return_value=[
                ["timestamp", "original", "statuscode", "mimetype"],
                ["20000202020202",
                 "http://sincronia.cucsh.udg.mx/work0.htm",
                 "200", "text/html"]
            ]
        ):
            result = inspect_with_alternates_and_hosts(row)
        self.assertEqual(result["snapshots"], [])
        self.assertIsNone(result["authorAttribution"])
        self.assertEqual(len(result["otherHostCandidates"]), 1)
        self.assertIn(
            "unverified-work-identity",
            result["otherHostCandidates"][0]["urlMatchLevel"],
        )

if __name__ == "__main__":
    unittest.main()
