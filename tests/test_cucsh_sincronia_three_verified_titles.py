import copy
import unittest

from scripts.cucsh.restore_sincronia_three_verified_titles import (
    VERIFIED, apply_three_verified_titles,
)
from scripts.cucsh.validate_update import safe_three_verified_early_titles


def fixture():
    targets = [
        {
            "id": item["id"], "journal": "Sincronía",
            "issueNumber": item["issue"], "year": item["year"],
            "title": item["prior"], "titleVariants": [item["prior"]],
            "authors": [], "legacyOriginal": True,
            "urls": {"canonical": "http://legacy.example" + item["suffix"]},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyTitleEncodingEvidence": {
                "kind": "original-index-label-was-transcribed"
            },
        }
        for item in VERIFIED
    ]
    pending = [
        {"id": "missing-" + str(i), "journal": "Sincronía",
         "title": "Unverified " + str(i), "authors": []}
        for i in range(101)
    ]
    known = [
        {"id": "known-" + str(i), "journal": "Sincronía",
         "title": "Verified " + str(i),
         "authors": [{"name": "Original Byline"}]}
        for i in range(1350)
    ]
    other = [
        {"id": "other-" + str(i), "journal": "Protrepsis",
         "title": "Other " + str(i),
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": targets + pending + known + other}


class ThreeVerifiedTitlesTests(unittest.TestCase):
    def test_only_three_pinned_records_change(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        updated, changed = apply_three_verified_titles(data)
        self.assertEqual(set(changed), {e["id"] for e in VERIFIED})
        self.assertEqual(len(updated["records"]), 1845)
        allowed = {
            "title", "titleVariants", "authors", "legacyAuthorEvidence",
            "legacyIndexMislabelEvidence",
        }
        for index, entry in enumerate(VERIFIED):
            old = frozen["records"][index]
            new = updated["records"][index]
            modified = {
                key for key in set(old) | set(new)
                if old.get(key) != new.get(key)
            }
            self.assertEqual(modified, allowed)
            self.assertEqual(new["title"], entry["title"])
            self.assertEqual(
                [author["name"] for author in new["authors"]], entry["authors"]
            )
            self.assertEqual(
                new["legacyIndexMislabelEvidence"]["sourceUrl"],
                entry["sourceUrl"],
            )
            self.assertTrue(safe_three_verified_early_titles(old, new))
            self.assertEqual(old["legacyAccessStatus"], new["legacyAccessStatus"])
            self.assertEqual(old["urls"], new["urls"])
            self.assertEqual(
                old["legacyTitleEncodingEvidence"],
                new["legacyTitleEncodingEvidence"],
            )
        self.assertEqual(updated["records"][3:], frozen["records"][3:])

    def test_fails_closed_if_historical_label_changed(self):
        data = fixture()
        data["records"][0]["title"] = "Another Article"
        with self.assertRaisesRegex(ValueError, "Mismatched historical"):
            apply_three_verified_titles(data)

    def test_refuses_to_overwrite_existing_byline(self):
        data = fixture()
        data["records"][1]["authors"] = [{"name": "Known"}]
        with self.assertRaises(ValueError):
            apply_three_verified_titles(data)

    def test_validator_rejects_source_and_original_url_tampering(self):
        dataset = fixture()
        frozen = copy.deepcopy(dataset)
        patched, _ = apply_three_verified_titles(dataset)
        original, current = frozen["records"][2], patched["records"][2]
        changed = copy.deepcopy(current)
        changed["legacyIndexMislabelEvidence"]["sourceUrl"] = "https://fake.invalid"
        self.assertFalse(safe_three_verified_early_titles(original, changed))
        changed = copy.deepcopy(current)
        changed["urls"]["canonical"] = "https://different.invalid/"
        self.assertFalse(safe_three_verified_early_titles(original, changed))

    def test_multi_author_source_order_must_match(self):
        dataset = fixture()
        frozen = copy.deepcopy(dataset)
        patched, _ = apply_three_verified_titles(dataset)
        original, current = frozen["records"][2], patched["records"][2]
        altered = copy.deepcopy(current)
        altered["authors"].reverse()
        self.assertFalse(safe_three_verified_early_titles(original, altered))


if __name__ == "__main__":
    unittest.main()
