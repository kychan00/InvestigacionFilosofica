import unittest

from scripts.cucsh.probe_sincronia_fallback import (
    fallback_candidates, targets_from_evidence,
)


class AlternativeRouteTests(unittest.TestCase):
    def test_orig_archive_hosts_are_reversible(self):
        a = fallback_candidates("http://sincronia.cucsh.udg.mx/Garcia.htm")
        self.assertIn(
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/Garcia.htm", a
        )
        b = fallback_candidates(
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/etica.htm"
        )
        self.assertIn("http://sincronia.cucsh.udg.mx/etica.htm", b)

    def test_untrusted_host_never_fetched(self):
        self.assertEqual(
            fallback_candidates("http://fake.example.org/etica.htm"), []
        )

    def test_only_first_failed_or_still_corrupt_source_rows(self):
        records = {
            "records": [
                {
                    "id": "missing", "journal": "Sincronía",
                    "legacyOriginal": True, "issueNumber": 1,
                    "title": "Antropología", "authors": [],
                    "urls": {"canonical": "http://sincronia.cucsh.udg.mx/a.htm"},
                },
                {
                    "id": "broken", "journal": "Sincronía",
                    "legacyOriginal": True, "issueNumber": 2,
                    "title": "Filosof\ufffda", "authors": [],
                    "urls": {"canonical": "http://sincronia.cucsh.udg.mx/b.htm"},
                },
                {
                    "id": "good", "journal": "Sincronía",
                    "legacyOriginal": True, "issueNumber": 3,
                    "title": "Ética", "authors": [],
                    "urls": {"canonical": "http://sincronia.cucsh.udg.mx/c.htm"},
                },
            ],
        }
        prior = {"sourceFindings": [
            {"id": "missing", "status": "source_unavailable"},
        ]}
        target = targets_from_evidence(records, prior)
        self.assertEqual([r["id"] for r in target], ["missing", "broken"])

    def test_https_same_path_but_no_repeated_http(self):
        urls = fallback_candidates(
            "http://sincronia.cucsh.udg.mx/Ethics.html"
        )
        self.assertEqual(len(urls), len(set(urls)))
        self.assertIn(
            "https://sincronia.cucsh.udg.mx/Ethics.html", urls
        )


if __name__ == "__main__":
    unittest.main()
