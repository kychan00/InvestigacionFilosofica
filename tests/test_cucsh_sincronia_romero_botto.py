import copy
import unittest

from scripts.cucsh.restore_sincronia_romero_botto import (
    ID, OLD, TITLE, SHORT, AUTHOR,
    CITATION_USP, CITATION_UNESP, restore_botto_title,
)
from scripts.cucsh.validate_update import safe_romero_botto_restoration


def fixture():
    target = {
        "id": ID, "journal": "Sincronía",
        "issueNumber": 13, "year": 2000,
        "title": OLD, "titleVariants": [OLD],
        "authors": [], "legacyOriginal": True,
        "urls": {
            "canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/botto.htm",
        },
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "original-index-name"},
    }
    pending = [
        {"id": f"missing-{i}", "journal": "Sincronía",
         "title": f"Unattributed {i}", "authors": []}
        for i in range(88)
    ]
    authored = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Article {i}",
         "authors": [{"name": "Previously Verified Author"}]}
        for i in range(1365)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": [target] + pending + authored + other}


class RomeroBottoRestorationTests(unittest.TestCase):
    def test_exact_one_record_title_author_and_provenance(self):
        data = fixture()
        prior = copy.deepcopy(data)
        updated, changed = restore_botto_title(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(updated["records"]), 1845)
        original, result = prior["records"][0], updated["records"][0]
        expected = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        self.assertEqual({
            key for key in set(original) | set(result)
            if original.get(key) != result.get(key)
        }, expected)
        self.assertEqual(result["title"], TITLE)
        self.assertEqual(result["titleVariants"], [TITLE, SHORT, OLD])
        self.assertEqual(result["authors"], [{
            "name": AUTHOR, "sourceName": AUTHOR,
        }])
        self.assertEqual(
            result["legacyIndexMislabelEvidence"]["sourceUrl"], CITATION_USP
        )
        self.assertEqual(
            result["legacyIndexMislabelEvidence"]["independentSourceUrl"],
            CITATION_UNESP,
        )
        self.assertTrue(safe_romero_botto_restoration(original, result))
        self.assertEqual(prior["records"][1:], updated["records"][1:])
        self.assertEqual(result["urls"], original["urls"])
        self.assertEqual(
            result["legacyAccessStatus"], original["legacyAccessStatus"]
        )

    def test_empty_variant_baseline_retains_both_cited_forms_and_index_label(self):
        data = fixture()
        data["records"][0]["titleVariants"] = []
        prior = copy.deepcopy(data)
        updated, _ = restore_botto_title(data)
        result = updated["records"][0]
        self.assertEqual(result["titleVariants"], [TITLE, SHORT, OLD])
        self.assertTrue(
            safe_romero_botto_restoration(prior["records"][0], result)
        )

    def test_mismatched_previous_title_fails_closed(self):
        data = fixture()
        data["records"][0]["title"] = "Unknown historical title"
        with self.assertRaisesRegex(ValueError, "identity mismatch"):
            restore_botto_title(data)

    def test_never_overwrite_existing_author(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Someone"}]
        with self.assertRaises(ValueError):
            restore_botto_title(data)

    def test_independent_guard_rejects_source_and_legacy_url_tampering(self):
        data = fixture()
        prior = copy.deepcopy(data)
        updated, _ = restore_botto_title(data)
        baseline, result = prior["records"][0], updated["records"][0]
        for which in ("url", "source", "short", "author", "availability"):
            altered = copy.deepcopy(result)
            if which == "url":
                altered["urls"]["canonical"] = "https://not-original.example/"
            elif which == "source":
                altered["legacyAuthorEvidence"]["sourceUrl"] = (
                    "https://uncited.example/"
                )
            elif which == "short":
                altered["titleVariants"].remove(SHORT)
            elif which == "author":
                altered["authors"][0]["name"] = "Wrong Person"
            elif which == "availability":
                altered["legacyAccessStatus"] = {"status": "live"}
            self.assertFalse(safe_romero_botto_restoration(baseline, altered))


if __name__ == "__main__":
    unittest.main()
