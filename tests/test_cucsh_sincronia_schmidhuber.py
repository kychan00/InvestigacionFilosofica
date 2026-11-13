import copy
import unittest

from scripts.cucsh.restore_sincronia_schmidhuber import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, CITED_VARIANT,
    UV_SOURCE, OHIO_SOURCE, restore_schmidhuber,
)


def fixture():
    target = {
        "id": ID, "journal": "Sincronía", "issueNumber": 1, "year": 1996,
        "title": TITLE, "authors": [], "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-archived-only"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
    }
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(79)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known Author"}]}
        for i in range(1374)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *unresolved, *known, *others]}


class SchmidhuberAttributionTests(unittest.TestCase):
    def test_exact_one_byline_without_metadata_changes(self):
        data = fixture()
        before = copy.deepcopy(data)
        after, changed = restore_schmidhuber(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(after["records"]), 1845)
        old, new = before["records"][0], after["records"][0]
        self.assertEqual(
            {key for key in set(old) | set(new)
             if old.get(key) != new.get(key)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(new["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        evidence = new["legacyAuthorEvidence"]
        self.assertEqual(evidence["sourceUrl"], UV_SOURCE)
        self.assertEqual(evidence["supportingSourceUrl"], OHIO_SOURCE)
        self.assertEqual(evidence["citedHistoricalUrlVariant"], CITED_VARIANT)
        self.assertEqual(
            evidence["urlMatchLevel"],
            "different-extension-unverified-equivalence",
        )
        self.assertEqual(new["urls"], old["urls"])
        self.assertEqual(new["legacyAccessStatus"], old["legacyAccessStatus"])
        self.assertEqual(after["records"][1:], before["records"][1:])

    def test_fails_closed_when_identity_changes(self):
        for key, value in (
            ("title", "Incorrect title"),
            ("issueNumber", 2),
            ("year", 1997),
            ("legacyOriginal", False),
        ):
            with self.subTest(key=key):
                data = fixture()
                data["records"][0][key] = value
                with self.assertRaises(ValueError):
                    restore_schmidhuber(data)

    def test_never_overwrite_authors_or_evidence(self):
        for key, value in (
            ("authors", [{"name": "Existing Author"}]),
            ("legacyAuthorEvidence", {"verifiedAuthor": "Other"}),
        ):
            with self.subTest(key=key):
                data = fixture()
                data["records"][0][key] = value
                with self.assertRaises(ValueError):
                    restore_schmidhuber(data)

    def test_rejects_wrong_url_or_claimed_live_access(self):
        data = fixture()
        data["records"][0]["urls"]["canonical"] = CITED_VARIANT
        with self.assertRaises(ValueError):
            restore_schmidhuber(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_schmidhuber(data)


if __name__ == "__main__":
    unittest.main()
