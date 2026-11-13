"""Exact 2000 source restoration; reject mismatch, loss or recycled URL."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_campos_2000_primary import (
    restore_one, TARGET_ID, INDEX_LABEL, VERIFIED_TITLE, VERIFIED_AUTHOR,
    ORIGINAL_CATALOG_URL, ARTICLE_CAPTURE, INDEX_CAPTURE,
    OTHER_ARTICLE_CAPTURE, REUSED_2001_CAPTURE
)


def fixture():
    return {
        "schemaVersion": 1,
        "provider": "CUCSH Filosofía",
        "records": [
            {"id": "unrelated", "journal": "Sincronía", "year": 1998,
             "issueNumber": 8, "title": "Biografía", "authors": [],
             "legacyOriginal": True, "urls": {"canonical": "http://example.org/bio.html"}},
            {"id": TARGET_ID, "journal": "Sincronía", "issueNumber": 15,
             "year": 2000, "title": INDEX_LABEL, "authors": [],
             "legacyOriginal": True, "titleVariants": ["de Campos,Jorge Lucio"],
             "urls": {"canonical": ORIGINAL_CATALOG_URL},
             "legacyAccessStatus": {"status": "original-page-unavailable",
                                    "detail": "historical link unavailable"}},
        ],
    }


class SignedCamposRestorationTests(unittest.TestCase):
    def test_one_work_restored_with_primary_sources_and_no_other_mutation(self):
        data = fixture()
        before = copy.deepcopy(data)
        result, changed = restore_one(data, require_full_corpus=False)
        self.assertEqual(changed, [TARGET_ID])
        self.assertEqual(result["records"][0], before["records"][0])
        item = result["records"][1]
        self.assertEqual(item["title"], VERIFIED_TITLE)
        self.assertEqual(item["titleVariants"], [VERIFIED_TITLE, INDEX_LABEL])
        self.assertEqual(item["authors"], [{"name": VERIFIED_AUTHOR,
                                              "sourceName": VERIFIED_AUTHOR}])
        self.assertEqual(item["urls"], before["records"][1]["urls"])
        self.assertEqual(item["legacyAccessStatus"],
                         before["records"][1]["legacyAccessStatus"])
        self.assertEqual(item["id"], before["records"][1]["id"])
        self.assertEqual(item["year"], 2000)
        e = item["legacyIndexMislabelEvidence"]
        self.assertEqual(e["indexSourceUrl"], INDEX_CAPTURE)
        self.assertEqual(e["signedArticleSourceUrl"], ARTICLE_CAPTURE)
        self.assertEqual(e["separateDeleuzeArticleSourceUrl"],
                         OTHER_ARTICLE_CAPTURE)
        self.assertEqual(e["different2001InterviewOnReusedUrl"],
                         REUSED_2001_CAPTURE)
        self.assertIn("HTML <title>", e["archivedHtmlTitleDiscrepancy"])
        self.assertTrue(e["originalAvailabilityPreserved"])

    def test_reused_newer_host_cannot_be_signed_primary_source(self):
        original = fixture()
        old = original["records"][1]
        for name, value in (
            ("issueNumber", 17), ("year", 2001),
            ("title", "Uma Situação de Palavras"),
            ("authors", [{"name": VERIFIED_AUTHOR}]),
            ("journal", "Protrepsis"),
            ("legacyOriginal", False),
            ("urls", {"canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/campos.htm"}),
            ("legacyAccessStatus", {"status": "original-page-archived-only"}),
            ("legacyAuthorEvidence", {"claimed": "older"}),
            ("legacyIndexMislabelEvidence", {"claimed": "older"}),
        ):
            with self.subTest(name=name):
                data = fixture()
                data["records"][1][name] = value
                with self.assertRaises(ValueError):
                    restore_one(data, require_full_corpus=False)
        self.assertEqual(original["records"][1], old)

    def test_duplicate_ids_rejected(self):
        d = fixture()
        d["records"].append(copy.deepcopy(d["records"][1]))
        with self.assertRaises(ValueError):
            restore_one(d, require_full_corpus=False)

    def test_idempotent_second_restoration_fails_closed(self):
        d, _ = restore_one(fixture(), require_full_corpus=False)
        with self.assertRaises(ValueError):
            restore_one(d, require_full_corpus=False)

    def test_reject_wrong_frozen_corpus_count(self):
        with self.assertRaises(ValueError):
            restore_one(fixture(), require_full_corpus=True)

if __name__ == "__main__":
    unittest.main()
