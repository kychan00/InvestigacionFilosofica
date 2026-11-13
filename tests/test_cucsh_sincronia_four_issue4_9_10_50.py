"""No-loss tests for four signed original Sincronía works and review roles."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_four_issue4_9_10_50 import (
    SOURCES, restore_four,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": s["issue"], "year": s["year"],
            "title": s["title"], "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": s["url"]},
            "legacyAccessStatus": {"status": s["status"]},
        }
        for rid, s in SOURCES.items()
    ]
    unresolved = [
        {"id": f"unresolved-{i}", "journal": "Sincronía", "authors": []}
        for i in range(16)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously documented"}]}
        for i in range(1434)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Different journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *unresolved, *known, *other]}


class FourSignedRolesTests(unittest.TestCase):
    def test_only_four_approved_author_evidence_pairs_change(self):
        data = fixture()
        baseline = copy.deepcopy(data)
        updated, changed = restore_four(data)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 4)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(baseline["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            src = SOURCES[old["id"]]
            self.assertEqual(
                {key for key in set(old)|set(new)
                 if old.get(key)!=new.get(key)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": n, "sourceName": n} for n in src["authors"]
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceUrl"], src["snapshot"])
            self.assertEqual(ev["sourceArticleUrl"], src["url"])
            self.assertEqual(ev["sourceArticleTitle"], src["sourceArticleTitle"])
            self.assertEqual(ev["sourcePrintedByline"], src["printedByline"])
            self.assertEqual(ev["matchedIndexedIssue"], src["issue"])
            self.assertEqual(ev["matchedIndexedYear"], src["year"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            self.assertTrue(ev["titleIdentityCaveat"])
            for field in ("journal","title","issueNumber","year","urls",
                          "legacyOriginal","legacyAccessStatus"):
                self.assertEqual(old[field], new[field])

    def test_rejects_any_frozen_identity_drift_or_preexisting_author(self):
        for rid in SOURCES:
            for field, incorrect in (
                ("title", "Other title"),
                ("year", 2026),
                ("issueNumber", 100),
                ("legacyOriginal", False),
                ("authors", [{"name": "Already set"}]),
                ("legacyAuthorEvidence", {"source": "other"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[field] = incorrect
                    with self.assertRaises(ValueError):
                        restore_four(data)
            for field, incorrect in (
                ("urls", {"canonical": "https://fake.invalid"}),
                ("legacyAccessStatus", {"status": "live"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[field] = incorrect
                    with self.assertRaises(ValueError):
                        restore_four(data)

    def test_frozen_corpus_and_unique_ids(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"].append({"id": "extra", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_four(data)

    def test_review_credits_reviewer_not_compiler(self):
        by_url = {s["url"].rsplit("/", 1)[-1]: s for s in SOURCES.values()}
        k = by_url["korstanjespring09.htm"]
        self.assertEqual(k["authors"], ["Maximiliano E. Korstanje"])
        self.assertIn("Reseñado por", k["printedByline"])
        self.assertEqual(k["evidence"]["sourceWorkType"], "signed-book-review")
        self.assertEqual(k["evidence"]["reviewedBookCompilerNotReviewer"], "Jorge Saurí")
        self.assertNotIn("Jorge Saurí", k["authors"])
        self.assertEqual(k["year"], 2009)
        self.assertEqual(k["evidence"]["reviewedBookCitationYear"], 1986)
        self.assertEqual(k["status"], "original-page-archived-only")

    def test_original_title_and_year_caveats(self):
        by_url = {s["url"].rsplit("/", 1)[-1]: s for s in SOURCES.values()}
        book = by_url["anuies.htm"]
        self.assertEqual(book["authors"], ["Bernardo Méndez Lugo"])
        self.assertEqual(book["evidence"]["sourceWorkType"],
                         "signed-commentary-on-a-published-book")
        market = by_url["mercado.htm"]
        self.assertEqual(market["authors"], ["Álvaro Ortega Santos"])
        self.assertEqual(market["year"], 1999)
        cast = by_url["castaned.htm"]
        self.assertEqual(cast["printedByline"], "by Jorge G. Castañeda")
        self.assertEqual(cast["year"], 1997)
        self.assertIn("December 1997", cast["evidence"]["sourceHistoricalEvent"])


if __name__ == "__main__":
    unittest.main()
