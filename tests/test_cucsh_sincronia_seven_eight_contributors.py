"""Fail-closed corpus and provenance tests for seven signed original works."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_seven_eight_contributors import (
    SOURCES, restore_seven,
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
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(20)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1427)
    ]
    others = [
        {"id": f"outside-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *unresolved, *known, *others]}


class SevenOriginalEightContributorsTests(unittest.TestCase):
    def test_only_seven_exact_author_evidence_changes(self):
        data = fixture()
        original = copy.deepcopy(data)
        updated, changed = restore_seven(data)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 7)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(sum(len(SOURCES[r]["authors"]) for r in changed), 8)
        for old, new in zip(original["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            src = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old)|set(new) if old.get(k)!=new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(
                new["authors"],
                [{"name": name, "sourceName": name} for name in src["authors"]],
            )
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceUrl"], src["snapshot"])
            self.assertEqual(ev["sourceArticleUrl"], src["url"])
            self.assertEqual(ev["sourceArticleTitle"], src["sourceArticleTitle"])
            self.assertEqual(ev["sourcePrintedByline"], src["printedByline"])
            self.assertEqual(ev["verifiedAuthors"], src["authors"])
            self.assertEqual(ev["matchedIndexedIssue"], src["issue"])
            self.assertEqual(ev["matchedIndexedYear"], src["year"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            self.assertTrue(ev["titleIdentityCaveat"])
            for field in (
                "journal", "title", "issueNumber", "year", "urls",
                "legacyOriginal", "legacyAccessStatus",
            ):
                self.assertEqual(old[field], new[field])

    def test_every_frozen_field_must_match_original(self):
        for rid in SOURCES:
            for key, bad in (
                ("title", "Unrelated article"),
                ("issueNumber", 60),
                ("year", 2026),
                ("legacyOriginal", False),
                ("authors", [{"name": "Already assigned"}]),
                ("legacyAuthorEvidence", {"sourceUrl": "prior"}),
            ):
                with self.subTest(id=rid, key=key):
                    d = fixture()
                    row = next(r for r in d["records"] if r["id"] == rid)
                    row[key] = bad
                    with self.assertRaises(ValueError):
                        restore_seven(d)
            for key, bad in (
                ("urls", {"canonical": "https://invented.invalid/page"}),
                ("legacyAccessStatus", {"status": "live"}),
            ):
                with self.subTest(id=rid, key=key):
                    d = fixture()
                    row = next(r for r in d["records"] if r["id"] == rid)
                    row[key] = bad
                    with self.assertRaises(ValueError):
                        restore_seven(d)

    def test_rejects_corpus_or_authorless_count_drift(self):
        d = fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_seven(d)
        d = fixture()
        d["records"].append({"id": "extra", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_seven(d)
        d = fixture()
        d["records"][0]["id"] = d["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_seven(d)

    def test_two_distinct_contributors_for_powell_and_cook(self):
        by_url = {src["url"].rsplit("/",1)[-1]: src for src in SOURCES.values()}
        duo = by_url["foucchin.htm"]
        self.assertEqual(duo["authors"], ["Jason Powell", "Ian Cook"])
        self.assertEqual(duo["printedByline"], "Jason Powell & Ian Cook")
        self.assertNotEqual(duo["sourcePageTitle"], duo["sourceArticleTitle"])
        self.assertIn("Chinese State", duo["sourceArticleTitle"])

    def test_interviewee_is_not_a_coauthor(self):
        by_url = {src["url"].rsplit("/",1)[-1]: src for src in SOURCES.values()}
        fressia = by_url["fressia.htm"]
        self.assertEqual(fressia["authors"], ["Floriano Martins"])
        self.assertEqual(fressia["evidence"]["sourceIntervieweeNotCoauthor"],
                         "Alfredo Fressia")
        self.assertNotIn("Alfredo Fressia", fressia["authors"])
        self.assertNotEqual(fressia["sourcePageTitle"], fressia["sourceArticleTitle"])
        self.assertEqual(fressia["status"], "original-page-archived-only")

    def test_source_date_and_name_titles_not_overwritten(self):
        by_url = {src["url"].rsplit("/",1)[-1]: src for src in SOURCES.values()}
        self.assertEqual(by_url["banuelos.htm"]["title"], "Bañuelos,Raul")
        self.assertIn("Raúl Bañuelos", by_url["banuelos.htm"]["authors"])
        self.assertEqual(by_url["Nica2.htm"]["year"], 2000)
        self.assertEqual(by_url["Nica2.htm"]["evidence"]["sourceAuthorDate"], "February 2000")
        self.assertEqual(by_url["olgamar.htm"]["sourcePageTitle"], "Lic")
        self.assertIn("Guillermo Schmidhuber", by_url["olgamar.htm"]["sourceArticleTitle"])
        self.assertEqual(by_url["velasco3.htm"]["issue"], 13)


if __name__ == "__main__":
    unittest.main()
