import copy
import unittest

from scripts.cucsh.restore_sincronia_early_titles_batch_two import (
    VERIFIED, apply_verified_early_titles,
)
from scripts.cucsh.validate_update import safe_four_verified_early_titles_batch_two


def fixture():
    candidates = [
        {
            "id": item["id"], "journal": "Sincronía",
            "issueNumber": item["issue"], "year": item["year"],
            "title": item["prior"], "titleVariants": [item["prior"]],
            "authors": [], "legacyOriginal": True,
            "urls": {"canonical": "https://legacy.example" + item["urlSuffix"]},
            "legacyAccessStatus": {"status": "original-page-archived-only"},
            "legacyTitleEncodingEvidence": {"kind": "preserved-source-encoding"}
        }
        for item in VERIFIED
    ]
    remaining = [
        {"id": "missing-" + str(i), "journal": "Sincronía",
         "title": "Unverified " + str(i), "authors": []}
        for i in range(106)
    ]
    authored = [
        {"id": "authored-" + str(i), "journal": "Sincronía",
         "title": "Known " + str(i),
         "authors": [{"name": "Author"}]}
        for i in range(1344)
    ]
    unrelated = [
        {"id": "other-" + str(i), "journal": "Protrepsis",
         "title": "Other " + str(i),
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": candidates + remaining + authored + unrelated}


class EarlyTitlesBatchTwoTests(unittest.TestCase):
    def test_exactly_four_records_and_preserve_provenance(self):
        initial = fixture()
        before = copy.deepcopy(initial)
        result, changed = apply_verified_early_titles(initial)
        self.assertEqual(set(changed), {x["id"] for x in VERIFIED})
        self.assertEqual(len(result["records"]), 1845)
        permitted = {
            "title", "titleVariants", "authors",
            "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
        }
        for i, item in enumerate(VERIFIED):
            previous = before["records"][i]
            current = result["records"][i]
            changed_fields = {
                key for key in set(previous) | set(current)
                if previous.get(key) != current.get(key)
            }
            self.assertEqual(changed_fields, permitted)
            self.assertEqual(current["title"], item["title"])
            self.assertEqual(
                [a["name"] for a in current["authors"]], item["authors"]
            )
            self.assertTrue(
                safe_four_verified_early_titles_batch_two(previous, current)
            )
            for field in set(previous) | set(current):
                if field not in permitted:
                    self.assertEqual(
                        previous.get(field), current.get(field), field
                    )
        self.assertEqual(result["records"][4:], before["records"][4:])

    def test_fails_closed_on_title_drift(self):
        data = fixture()
        data["records"][0]["title"] = "Wrong article"
        with self.assertRaisesRegex(ValueError, "identity mismatch"):
            apply_verified_early_titles(data)

    def test_fails_closed_on_existing_author(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Previously confirmed"}]
        with self.assertRaises(ValueError):
            apply_verified_early_titles(data)

    def test_validator_rejects_falsified_evidence_and_changed_url(self):
        original = fixture()
        prior = copy.deepcopy(original)
        current, _ = apply_verified_early_titles(original)
        before = prior["records"][0]
        after = current["records"][0]
        altered = copy.deepcopy(after)
        altered["legacyIndexMislabelEvidence"]["sourceUrl"] = "https://invalid.example"
        self.assertFalse(safe_four_verified_early_titles_batch_two(before, altered))
        altered = copy.deepcopy(after)
        altered["urls"]["canonical"] = "https://invalid.example"
        self.assertFalse(safe_four_verified_early_titles_batch_two(before, altered))


if __name__ == "__main__":
    unittest.main()
