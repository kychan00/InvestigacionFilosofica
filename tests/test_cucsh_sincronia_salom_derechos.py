import copy
import unittest

from scripts.cucsh.restore_sincronia_salom_derechos import (
    ID, OLD, TITLE, AUTHOR, BIBLIOGRAPHY_SOURCE, FULL_TEXT_SOURCE,
    restore_salom_derechos,
)
from scripts.cucsh.validate_update import safe_salom_derechos_restoration


def fixture():
    target = {
        "id": ID, "journal": "Sincronía",
        "issueNumber": 16, "year": 2000,
        "title": OLD, "titleVariants": [OLD],
        "authors": [], "legacyOriginal": True,
        "urls": {
            "canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/derechos.htm"
        },
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía",
         "title": f"Unknown {i}", "authors": []}
        for i in range(81)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Known {i}",
         "authors": [{"name": "Known Author"}]}
        for i in range(1372)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target] + pending + known + other}


class SalomDerechosTests(unittest.TestCase):
    def test_only_one_triangulated_record_changes(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, changed = restore_salom_derechos(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(out["records"]), 1845)
        before, after = frozen["records"][0], out["records"][0]
        allowed = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        self.assertEqual({
            k for k in set(before) | set(after)
            if before.get(k) != after.get(k)
        }, allowed)
        self.assertEqual(after["title"], TITLE)
        self.assertEqual(after["titleVariants"], [TITLE, OLD])
        self.assertEqual(
            after["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}]
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["bibliographySourceUrl"],
            BIBLIOGRAPHY_SOURCE,
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["fullTextRepublicationUrl"],
            FULL_TEXT_SOURCE,
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["urlMatchLevel"],
            "historical-index-only-not-external-exact-url-proof",
        )
        self.assertTrue(safe_salom_derechos_restoration(before, after))
        self.assertEqual(after["urls"], before["urls"])
        self.assertEqual(
            after["legacyAccessStatus"], before["legacyAccessStatus"]
        )
        self.assertEqual(out["records"][1:], frozen["records"][1:])

    def test_identity_drift_fails_closed(self):
        for field, value in (
            ("issueNumber", 15),
            ("title", "Different index label"),
        ):
            data = fixture()
            data["records"][0][field] = value
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                restore_salom_derechos(data)

    def test_existing_author_is_never_overwritten(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Existing"}]
        with self.assertRaises(ValueError):
            restore_salom_derechos(data)

    def test_validator_rejects_url_evidence_author_or_caveat_tampering(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, _ = restore_salom_derechos(data)
        before, after = frozen["records"][0], out["records"][0]
        for mode in ("url", "source", "full_text", "author", "caveat", "status"):
            bad = copy.deepcopy(after)
            if mode == "url":
                bad["urls"]["canonical"] = "https://wrong.invalid/"
            elif mode == "source":
                bad["legacyIndexMislabelEvidence"]["bibliographySourceUrl"] = (
                    "https://wrong.invalid/source"
                )
            elif mode == "full_text":
                bad["legacyAuthorEvidence"]["fullTextRepublicationUrl"] = (
                    "https://wrong.invalid/text"
                )
            elif mode == "author":
                bad["authors"][0]["name"] = "Wrong Person"
            elif mode == "caveat":
                bad["legacyIndexMislabelEvidence"]["urlMatchLevel"] = (
                    "external-exact-url-proof"
                )
            elif mode == "status":
                bad["legacyAccessStatus"] = {"status": "live"}
            self.assertFalse(safe_salom_derechos_restoration(before, bad))


if __name__ == "__main__":
    unittest.main()
