import copy
import unittest

from scripts.cucsh.recover_sincronia_two_2000_cited_titles import (
    VERIFIED, recover_two_cited_2000_titles,
)
from scripts.cucsh.validate_update import safe_two_2000_exact_url_recoveries


def fixture():
    targets = [
        {
            "id": item["id"], "journal": "Sincronía",
            "issueNumber": 15, "year": 2000,
            "title": item["oldTitle"],
            "titleVariants": [item["oldTitle"], "Original indexed alias"],
            "authors": [], "legacyOriginal": True,
            "urls": {"canonical": (
                "http://sincronia.cucsh.udg.mx" + item["originalSuffix"]
            )},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyTitleEncodingEvidence": {"kind": "preserve-legacy-encoding"},
        }
        for item in VERIFIED
    ]
    pending = [
        {"id": f"pending-{n}", "journal": "Sincronía",
         "title": f"Unknown {n}", "authors": []}
        for n in range(89)
    ]
    known = [
        {"id": f"known-{n}", "journal": "Sincronía",
         "title": f"Verified article {n}",
         "authors": [{"name": "Previously documented author"}]}
        for n in range(1363)
    ]
    others = [
        {"id": f"other-{n}", "journal": "Protrepsis",
         "authors": [{"name": "Other author"}]}
        for n in range(391)
    ]
    return {"records": targets + pending + known + others}


class Two2000SourceVerifiedTests(unittest.TestCase):
    def test_restores_exact_two_titles_and_allows_no_other_changes(self):
        dataset = fixture()
        original = copy.deepcopy(dataset)
        updated, changed = recover_two_cited_2000_titles(dataset)
        self.assertEqual(set(changed), {e["id"] for e in VERIFIED})
        self.assertEqual(len(updated["records"]), 1845)
        allowed = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        for i, item in enumerate(VERIFIED):
            previous = original["records"][i]
            current = updated["records"][i]
            actual = {
                key for key in set(previous) | set(current)
                if previous.get(key) != current.get(key)
            }
            self.assertEqual(actual, allowed)
            self.assertEqual(current["title"], item["title"])
            self.assertEqual(
                current["titleVariants"],
                [item["title"], item["oldTitle"], "Original indexed alias"],
            )
            self.assertEqual(
                [author["name"] for author in current["authors"]],
                item["authors"],
            )
            self.assertTrue(safe_two_2000_exact_url_recoveries(previous, current))
            self.assertEqual(current["urls"], previous["urls"])
            self.assertEqual(
                current["legacyAccessStatus"], previous["legacyAccessStatus"]
            )
            self.assertEqual(
                current["legacyTitleEncodingEvidence"],
                previous["legacyTitleEncodingEvidence"],
            )
        self.assertEqual(updated["records"][2:], original["records"][2:])

    def test_fails_if_frozen_legacy_title_drifted(self):
        dataset = fixture()
        dataset["records"][0]["title"] = "Unrelated text"
        with self.assertRaisesRegex(ValueError, "identity drift"):
            recover_two_cited_2000_titles(dataset)

    def test_fails_if_existing_author_would_be_overwritten(self):
        dataset = fixture()
        dataset["records"][1]["authors"] = [{"name": "Previously Verified"}]
        with self.assertRaises(ValueError):
            recover_two_cited_2000_titles(dataset)

    def test_no_loss_guard_rejects_url_author_and_evidence_mutation(self):
        dataset = fixture()
        original = copy.deepcopy(dataset)
        patched, _ = recover_two_cited_2000_titles(dataset)
        old, new = original["records"][0], patched["records"][0]
        for alteration in ("author", "original_url", "source", "aliases"):
            copy = copy_module(new)
            if alteration == "author":
                copy["authors"][0]["name"] = "Other person"
            if alteration == "original_url":
                copy["urls"]["canonical"] = "https://not-original.example/"
            if alteration == "source":
                copy["legacyIndexMislabelEvidence"]["sourceUrl"] = (
                    "https://not-a-real-citation.example/"
                )
            if alteration == "aliases":
                copy["titleVariants"].remove(VERIFIED[0]["oldTitle"])
            self.assertFalse(safe_two_2000_exact_url_recoveries(old, copy))

    def test_preserves_old_label_when_variants_are_empty(self):
        dataset = fixture()
        for target in dataset["records"][:2]:
            target["titleVariants"] = []
        frozen = copy.deepcopy(dataset)
        updated, _ = recover_two_cited_2000_titles(dataset)
        for i, info in enumerate(VERIFIED):
            self.assertEqual(
                updated["records"][i]["titleVariants"],
                [info["title"], info["oldTitle"]],
            )
            self.assertTrue(
                safe_two_2000_exact_url_recoveries(
                    frozen["records"][i], updated["records"][i]
                )
            )


def copy_module(row):
    return copy.deepcopy(row)


if __name__ == "__main__":
    unittest.main()
