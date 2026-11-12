import copy
import unittest

from scripts.cucsh.restore_sincronia_formanchuk_cruz import (
    ARTICLE_ID, INDEX_TITLE, RESTORED_TITLE, VERIFIED_AUTHOR,
    SOURCE_URL, repair_work_identity
)
from scripts.cucsh.validate_update import safe_formanchuk_cruz_restoration


def fixture():
    target = {
        "id": ARTICLE_ID, "journal": "Sincronía",
        "issueNumber": 15, "year": 2000,
        "title": INDEX_TITLE, "titleVariants": [INDEX_TITLE],
        "authors": [], "legacyOriginal": True,
        "urls": {"canonical": "http://sincronia.cucsh.udg.mx/formanchuk.htm"},
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-index-encoding"},
    }
    missing = [
        {"id": "missing-" + str(n), "journal": "Sincronía",
         "title": "Unknown " + str(n), "authors": []}
        for n in range(99)
    ]
    known = [
        {"id": "known-" + str(n), "journal": "Sincronía",
         "title": "Known " + str(n),
         "authors": [{"name": "Published Author"}]}
        for n in range(1354)
    ]
    unrelated = [
        {"id": "other-" + str(n), "journal": "Protrepsis",
         "title": "Other " + str(n),
         "authors": [{"name": "Other Author"}]}
        for n in range(391)
    ]
    return {"records": [target] + missing + known + unrelated}


class FormanchukSourceTests(unittest.TestCase):
    def test_only_evidence_verified_entry_changed(self):
        sample = fixture()
        old = copy.deepcopy(sample)
        result, ids = repair_work_identity(sample)
        self.assertEqual(ids, [ARTICLE_ID])
        self.assertEqual(len(result["records"]), 1845)
        before, after = old["records"][0], result["records"][0]
        permitted = {
            "title", "titleVariants", "authors",
            "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
        }
        self.assertEqual({
            k for k in set(before) | set(after)
            if before.get(k) != after.get(k)
        }, permitted)
        self.assertEqual(after["title"], RESTORED_TITLE)
        self.assertEqual(
            [a["name"] for a in after["authors"]], [VERIFIED_AUTHOR]
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["sourceUrl"], SOURCE_URL
        )
        self.assertEqual(before["urls"], after["urls"])
        self.assertEqual(
            before["legacyAccessStatus"], after["legacyAccessStatus"]
        )
        self.assertTrue(safe_formanchuk_cruz_restoration(before, after))
        self.assertEqual(old["records"][1:], result["records"][1:])

    def test_rejects_unexpected_index_text(self):
        sample = fixture()
        sample["records"][0]["title"] = "Not Formanchuk"
        with self.assertRaisesRegex(ValueError, "baseline"):
            repair_work_identity(sample)

    def test_rejects_author_overwrite(self):
        sample = fixture()
        sample["records"][0]["authors"] = [{"name": "Known"}]
        with self.assertRaisesRegex(ValueError, "baseline|bylines"):
            repair_work_identity(sample)

    def test_rejects_falsified_original_url_and_source(self):
        sample = fixture()
        old = copy.deepcopy(sample)
        changed, _ = repair_work_identity(sample)
        b, a = old["records"][0], changed["records"][0]
        tampered = copy.deepcopy(a)
        tampered["urls"]["canonical"] = "https://example.invalid/fake"
        self.assertFalse(safe_formanchuk_cruz_restoration(b, tampered))
        tampered = copy.deepcopy(a)
        tampered["legacyIndexMislabelEvidence"]["sourceUrl"] = (
            "https://not-a-source.invalid/"
        )
        self.assertFalse(safe_formanchuk_cruz_restoration(b, tampered))


if __name__ == "__main__":
    unittest.main()
