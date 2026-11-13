import copy
import unittest

from scripts.cucsh.restore_sincronia_feal import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, AUTHOR_CV, UERJ_SOURCE,
    UERJ_CITED_URL, restore_feal,
)


def fixture():
    target = {
        "id": ID, "journal": "Sincronía", "issueNumber": 5,
        "year": 1998, "title": TITLE, "authors": [],
        "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-archived-only"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(73)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Already known"}]}
        for i in range(1380)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *pending, *known, *others]}


class FealRestorationTests(unittest.TestCase):
    def test_exact_one_byline_and_evidence_only(self):
        data = fixture()
        before = copy.deepcopy(data)
        after, changed = restore_feal(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(after["records"]), 1845)
        old, new = before["records"][0], after["records"][0]
        self.assertEqual(
            {k for k in set(old) | set(new)
             if old.get(k) != new.get(k)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(new["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        ev = new["legacyAuthorEvidence"]
        self.assertEqual(ev["sourceUrl"], AUTHOR_CV)
        self.assertEqual(ev["supportingSourceUrl"], UERJ_SOURCE)
        self.assertEqual(
            ev["supportingCitedOriginalUrlVariant"], UERJ_CITED_URL
        )
        self.assertEqual(ev["sourceArticleUrl"], ORIGINAL_URL)
        self.assertEqual(ev["sourceCitedPublicationYear"], 1996)
        self.assertEqual(ev["indexedYearPreserved"], 1998)
        self.assertEqual(
            ev["chronologyConflict"],
            "external-sources-cite-1996-legacy-index-1998",
        )
        self.assertEqual(
            ev["urlMatchLevel"], "matching-filename-different-historical-host"
        )
        self.assertEqual(after["records"][1:], before["records"][1:])
        for field in ("title", "year", "issueNumber", "urls", "legacyAccessStatus"):
            self.assertEqual(new[field], old[field])

    def test_refuses_identity_drift_and_prior_authors(self):
        for field, incorrect in (
            ("title", "Different work"),
            ("issueNumber", 6),
            ("year", 1996),
            ("legacyOriginal", False),
            ("authors", [{"name": "Existing"}]),
            ("legacyAuthorEvidence", {"kind": "prior"}),
        ):
            with self.subTest(field=field):
                data = fixture()
                data["records"][0][field] = incorrect
                with self.assertRaises(ValueError):
                    restore_feal(data)

    def test_historical_url_and_availability_are_immutable(self):
        data = fixture()
        data["records"][0]["urls"]["canonical"] = UERJ_CITED_URL
        with self.assertRaises(ValueError):
            restore_feal(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_feal(data)

    def test_frozen_size_and_pending_count(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_feal(data)
        data = fixture()
        data["records"].append({"id": "unexpected", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_feal(data)


if __name__ == "__main__":
    unittest.main()
