import copy
import unittest

from scripts.cucsh.restore_sincronia_vogt import (
    ID, TITLE, AUTHOR, URL, SOURCE, restore_vogt,
)


def fixture():
    row = {
        "id": ID, "journal": "Sincronía", "issueNumber": 1,
        "year": 1996, "title": TITLE, "authors": [],
        "legacyOriginal": True,
        "urls": {"canonical": URL},
        "legacyAccessStatus": {"status": "original-page-archived-only"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(80)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1373)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [row, *pending, *known, *other]}


class VogtRestorationTests(unittest.TestCase):
    def test_exact_one_author_only(self):
        dataset = fixture()
        baseline = copy.deepcopy(dataset)
        result, changed = restore_vogt(dataset)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(result["records"]), 1845)
        before, after = baseline["records"][0], result["records"][0]
        self.assertEqual(after["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        self.assertEqual(
            after["legacyAuthorEvidence"]["sourceUrl"], SOURCE
        )
        self.assertEqual(
            after["legacyAuthorEvidence"]["sourcePage"], 152
        )
        self.assertEqual(
            {key for key in set(before) | set(after)
             if before.get(key) != after.get(key)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(result["records"][1:], baseline["records"][1:])

    def test_fails_closed_on_identity_drift(self):
        for key, value in (
            ("title", "Wrong title"), ("issueNumber", 2),
            ("year", 1997), ("legacyOriginal", False),
        ):
            with self.subTest(key=key):
                dataset = fixture()
                dataset["records"][0][key] = value
                with self.assertRaises(ValueError):
                    restore_vogt(dataset)

    def test_refuses_existing_author_and_modified_access(self):
        dataset = fixture()
        dataset["records"][0]["authors"] = [{"name": "Someone"}]
        with self.assertRaises(ValueError):
            restore_vogt(dataset)
        dataset = fixture()
        dataset["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_vogt(dataset)

    def test_refuses_wrong_exact_url(self):
        dataset = fixture()
        dataset["records"][0]["urls"]["canonical"] = "https://example.invalid/vogt.htm"
        with self.assertRaises(ValueError):
            restore_vogt(dataset)


if __name__ == "__main__":
    unittest.main()
