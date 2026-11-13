"""Network-free tests: no archive response is a source attribution."""
import json
import unittest

from scripts.cucsh.probe_sincronia_campos_arquivo_pt import (
    CANDIDATE_URLS, extract_search_results, parse_cdx_json_lines, probe, report,
)

class ArquivoCamposTests(unittest.TestCase):
    def test_cdx_is_ndjson_and_provenance_is_separate(self):
        raw='{"timestamp":"20010201120700","original":"http://sincronia.cucsh.udg.mx/campos.htm","status":"200"}\n'
        self.assertEqual(len(parse_cdx_json_lines(raw)),1)
        self.assertEqual(parse_cdx_json_lines(""),[])

    def test_search_results_only_copy_bounded_metadata(self):
        source={"responseItems":[{"title":"Uma Situação de Palavras",
                "originalURL":"http://sincronia.cucsh.udg.mx/campos.htm",
                "linkToArchive":"https://arquivo.pt/wayback/20020301/example",
                "tstamp":"20020301", "contents":"private or misleading text"}]}
        result=extract_search_results(json.dumps(source))
        self.assertEqual(len(result),1)
        self.assertNotIn("contents",result[0])

    def test_empty_and_failed_archives_never_create_authorship(self):
        def fake(url):
            if "/wayback/cdx?" in url:
                return '{"timestamp":"20020607092529","original":"http://sincronia.cucsh.udg.mx/campos.htm","statuscode":"200"}\n'
            if "versionHistory=" in url:
                return json.dumps({"responseItems":[]})
            raise TimeoutError("network")
        result=report(fetcher=fake)
        self.assertEqual(result["authorAssignments"],0)
        self.assertFalse(result["corpusModified"])
        self.assertFalse(result["originalWorkIdentityVerified"])
        self.assertEqual(len(result["urlChecks"]),4)
        self.assertEqual(len(result["fullTextChecks"]),3)
        self.assertEqual(result["urlChecks"][0]["cdx"]["results"][0]["timestamp"],"20020607092529")
        self.assertEqual(result["fullTextChecks"][0]["status"],"archive_access_failed")
        self.assertNotEqual(CANDIDATE_URLS[0],CANDIDATE_URLS[1])

    def test_failure_does_not_masquerade_as_no_captures(self):
        result=probe("https://arquivo.pt/wayback/cdx", {"url":CANDIDATE_URLS[0]},
                     fetcher=lambda url: (_ for _ in ()).throw(TimeoutError("blocked")))
        self.assertEqual(result["status"],"archive_access_failed")
        self.assertEqual(result["errorType"],"TimeoutError")

if __name__ == "__main__":
    unittest.main()
