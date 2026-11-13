"""Fail-closed tests for a signed article behind a broken FrontPage index URL."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_schmidhuber_historical import (
    WORK_ID, ORIGINAL_TITLE, ORIGINAL_URL, ORIGINAL_STATUS,
    AUTHOR, RECOVERED_TITLE, PRIMARY_SNAPSHOT, PRIMARY_HISTORIC_URL,
    restore_one,
)


def fixture():
    target = {
        "id": WORK_ID, "journal": "Sincronía", "issueNumber": 1,
        "year": 1996, "title": ORIGINAL_TITLE, "authors": [],
        "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": ORIGINAL_STATUS},
    }
    unresolved = [
        {"id": f"missing-{i}", "journal": "Sincronía", "authors": []}
        for i in range(12)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1441)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [target, *unresolved, *known, *other]}


class HistoricalSchmidhuberTests(unittest.TestCase):
    def test_one_explicit_author_and_evidence_change_only(self):
        data = fixture()
        old = copy.deepcopy(data)
        new, changed = restore_one(data)
        self.assertEqual(changed, [WORK_ID])
        self.assertEqual(len(new["records"]), 1845)
        self.assertEqual(
            {k for k in set(old["records"][0]) | set(new["records"][0])
             if old["records"][0].get(k) != new["records"][0].get(k)},
            {"authors", "legacyAuthorEvidence"},
        )
        for previous, current in zip(old["records"][1:], new["records"][1:]):
            self.assertEqual(previous, current)
        item = new["records"][0]
        self.assertEqual(item["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        evidence = item["legacyAuthorEvidence"]
        self.assertEqual(evidence["sourceArticleTitle"], RECOVERED_TITLE)
        self.assertEqual(evidence["sourceUrl"], PRIMARY_SNAPSHOT)
        self.assertEqual(evidence["sourceArchivedHistoricalUrl"], PRIMARY_HISTORIC_URL)
        self.assertEqual(evidence["sourceArticleUrl"], ORIGINAL_URL)
        self.assertEqual(evidence["sourceIndependentCitationVenueDate"],
                         "Sincronía (Invierno 1996): 1–7")
        self.assertEqual(evidence["matchedIndexedIssue"], 1)
        self.assertEqual(evidence["matchedIndexedYear"], 1996)
        self.assertTrue(evidence["originalAvailabilityPreserved"])
        self.assertTrue(evidence["sourceExactOriginalUrlWasNotCaptured"])
        self.assertTrue(evidence["titleAndUrlIdentityCaveat"])
        self.assertNotIn("exact-original-url", evidence["urlMatchLevel"])
        for key in ("journal", "issueNumber", "year", "title", "urls",
                    "legacyOriginal", "legacyAccessStatus"):
            self.assertEqual(old["records"][0][key], item[key])

    def test_broken_original_title_and_path_are_not_rewritten(self):
        item = fixture()["records"][0]
        self.assertEqual(item["title"], ",")
        self.assertIn("FrontPage%20Webs/Content/schmid.html",
                      item["urls"]["canonical"])
        self.assertNotEqual(PRIMARY_HISTORIC_URL, ORIGINAL_URL)
        self.assertIn("/CUCSH/Sincronia/schmid.html", PRIMARY_HISTORIC_URL)
        self.assertEqual(ORIGINAL_STATUS, "original-page-unavailable")

    def test_refuse_any_frozen_original_identity_difference(self):
        for key, bad in (
            ("title", RECOVERED_TITLE),
            ("issueNumber", 2),
            ("year", 1998),
            ("legacyOriginal", False),
            ("authors", [{"name": "Preexisting"}]),
            ("legacyAuthorEvidence", {"sourceUrl": "preexisting"}),
        ):
            with self.subTest(key=key):
                d = fixture()
                d["records"][0][key] = bad
                with self.assertRaises(ValueError):
                    restore_one(d)
        for key, bad in (
            ("urls", {"canonical": PRIMARY_HISTORIC_URL}),
            ("legacyAccessStatus", {"status": "original-page-archived-only"}),
        ):
            with self.subTest(key=key):
                d = fixture()
                d["records"][0][key] = bad
                with self.assertRaises(ValueError):
                    restore_one(d)

    def test_refuse_queue_drift_missing_or_duplicate_id(self):
        d = fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_one(d)
        d = fixture()
        d["records"].append({"id": "extra", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_one(d)
        d = fixture()
        d["records"][1]["id"] = WORK_ID
        with self.assertRaises(ValueError):
            restore_one(d)


if __name__ == "__main__":
    unittest.main()
