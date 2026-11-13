import copy
import unittest

from scripts.cucsh.restore_sincronia_verified_index_titles import (
    VERIFIED, apply_verified_index_titles
)
from scripts.cucsh.validate_update import safe_five_verified_index_title_reconstruction


def fixture():
    targets = [
        {
            "id": item["id"],
            "journal": "Sincronía",
            "issueNumber": item["issue"],
            "year": item["year"],
            "title": item["prior"],
            "titleVariants": [item["prior"]],
            "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": "https://legacy.example" + item["urlSuffix"]},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyTitleEncodingEvidence": (
                {"kind": "original-issue-index-article-url-and-title"}
                if i == 0 else None
            ),
        }
        for i, item in enumerate(VERIFIED)
    ]
    missing = [
        {"id": f"missing-{i}", "journal": "Sincronía",
         "title": "Article " + str(i), "authors": []}
        for i in range(110)
    ]
    authored = [
        {"id": f"authored-{i}", "journal": "Sincronía",
         "title": "Authored " + str(i),
         "authors": [{"name": "Known Author"}]}
        for i in range(1339)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": targets + missing + authored + other}


class VerifiedHistoricalWorkIdentityTests(unittest.TestCase):
    def test_five_titles_and_authors_only(self):
        original = fixture()
        frozen = copy.deepcopy(original)
        result, changed = apply_verified_index_titles(original)
        self.assertEqual(len(changed), 5)
        self.assertEqual(len(result["records"]), 1845)
        allowed = {
            "title", "titleVariants", "authors",
            "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
        }
        for i, item in enumerate(VERIFIED):
            before = frozen["records"][i]
            after = result["records"][i]
            changed_fields = {
                key for key in set(before) | set(after)
                if before.get(key) != after.get(key)
            }
            self.assertTrue(changed_fields.issubset(allowed))
            self.assertEqual(after["title"], item["title"])
            self.assertEqual(after["authors"][0]["name"], item["authors"][0])
            self.assertTrue(
                safe_five_verified_index_title_reconstruction(before, after)
            )
            self.assertEqual(after["legacyAccessStatus"], before["legacyAccessStatus"])
            self.assertEqual(
                after.get("legacyTitleEncodingEvidence"),
                before.get("legacyTitleEncodingEvidence"),
            )
        self.assertEqual(result["records"][5:], frozen["records"][5:])

    def test_rejects_wrong_baseline(self):
        dataset = fixture()
        dataset["records"][0]["title"] = "Unknown title"
        with self.assertRaisesRegex(ValueError, "identity mismatch"):
            apply_verified_index_titles(dataset)

    def test_rejects_existing_author(self):
        dataset = fixture()
        dataset["records"][0]["authors"] = [{"name": "Invented Author"}]
        with self.assertRaises(ValueError):
            apply_verified_index_titles(dataset)

    def test_frozen_validator_rejects_source_tampering(self):
        before = fixture()
        frozen = copy.deepcopy(before)
        after, _ = apply_verified_index_titles(before)
        original = frozen["records"][0]
        altered = copy.deepcopy(after["records"][0])
        altered["legacyIndexMislabelEvidence"]["sourceUrl"] = "https://fake.example"
        self.assertFalse(safe_five_verified_index_title_reconstruction(original, altered))
        altered = copy.deepcopy(after["records"][0])
        altered["urls"]["canonical"] = "https://wrong.example"
        self.assertFalse(safe_five_verified_index_title_reconstruction(original, altered))


if __name__ == "__main__":
    unittest.main()
