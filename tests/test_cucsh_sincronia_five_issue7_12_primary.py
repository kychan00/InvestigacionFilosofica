"""Fail-closed tests for five signed Sincronía original-URL restorations."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_five_issue7_12_primary import (
    SOURCES, restore_five,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": src["issue"], "year": src["year"],
            "title": src["title"], "authors": [], "legacyOriginal": True,
            "urls": {"canonical": src["url"]},
            "legacyAccessStatus": {"status": src["status"]},
        }
        for rid, src in SOURCES.items()
    ]
    missing = [
        {"id": f"missing-{i}", "journal": "Sincronía", "authors": []}
        for i in range(27)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1422)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Known"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *missing, *known, *other]}


class FiveSignedOriginalsTests(unittest.TestCase):
    def test_exact_five_author_and_source_evidence_fields(self):
        data = fixture()
        old = copy.deepcopy(data)
        new, changed = restore_five(data)
        self.assertEqual(len(new["records"]), 1845)
        self.assertEqual(len(changed), 5)
        self.assertEqual(set(changed), set(SOURCES))
        for before, after in zip(old["records"], new["records"]):
            if before["id"] not in SOURCES:
                self.assertEqual(after, before)
                continue
            src = SOURCES[before["id"]]
            self.assertEqual(
                {k for k in set(before)|set(after) if before.get(k)!=after.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(after["authors"], [
                {"name": src["author"], "sourceName": src["author"]}
            ])
            ev = after["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceUrl"], src["snapshot"])
            self.assertEqual(ev["sourceArticleUrl"], src["url"])
            self.assertEqual(ev["sourceArticleTitle"], src["sourceArticleTitle"])
            self.assertEqual(ev["sourcePrintedByline"], src["printedByline"])
            self.assertEqual(ev["matchedIndexedIssue"], src["issue"])
            self.assertEqual(ev["matchedIndexedYear"], src["year"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            self.assertTrue(ev["titleIdentityCaveat"])
            for field in ("journal","issueNumber","year","title","urls",
                          "legacyOriginal","legacyAccessStatus"):
                self.assertEqual(before[field], after[field])

    def test_freeze_every_target_identity_before_update(self):
        for rid in SOURCES:
            for key,bad in (
                ("title", "Other historical index"),
                ("issueNumber", 99),
                ("year", 2026),
                ("legacyOriginal", False),
                ("authors", [{"name": "Prior"}]),
                ("legacyAuthorEvidence", {"kind": "prior"}),
            ):
                with self.subTest(id=rid, field=key):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    target[key] = bad
                    with self.assertRaises(ValueError):
                        restore_five(data)
            for field, bad in (
                ("urls", {"canonical":"https://invented.invalid"}),
                ("legacyAccessStatus", {"status":"live"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    target[field] = bad
                    with self.assertRaises(ValueError):
                        restore_five(data)

    def test_frozen_corpus_size_queue_and_unique_ids(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_five(data)
        data = fixture()
        data["records"].append({"id":"extra","journal":"Sincronía"})
        with self.assertRaises(ValueError):
            restore_five(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_five(data)

    def test_reyes4_conflicting_year_and_title_never_conflated(self):
        reyes = next(s for s in SOURCES.values()
                     if s["author"] == "Giovanni Efraín Reyes Ortiz")
        ev = reyes["evidence"]
        self.assertEqual(reyes["year"], 1999)
        self.assertEqual(reyes["issue"], 12)
        self.assertIn("1960-1995", reyes["sourceArticleTitle"])
        self.assertEqual(ev["conflictingLaterPublicationYear"], 2001)
        self.assertEqual(ev["conflictingLaterPublicationIssue"], 21)
        self.assertIn("Four main theories", ev["conflictingLaterPublicationTitle"])
        self.assertNotEqual(ev["conflictingLaterBibliographicUrl"], reyes["url"])
        self.assertEqual(reyes["printedByline"], "Giovanni E. Reyes")

    def test_name_only_index_vs_substantive_article(self):
        by_author = {src["author"]: src for src in SOURCES.values()}
        self.assertEqual(
            by_author["Kathy Leonard"]["printedByline"], "Introducción de Kathy Leonard"
        )
        self.assertIn("entrevistas", by_author["Kathy Leonard"]["evidence"]["sourceContextTitle"])
        self.assertIn(
            "Priest and Teacher", by_author["William A. Clemente"]["sourceArticleTitle"]
        )
        self.assertIn("Nahua", by_author["Robin Rhodes"]["sourceArticleTitle"])
        self.assertIn("Sor Juana", by_author["Arnulfo Eduardo Velasco"]["sourceArticleTitle"])
        for src in SOURCES.values():
            self.assertEqual(src["status"], "original-page-unavailable")
            self.assertIn("web.archive.org/web/", src["snapshot"])
            self.assertEqual(len(src["timestamp"]), 14)


if __name__ == "__main__":
    unittest.main()
