import copy
import unittest

from scripts.cucsh.restore_sincronia_olivella import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, SOURCE, restore_olivella,
)


def fixture():
    target = {
        "id": ID, "journal": "Sincronía", "issueNumber": 2, "year": 1997,
        "title": TITLE, "authors": [], "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-unavailable"},
    }
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(78)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1375)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *unresolved, *known, *others]}


class OlivellaRestorationTests(unittest.TestCase):
    def test_only_single_author_and_evidence_added(self):
        data = fixture()
        before = copy.deepcopy(data)
        updated, changed = restore_olivella(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(updated["records"]), 1845)
        old, new = before["records"][0], updated["records"][0]
        self.assertEqual(
            {k for k in set(old) | set(new) if old.get(k) != new.get(k)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(
            new["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}]
        )
        self.assertEqual(new["legacyAuthorEvidence"]["sourceUrl"], SOURCE)
        self.assertEqual(
            new["legacyAuthorEvidence"]["urlMatchLevel"],
            "journal-original-url-from-legacy-index-only",
        )
        self.assertEqual(new["urls"], old["urls"])
        self.assertEqual(new["legacyAccessStatus"], old["legacyAccessStatus"])
        self.assertEqual(updated["records"][1:], before["records"][1:])

    def test_fail_closed_on_identity_or_status_drift(self):
        for key, value in (
            ("title", "Different work"), ("issueNumber", 3),
            ("year", 1998), ("legacyOriginal", False),
            ("authors", [{"name": "Already attributed"}]),
            ("legacyAuthorEvidence", {"kind": "existing"}),
        ):
            with self.subTest(key=key):
                data = fixture()
                data["records"][0][key] = value
                with self.assertRaises(ValueError):
                    restore_olivella(data)
        data = fixture()
        data["records"][0]["urls"]["canonical"] = "https://invalid.example/test"
        with self.assertRaises(ValueError):
            restore_olivella(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_olivella(data)


if __name__ == "__main__":
    unittest.main()
