import copy
import unittest

from scripts.cucsh.restore_sincronia_ransom import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, ENCYCLOPEDIA_SOURCE,
    SIGNED_TEXT_SOURCE, restore_ransom,
)


def fixture():
    target = {
        "id": ID,
        "journal": "Sincronía", "issueNumber": 6, "year": 1998,
        "title": TITLE, "authors": [], "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-archived-only"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(75)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1378)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *pending, *known, *others]}


class RansomRestorationTests(unittest.TestCase):
    def test_only_one_verified_author_and_provenance_added(self):
        data = fixture()
        before = copy.deepcopy(data)
        updated, changed = restore_ransom(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(updated["records"]), 1845)
        old, new = before["records"][0], updated["records"][0]
        self.assertEqual(
            {k for k in set(old) | set(new) if old.get(k) != new.get(k)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(new["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        evidence = new["legacyAuthorEvidence"]
        self.assertEqual(evidence["sourceUrl"], ENCYCLOPEDIA_SOURCE)
        self.assertEqual(evidence["supportingSourceUrl"], SIGNED_TEXT_SOURCE)
        self.assertEqual(evidence["sourceArticleUrl"], ORIGINAL_URL)
        self.assertEqual(
            evidence["urlMatchLevel"], "independent-exact-original-url-citation",
        )
        self.assertEqual(
            evidence["originalUrlAccessedBySource"], "2005-05-21"
        )
        self.assertEqual(updated["records"][1:], before["records"][1:])
        self.assertEqual(new["urls"], old["urls"])
        self.assertEqual(new["legacyAccessStatus"], old["legacyAccessStatus"])
        self.assertEqual(new["title"], old["title"])

    def test_identity_changes_and_existing_byline_refused(self):
        for field, bad in (
            ("title", "Unrelated work"),
            ("issueNumber", 5),
            ("year", 1999),
            ("legacyOriginal", False),
            ("authors", [{"name": "Existing writer"}]),
            ("legacyAuthorEvidence", {"kind": "prior evidence"}),
        ):
            with self.subTest(field=field):
                data = fixture()
                data["records"][0][field] = bad
                with self.assertRaises(ValueError):
                    restore_ransom(data)

    def test_original_url_and_availability_must_match(self):
        data = fixture()
        data["records"][0]["urls"]["canonical"] = "https://example.invalid/ransom.htm"
        with self.assertRaises(ValueError):
            restore_ransom(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_ransom(data)

    def test_frozen_corpus_size_and_pending_queue_enforced(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_ransom(data)
        data = fixture()
        data["records"].append({"id": "extraneous", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_ransom(data)


if __name__ == "__main__":
    unittest.main()
