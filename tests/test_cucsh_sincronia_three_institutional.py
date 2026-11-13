"""Fail-closed tests for three institutionally sourced Sincronía bylines."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_three_institutional import (
    SOURCES, restore_three,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": r["issue"], "year": r["year"],
            "title": r["title"], "authors": [], "legacyOriginal": True,
            "urls": {"canonical": r["url"]},
            "legacyAccessStatus": {"status": r["status"]},
        }
        for rid, r in SOURCES.items()
    ]
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(63)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1388)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *pending, *known, *others]}


class ThreeInstitutionalAttributionTests(unittest.TestCase):
    def test_exactly_three_author_and_provenance_changes(self):
        original = fixture()
        baseline = copy.deepcopy(original)
        updated, changed = restore_three(original)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(len(changed), 3)
        for before, after in zip(baseline["records"], updated["records"]):
            if before["id"] not in SOURCES:
                self.assertEqual(after, before)
                continue
            expected = SOURCES[before["id"]]
            self.assertEqual(
                {k for k in set(before) | set(after)
                 if before.get(k) != after.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(after["authors"], [
                {"name": expected["author"], "sourceName": expected["author"]}
            ])
            evidence = after["legacyAuthorEvidence"]
            self.assertEqual(evidence["sourceArticleUrl"], expected["url"])
            self.assertEqual(evidence["matchedIndexedIssue"], expected["issue"])
            self.assertEqual(evidence["matchedIndexedYear"], expected["year"])
            self.assertEqual(
                evidence["urlMatchLevel"], expected["evidence"]["urlMatchLevel"]
            )
            self.assertTrue(evidence["publicationVersionCaveat"])
            for key in ("title", "issueNumber", "year", "urls",
                        "legacyOriginal", "legacyAccessStatus"):
                self.assertEqual(before[key], after[key])

    def test_identity_drift_or_preexisting_authorship_fails_closed(self):
        for rid, expected in SOURCES.items():
            for key, bad in (
                ("title", "Some different text"),
                ("issueNumber", 2),
                ("year", 2025),
                ("legacyOriginal", False),
                ("authors", [{"name": "Already assigned"}]),
                ("legacyAuthorEvidence", {"kind": "existing"}),
            ):
                with self.subTest(id=rid, field=key):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    target[key] = bad
                    with self.assertRaises(ValueError):
                        restore_three(data)
            with self.subTest(id=rid, field="url"):
                data = fixture()
                target = next(r for r in data["records"] if r["id"] == rid)
                target["urls"]["canonical"] = "https://bad.invalid/file"
                with self.assertRaises(ValueError):
                    restore_three(data)
            with self.subTest(id=rid, field="availability"):
                data = fixture()
                target = next(r for r in data["records"] if r["id"] == rid)
                target["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_three(data)

    def test_frozen_corpus_size_and_authorless_queue(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"].append({"id": "new", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_three(data)

    def test_date_and_url_discrepancies_are_explicit(self):
        by_title = {r["title"]: r for r in SOURCES.values()}
        for item in by_title.values():
            self.assertTrue(item["evidence"]["sourceUrl"].startswith("https://"))
            self.assertTrue(item["evidence"]["publicationVersionCaveat"])
        marin = next(r for r in SOURCES.values() if r["author"] == "Álvaro Marín Marín")
        self.assertEqual(marin["evidence"]["supportingCitedYear"], 1998)
        self.assertEqual(marin["year"], 1999)
        self.assertEqual(
            marin["evidence"]["sourceCitedOriginalUrl"], marin["url"]
        )
        reyes = next(r for r in SOURCES.values() if r["author"] == "Giovanni Efraín Reyes Ortiz")
        self.assertEqual(reyes["evidence"]["sourceIndexedPublicationYear"], 2007)
        self.assertEqual(reyes["year"], 1999)
        self.assertEqual(
            reyes["evidence"]["urlMatchLevel"],
            "institutional-same-exact-title-no-original-url-proof",
        )
        montoya = next(r for r in SOURCES.values() if r["author"] == "Víctor Montoya")
        self.assertTrue(montoya["evidence"]["sourceAlternativeCitedUrl"].endswith("/toral.htm"))
        self.assertTrue(montoya["url"].endswith("/montoya2.htm"))


if __name__ == "__main__":
    unittest.main()
