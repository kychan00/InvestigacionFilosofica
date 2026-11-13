"""Fail-closed tests for three original signed Sincronía issue-4 articles."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_three_issue4_primary import (
    SOURCES, restore_three,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": src["issue"], "year": src["year"],
            "title": src["title"], "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": src["url"]},
            "legacyAccessStatus": {"status": src["status"]},
        }
        for rid, src in SOURCES.items()
    ]
    missing = [
        {"id": f"unresolved-{i}", "journal": "Sincronía", "authors": []}
        for i in range(13)
    ]
    previously_attributed = [
        {"id": f"attributed-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known contributor"}]}
        for i in range(1438)
    ]
    other_journals = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal contributor"}]}
        for i in range(391)
    ]
    return {"records": [
        *targets, *missing, *previously_attributed, *other_journals
    ]}


class ThreeSignedOriginalIssueFourTests(unittest.TestCase):
    def test_exactly_three_sourced_author_and_evidence_fields_change(self):
        data = fixture()
        baseline = copy.deepcopy(data)
        updated, changed = restore_three(data)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 3)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(baseline["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            source = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old)|set(new) if old.get(k)!=new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": source["author"], "sourceName": source["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceUrl"], source["snapshot"])
            self.assertEqual(ev["sourceArticleUrl"], source["url"])
            self.assertEqual(ev["sourceArticleTitle"], source["sourceArticleTitle"])
            self.assertEqual(ev["sourcePrintedByline"], source["printedByline"])
            self.assertEqual(ev["matchedIndexedIssue"], source["issue"])
            self.assertEqual(ev["matchedIndexedYear"], source["year"])
            self.assertEqual(ev["verifiedAuthor"], source["author"])
            self.assertTrue(ev["sourceEditionCaveat"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            for frozen in (
                "journal", "issueNumber", "year", "title", "urls",
                "legacyOriginal", "legacyAccessStatus",
            ):
                self.assertEqual(old[frozen], new[frozen])

    def test_rejects_any_original_url_or_historical_metadata_drift(self):
        for rid in SOURCES:
            for key, incorrect in (
                ("title", "Not original indexed title"),
                ("issueNumber", 6), ("year", 2009),
                ("authors", [{"name": "Already attributed"}]),
                ("legacyOriginal", False),
                ("legacyAuthorEvidence", {"sourceUrl": "preexisting"}),
            ):
                with self.subTest(id=rid, key=key):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[key] = incorrect
                    with self.assertRaises(ValueError):
                        restore_three(data)
            for key, incorrect in (
                ("urls", {"canonical": "https://invented.invalid/page"}),
                ("legacyAccessStatus", {"status": "live"}),
            ):
                with self.subTest(id=rid, key=key):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[key] = incorrect
                    with self.assertRaises(ValueError):
                        restore_three(data)

    def test_frozen_corpus_unique_id_and_missing_author_queue(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"].append({"id": "extra", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"][1]["id"] = data["records"][0]["id"]
        with self.assertRaises(ValueError):
            restore_three(data)

    def test_review_author_is_not_book_author_and_1998_date_is_retained(self):
        by_url = {src["url"].rsplit("/", 1)[-1]: src for src in SOURCES.values()}
        review = by_url["mandell.htm"]
        self.assertEqual(review["author"], "Daniel Mandell")
        self.assertEqual(review["printedByline"], "by Daniel Mandell")
        self.assertEqual(review["evidence"]["reviewedBookAuthorNotReviewer"],
                         "Gregory H. Nobles")
        self.assertEqual(review["evidence"]["sourceWorkType"],
                         "signed-book-review")
        self.assertEqual(review["evidence"]["sourceOriginalEmailDate"], "1998-01-09")
        self.assertEqual(review["year"], 1997)
        self.assertNotEqual(review["title"], review["sourceArticleTitle"])

    def test_aguayo_and_zinser_original_spellings_and_issue(self):
        by_url = {src["url"].rsplit("/", 1)[-1]: src for src in SOURCES.values()}
        aguayo = by_url["sergio.htm"]
        self.assertEqual(aguayo["author"], "Sergio Aguayo Quezada")
        self.assertEqual(aguayo["title"], aguayo["sourceArticleTitle"])
        zinser = by_url["zinser.htm"]
        self.assertEqual(zinser["author"], "Adolfo Aguilar Zinser")
        self.assertIn("critica", zinser["title"])
        self.assertIn("crítica", zinser["sourceArticleTitle"])
        for src in SOURCES.values():
            self.assertEqual(src["issue"], 4)
            self.assertEqual(src["year"], 1997)
            self.assertEqual(src["status"], "original-page-unavailable")
            self.assertTrue(src["snapshot"].startswith(
                "https://web.archive.org/web/"
            ))


if __name__ == "__main__":
    unittest.main()
