import copy
import unittest

from scripts.cucsh.restore_sincronia_henson import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, CV_SOURCE, LAW_SOURCE, restore_henson,
)


def fixture():
    target = {
        "id": ID, "journal": "Sincronía", "issueNumber": 11, "year": 1999,
        "title": TITLE, "authors": [], "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-unavailable"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(76)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1377)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *pending, *known, *others]}


class HensonRestorationTests(unittest.TestCase):
    def test_only_one_verified_byline_added(self):
        data = fixture()
        before = copy.deepcopy(data)
        result, changed = restore_henson(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(result["records"]), 1845)
        old, new = before["records"][0], result["records"][0]
        self.assertEqual(
            {k for k in set(old) | set(new) if old.get(k) != new.get(k)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(new["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        ev = new["legacyAuthorEvidence"]
        self.assertEqual(ev["sourceUrl"], CV_SOURCE)
        self.assertEqual(ev["supportingSourceUrl"], LAW_SOURCE)
        self.assertEqual(ev["sourceArticleUrl"], ORIGINAL_URL)
        self.assertEqual(ev["sourcePage"], 2)
        self.assertEqual(ev["supportingFootnote"], 171)
        self.assertEqual(
            ev["urlMatchLevel"], "two-external-exact-original-url-citations",
        )
        self.assertEqual(new["urls"], old["urls"])
        self.assertEqual(
            new["legacyAccessStatus"], old["legacyAccessStatus"]
        )
        self.assertEqual(result["records"][1:], before["records"][1:])

    def test_rejects_identity_drift_existing_author_or_url(self):
        for field, bad in (
            ("title", "Different work"),
            ("issueNumber", 12),
            ("year", 2000),
            ("legacyOriginal", False),
            ("authors", [{"name": "Existing"}]),
            ("legacyAuthorEvidence", {"kind": "prior"}),
        ):
            with self.subTest(field=field):
                data = fixture()
                data["records"][0][field] = bad
                with self.assertRaises(ValueError):
                    restore_henson(data)
        data = fixture()
        data["records"][0]["urls"]["canonical"] = "https://invalid.example/henson.htm"
        with self.assertRaises(ValueError):
            restore_henson(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_henson(data)


if __name__ == "__main__":
    unittest.main()
