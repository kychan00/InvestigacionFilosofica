import copy
import unittest

from scripts.cucsh.restore_sincronia_issue50_existing_author_titles import (
    VERIFIED, repair_issue50_titles,
)
from scripts.cucsh.validate_update import (
    safe_issue50_dialnet_two_existing_author_titles,
)


def fixture():
    targets = [
        {
            "id": work["id"], "journal": "Sincronía",
            "issueNumber": 50, "year": 2009,
            "title": work["oldTitle"],
            "titleVariants": [work["oldTitle"], "Historical search synonym"],
            "authors": [
                {"name": name, "sourceName": name}
                for name in work["authors"]
            ],
            "legacyOriginal": True,
            "urls": {"canonical": "http://sincronia.cucsh.udg.mx" +
                     work["urlSuffix"]},
            "legacyAccessStatus": {"status": "original-page-archived-only"},
            "legacyTitleEncodingEvidence": {"status": "verified-legacy-encoding"},
            "legacyAuthorEvidence": {"sourceUrl": "https://old-evidence.example"},
        }
        for work in VERIFIED
    ]
    pending = [
        {"id": "pending-" + str(i), "journal": "Sincronía",
         "authors": [], "title": "Unattributed work " + str(i)}
        for i in range(91)
    ]
    known = [
        {"id": "known-" + str(i), "journal": "Sincronía",
         "authors": [{"name": "Known Author"}],
         "title": "Existing work " + str(i)}
        for i in range(1361)
    ]
    other = [
        {"id": "other-" + str(i), "journal": "Protrepsis",
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": targets + pending + known + other}


class TwoIssue50TitleTests(unittest.TestCase):
    def test_two_verified_titles_restore_without_author_mutation(self):
        dataset = fixture()
        snapshot = copy.deepcopy(dataset)
        result, changed = repair_issue50_titles(dataset)
        self.assertEqual(set(changed), {x["id"] for x in VERIFIED})
        self.assertEqual(len(result["records"]), 1845)
        expected_changes = {
            "title", "titleVariants", "legacyIndexMislabelEvidence",
        }
        for i, info in enumerate(VERIFIED):
            original = snapshot["records"][i]
            actual = result["records"][i]
            different = {
                k for k in set(original) | set(actual)
                if original.get(k) != actual.get(k)
            }
            self.assertEqual(different, expected_changes)
            self.assertEqual(actual["title"], info["newTitle"])
            self.assertEqual(
                actual["titleVariants"],
                [info["newTitle"], info["oldTitle"], "Historical search synonym"],
            )
            for key in set(original) | set(actual):
                if key not in expected_changes:
                    self.assertEqual(original.get(key), actual.get(key), key)
            self.assertTrue(
                safe_issue50_dialnet_two_existing_author_titles(
                    original, actual
                )
            )
        self.assertEqual(result["records"][2:], snapshot["records"][2:])

    def test_rejects_changed_original_indexed_authors(self):
        corpus = fixture()
        corpus["records"][0]["authors"][0]["name"] = "Unrelated Person"
        with self.assertRaisesRegex(ValueError, "identity mismatch"):
            repair_issue50_titles(corpus)

    def test_rejects_legacy_url_drift(self):
        corpus = fixture()
        corpus["records"][1]["urls"]["canonical"] = (
            "https://example.invalid/not-the-original"
        )
        with self.assertRaisesRegex(ValueError, "identity mismatch"):
            repair_issue50_titles(corpus)

    def test_validator_rejects_author_evidence_or_url_mutations(self):
        corpus = fixture()
        before = copy.deepcopy(corpus)
        after, _ = repair_issue50_titles(corpus)
        old, new = before["records"][0], after["records"][0]
        tampered = copy.deepcopy(new)
        tampered["authors"].pop()
        self.assertFalse(
            safe_issue50_dialnet_two_existing_author_titles(old, tampered)
        )
        tampered = copy.deepcopy(new)
        tampered["legacyAuthorEvidence"]["sourceUrl"] = "https://bad.invalid"
        self.assertFalse(
            safe_issue50_dialnet_two_existing_author_titles(old, tampered)
        )
        tampered = copy.deepcopy(new)
        tampered["urls"]["canonical"] = "https://bad.invalid"
        self.assertFalse(
            safe_issue50_dialnet_two_existing_author_titles(old, tampered)
        )
        tampered = copy.deepcopy(new)
        tampered["legacyIndexMislabelEvidence"]["sourceUrl"] = "https://bad.invalid"
        self.assertFalse(
            safe_issue50_dialnet_two_existing_author_titles(old, tampered)
        )

    def test_rejects_preexisting_title_evidence(self):
        corpus = fixture()
        corpus["records"][0]["legacyIndexMislabelEvidence"] = {
            "sourceUrl": "https://previous.example"
        }
        with self.assertRaises(ValueError):
            repair_issue50_titles(corpus)


if __name__ == "__main__":
    unittest.main()
