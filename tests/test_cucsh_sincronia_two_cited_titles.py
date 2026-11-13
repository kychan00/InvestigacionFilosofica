import copy
import unittest

from scripts.cucsh.restore_sincronia_two_cited_titles import (
    VERIFIED, restore_two_bibliographic_titles,
)
from scripts.cucsh.validate_update import safe_two_bibliography_titles


def fixture():
    targets = [
        {"id": item["id"], "journal": "Sincronía",
         "issueNumber": item["issue"], "year": item["year"],
         "title": item["prior"], "titleVariants": [item["prior"]],
         "authors": [], "legacyOriginal": True,
         "urls": {"canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia" +
                  item["urlSuffix"]},
         "legacyAccessStatus": {"status": "original-page-archived-only"},
         "legacyTitleEncodingEvidence": {"kind": "preserved-original-source"}}
        for item in VERIFIED
    ]
    remaining = [
        {"id": "unattributed-" + str(n), "journal": "Sincronía",
         "title": "Other historical item " + str(n), "authors": []}
        for n in range(104)
    ]
    known = [
        {"id": "attributed-" + str(n), "journal": "Sincronía",
         "title": "Known article " + str(n),
         "authors": [{"name": "Known Person"}]}
        for n in range(1348)
    ]
    other = [
        {"id": "other-" + str(n), "journal": "Protrepsis",
         "title": "Other item " + str(n),
         "authors": [{"name": "Other Person"}]}
        for n in range(391)
    ]
    return {"records": targets + remaining + known + other}


class TwoBibliographicTitlesTests(unittest.TestCase):
    def test_only_two_verified_records_change(self):
        before = fixture()
        frozen = copy.deepcopy(before)
        patched, changed = restore_two_bibliographic_titles(before)
        self.assertEqual(set(changed), {x["id"] for x in VERIFIED})
        self.assertEqual(len(patched["records"]), 1845)
        fields = {
            "title", "titleVariants", "authors",
            "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
        }
        for idx, item in enumerate(VERIFIED):
            old, new = frozen["records"][idx], patched["records"][idx]
            changed_values = {
                k for k in set(old) | set(new)
                if old.get(k) != new.get(k)
            }
            self.assertEqual(changed_values, fields)
            self.assertEqual(new["title"], item["title"])
            self.assertEqual(
                [person["name"] for person in new["authors"]],
                item["authors"]
            )
            self.assertEqual(new["urls"], old["urls"])
            self.assertEqual(new["legacyAccessStatus"], old["legacyAccessStatus"])
            self.assertTrue(safe_two_bibliography_titles(old, new))
        self.assertEqual(patched["records"][2:], frozen["records"][2:])

    def test_fails_if_original_name_changed(self):
        data = fixture()
        data["records"][0]["title"] = "Different index entry"
        with self.assertRaisesRegex(ValueError, "baseline|mismatch"):
            restore_two_bibliographic_titles(data)

    def test_fails_if_existing_author_would_be_overwritten(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Already attributed"}]
        with self.assertRaises(ValueError):
            restore_two_bibliographic_titles(data)

    def test_validator_refuses_url_or_evidence_tampering(self):
        previous = fixture()
        frozen = copy.deepcopy(previous)
        patched, _ = restore_two_bibliographic_titles(previous)
        old, new = frozen["records"][0], patched["records"][0]
        tampered = copy.deepcopy(new)
        tampered["urls"]["canonical"] = "https://wrong.example/index.html"
        self.assertFalse(safe_two_bibliography_titles(old, tampered))
        tampered = copy.deepcopy(new)
        tampered["legacyIndexMislabelEvidence"]["sourceUrl"] = "https://fake.example"
        self.assertFalse(safe_two_bibliography_titles(old, tampered))


if __name__ == "__main__":
    unittest.main()
