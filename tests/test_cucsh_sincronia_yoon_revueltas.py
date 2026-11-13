"""Fail-closed regression for the exact-URL Sincronía Revueltas attribution."""
import copy
import unittest
from scripts.cucsh.restore_sincronia_yoon_revueltas import (
    RID, URL, AUTHOR, EVIDENCE, restore,
)

def fixture():
    target = {
        "id": RID, "journal": "Sincronía", "title": "Yoon Bong Seo",
        "issueNumber": 16, "year": 2000, "authors": [],
        "urls": {"canonical": URL}, "legacyOriginal": True,
        "legacyAccessStatus": {"status": "original-page-unavailable"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(51)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Already verified"}]}
        for i in range(1402)
    ]
    other = [{"id": f"other-{i}", "journal": "Protrepsis"} for i in range(391)]
    return {"records": [target, *pending, *known, *other]}

class ExactUrlYoonTests(unittest.TestCase):
    def test_exact_change_only(self):
        d = fixture()
        before = copy.deepcopy(d)
        restore(d)
        self.assertEqual(len(d["records"]), 1845)
        self.assertEqual(d["records"][1:], before["records"][1:])
        old, new = before["records"][0], d["records"][0]
        self.assertEqual(
            {k for k in set(old)|set(new) if old.get(k) != new.get(k)},
            {"authors", "legacyAuthorEvidence"})
        self.assertEqual(new["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}])
        self.assertEqual(new["legacyAuthorEvidence"]["sourceHistoricalUrl"], URL)
        self.assertEqual(new["legacyAuthorEvidence"]["sourcePage"], 79)
        self.assertEqual(new["legacyAuthorEvidence"]["sourceBibliographicTitle"],
                         EVIDENCE["sourceBibliographicTitle"])
        for k in ("title","issueNumber","year","urls","legacyAccessStatus"):
            self.assertEqual(new[k],old[k])

    def test_fail_closed(self):
        for field,bad in (
            ("title","Unknown"),("issueNumber",18),("year",2001),
            ("authors",[{"name":"Already known"}]),
            ("legacyOriginal",False),
            ("legacyAuthorEvidence",{"previous":"yes"}),
        ):
            with self.subTest(field=field):
                d=fixture()
                d["records"][0][field]=bad
                with self.assertRaises(ValueError):
                    restore(d)
        for field,bad in (
            ("canonical","http://example.invalid/"),
        ):
            d=fixture()
            d["records"][0]["urls"][field]=bad
            with self.assertRaises(ValueError):
                restore(d)
        d=fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore(d)

if __name__=="__main__":
    unittest.main()
