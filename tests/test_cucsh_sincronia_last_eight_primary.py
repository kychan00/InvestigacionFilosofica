"""Offline, fail-closed regression for the final eight original archive investigations."""
import copy
import unittest
from unittest.mock import patch

from scripts.cucsh.research_sincronia_last_eight_primary import (
    TARGET_IDS, ReadableArticle, detailed_snapshot, fetch_index,
    variants, inspect, make_report,
)


def fixture():
    rows = [
        {
            "id": rid,
            "issueNumber": [1, 4, 4, 4, 8, 8, 15, 8][i],
            "year": [1996, 1997, 1997, 1997, 1998, 1998, 2000, 1998][i],
            "title": f"Original indexed title {i}",
            "originalUrl": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/ana.html"
                if i == 4 else f"http://sincronia.cucsh.udg.mx/item{i}.htm"
            ),
            "sourceAvailability": "original-page-unavailable",
        }
        for i, rid in enumerate(TARGET_IDS)
    ]
    rows.extend(
        {"id": f"pending-{i}", "issueNumber": 7, "year": 1998,
         "title": f"Unresolved {i}",
         "originalUrl": f"http://sincronia.cucsh.udg.mx/other{i}.htm",
         "sourceAvailability": "original-page-unavailable"}
        for i in range(8)
    )
    return {
        "totalSincroniaRecords": 1454,
        "pendingAuthorRecords": 16,
        "highConfidenceEditorialNavigationCount": 2,
        "records": rows,
    }


class DeepArchiveEightTests(unittest.TestCase):
    def test_exact_target_ids_and_no_rewrite_of_index(self):
        self.assertEqual(len(TARGET_IDS), 8)
        self.assertEqual(len(TARGET_IDS), len(set(TARGET_IDS)))
        original = fixture()
        baseline = copy.deepcopy(original)
        report = make_report(original, probe=lambda r: {
            "id": r["id"],
            "authorAttribution": None,
            "originalRecordModified": False,
            "candidateSourceCaptures": [],
        })
        self.assertEqual(report["selected"], 8)
        self.assertEqual(report["inputPendingAuthors"], 16)
        self.assertEqual(report["inputSincroniaCount"], 1454)
        self.assertEqual(report["authorsAutomaticallyAssigned"], 0)
        self.assertFalse(report["sourceCorpusModified"])
        self.assertEqual([r["id"] for r in report["records"]], TARGET_IDS)
        self.assertEqual(original, baseline)

    def test_exact_original_and_alternative_hosts_stay_separate(self):
        original = "http://sincronia.cucsh.udg.mx/mandell.htm"
        u = variants(original)
        self.assertEqual(u[0], original)
        self.assertIn(
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/mandell.htm", u
        )
        self.assertEqual(len(u), len(set(u)))
        dante = variants(
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/ana.html"
        )
        self.assertEqual(dante[1],
                         "http://sincronia.cucsh.udg.mx/dante/ana.html")
        schmid = variants(
            "http://fuentes.csh.udg.mx/FrontPage%20Webs/Content/schmid.html"
        )
        self.assertIn(
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/schmid.html",
            schmid,
        )

    def test_different_host_never_automatically_attributed(self):
        row = fixture()["records"][1]
        def fake_index(url):
            return ([{
                "timestamp": "19990201010101",
                "snapshotUrl": "https://web.archive.org/web/19990201010101/" + url,
                "archivedOriginal": url,
            }], [])
        result = inspect(
            row,
            index_fetch=fake_index,
            capture_fetch=lambda _: {
                "fetchStatus": "html",
                "unverifiedArticleText": "A signed work by someone",
            },
        )
        self.assertIsNone(result["authorAttribution"])
        self.assertFalse(result["originalRecordModified"])
        self.assertEqual(result["originalUrl"], row["originalUrl"])
        self.assertEqual(result["originalSourceStatus"], row["sourceAvailability"])
        self.assertEqual(
            result["candidateSourceCaptures"][0]["urlIdentity"],
            "exact-frozen-original",
        )
        self.assertEqual(
            result["candidateSourceCaptures"][1]["urlIdentity"],
            "different-historical-host-unverified-title-and-author",
        )

    def test_archived_html_parser_ignores_script_and_preserves_text(self):
        html = (
            "<html><head><title>Historic title</title><script>SECRET</script></head>"
            "<body><h1>Historic article</h1><p>Signed by Writer A</p></body></html>"
        )
        parser = ReadableArticle()
        parser.feed(html)
        report = parser.result()
        self.assertEqual(report["archivedHtmlTitle"], "Historic title")
        self.assertIn("Signed by Writer A", report["unverifiedArticleText"])
        self.assertNotIn("SECRET", report["unverifiedArticleText"])
        self.assertFalse(report["contentTruncated"])

    def test_source_service_down_must_not_create_signatures(self):
        row = fixture()["records"][0]
        result = inspect(
            row,
            index_fetch=lambda url: ([], ["cdx:HTTPError"]),
            capture_fetch=lambda _: self.fail("Must not fetch unavailable capture"),
        )
        self.assertIsNone(result["authorAttribution"])
        self.assertEqual(len(result["candidateSourceCaptures"]), len(variants(row["originalUrl"])))
        self.assertTrue(all(not x["captures"]
                            for x in result["candidateSourceCaptures"]))

    def test_fail_closed_on_stale_queue_duplicate_or_missing_identity(self):
        for field, value in (
            ("totalSincroniaRecords", 1453),
            ("pendingAuthorRecords", 20),
            ("highConfidenceEditorialNavigationCount", 1),
        ):
            with self.subTest(field=field):
                data = fixture()
                data[field] = value
                with self.assertRaises(ValueError):
                    make_report(data, probe=lambda x: x)
        data = fixture()
        data["records"].pop(0)
        with self.assertRaises(ValueError):
            make_report(data, probe=lambda x: x)
        data = fixture()
        data["records"][1]["id"] = data["records"][0]["id"]
        with self.assertRaises(ValueError):
            make_report(data, probe=lambda x: x)

    def test_archival_index_api_query_is_bounded_and_parseable(self):
        orig = "http://sincronia.cucsh.udg.mx/sergio.htm"
        received = []
        def fake_get(url, timeout=8):
            received.append((url, timeout))
            return [
                ["timestamp", "original", "statuscode", "mimetype"],
                ["19980102030405", orig, "200", "text/html"],
            ]
        snapshots, errors = fetch_index(orig, getter=fake_get)
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(errors, [])
        self.assertEqual(received[0][1], 8)
        self.assertIn("cdx/search/cdx?", received[0][0])


if __name__ == "__main__":
    unittest.main()
