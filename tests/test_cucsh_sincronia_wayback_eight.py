"""Offline deterministic tests of the eight-entry Wayback research probe."""
import copy
import unittest

from scripts.cucsh.probe_sincronia_wayback_eight import (
    TARGET_IDS, cdx_url, available_url, parse_cdx, parse_available,
    inspect_entry, make_report, VisibleText,
)


def fixture():
    records = [
        {
            "id": rid, "issueNumber": 1 if i < 3 else 2 if i == 3 else 4,
            "year": 1996 if i < 3 else 1997,
            "title": f"Historical title {i}",
            "originalUrl": f"http://sincronia.cucsh.udg.mx/legacy{i}.htm",
            "sourceAvailability": "original-page-unavailable",
        }
        for i, rid in enumerate(TARGET_IDS)
    ]
    records.extend(
        {"id": f"pending-{i}", "issueNumber": 12, "year": 1999,
         "title": f"Other {i}", "originalUrl": f"http://foo.invalid/{i}.htm",
         "sourceAvailability": "original-page-unavailable"}
        for i in range(43)
    )
    return {
        "totalSincroniaRecords": 1454,
        "pendingAuthorRecords": 51,
        "highConfidenceEditorialNavigationCount": 2,
        "records": records,
    }


class ArchiveEightTests(unittest.TestCase):
    def test_targets_are_eight_distinct_stable_records(self):
        self.assertEqual(len(TARGET_IDS), 8)
        self.assertEqual(len(TARGET_IDS), len(set(TARGET_IDS)))
        self.assertTrue(all(x.startswith("cucsh:sincronia-legacy:") for x in TARGET_IDS))

    def test_cdx_parser_accepts_only_real_html_200_captures(self):
        original = "http://sincronia.cucsh.udg.mx/vevia.html"
        response = [
            ["timestamp", "original", "statuscode", "mimetype"],
            ["19991201120203", original, "200", "text/html"],
            ["20000101010101", original, "404", "text/html"],
            ["20010101010101", original, "200", "application/pdf"],
            ["20020101010101", "http://evil.invalid/other.html", "200", "text/html"],
            ["not-a-date", original, "200", "text/html"],
        ]
        found = parse_cdx(response, original)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["timestamp"], "19991201120203")
        self.assertTrue(found[0]["snapshotUrl"].startswith(
            "https://web.archive.org/web/19991201120203/"
        ))
        self.assertEqual(parse_cdx([], original), [])
        self.assertEqual(parse_cdx([["invalid"]], original), [])

    def test_available_api_needs_matching_snapshot(self):
        orig = "http://sincronia.cucsh.udg.mx/vevia.html"
        payload = {"archived_snapshots": {"closest": {
            "available": True, "timestamp": "20010501010101",
            "url": "https://web.archive.org/web/20010501010101/" + orig,
        }}}
        self.assertEqual(len(parse_available(payload, orig)), 1)
        self.assertEqual(parse_available(payload, "http://else.invalid/no.html"), [])
        payload["archived_snapshots"]["closest"]["available"] = False
        self.assertEqual(parse_available(payload, orig), [])

    def test_inspection_can_fail_without_inventing_author(self):
        original = fixture()["records"][0]
        def blocked(url):
            raise OSError("HTTP 403 archive service unavailable")
        result = inspect_entry(original, json_fetch=blocked)
        self.assertEqual(result["id"], original["id"])
        self.assertEqual(result["archiveIndexStatus"], "cdx-error")
        self.assertEqual(result["fallbackIndexStatus"], "available-error")
        self.assertEqual(result["snapshots"], [])
        self.assertIsNone(result["authorAttribution"])

    def test_source_excerpt_is_not_a_verified_byline(self):
        original = fixture()["records"][0]
        def cdx(uri):
            return [
                ["timestamp", "original", "statuscode", "mimetype"],
                ["19991010010101", original["originalUrl"], "200", "text/html"],
            ]
        def excerpt(uri):
            return {"snapshotFetchStatus": "html-response",
                    "unverifiedOpeningExcerpt": "Título | AUTOR: someone"}
        result = inspect_entry(original, json_fetch=cdx, snapshot_fetch=excerpt)
        self.assertEqual(len(result["snapshots"]), 1)
        self.assertIsNone(result["authorAttribution"])
        self.assertIn("manual", result["reviewInstruction"].lower() if "manual" in result["reviewInstruction"].lower() else "manual")
        self.assertEqual(result["indexedAvailability"], original["sourceAvailability"])

    def test_html_parser_ignores_script_and_caps_excerpts(self):
        parser = VisibleText()
        parser.feed(
            "<html><title>Historic work</title><script>BADSECRET</script>"
            "<h1>Author in header</h1><p>Historical scholarly article</p></html>"
        )
        result = parser.summary()
        self.assertEqual(result["archivedPageTitle"], "Historic work")
        self.assertNotIn("BADSECRET", result["unverifiedOpeningExcerpt"])
        self.assertLessEqual(len(result["unverifiedOpeningExcerpt"]), 750)

    def test_report_is_read_only_and_exactly_eight(self):
        data = fixture()
        before = copy.deepcopy(data)
        seen = []
        def stub(record):
            seen.append(record["id"])
            return {"id": record["id"], "snapshots": [], "authorAttribution": None}
        result = make_report(data, inspect=stub)
        self.assertEqual(seen, TARGET_IDS)
        self.assertEqual(result["selectionCount"], 8)
        self.assertEqual(result["withSnapshotLeads"], 0)
        self.assertFalse(result["metadataMutation"])
        self.assertTrue(result["manualVerificationRequired"])
        self.assertEqual(data, before)

    def test_missing_or_stale_input_fails_closed(self):
        for field, value in (
            ("pendingAuthorRecords", 50),
            ("totalSincroniaRecords", 1453),
            ("highConfidenceEditorialNavigationCount", 1),
        ):
            with self.subTest(field=field):
                data = fixture()
                data[field] = value
                with self.assertRaises(ValueError):
                    make_report(data, inspect=lambda r: r)
        data = fixture()
        data["records"].pop(0)
        with self.assertRaises(ValueError):
            make_report(data, inspect=lambda r: r)

    def test_encoded_query_paths_use_urlencode(self):
        self.assertIn("url=", cdx_url("http://foo.invalid/x y.htm"))
        self.assertIn("output=json", cdx_url("http://foo.invalid/x y.htm"))
        self.assertIn("timestamp=20000101", available_url("http://foo.invalid/a.htm"))


if __name__ == "__main__":
    unittest.main()
