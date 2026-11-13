"""Deterministic fail-closed tests of four archived original Sincronía bylines."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_four_archived_primary import (
    SOURCES, restore_four,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía", "issueNumber": s["issue"],
            "year": s["year"], "title": s["title"], "authors": [],
            "legacyOriginal": True, "urls": {"canonical": s["url"]},
            "legacyAccessStatus": {"status": s["status"]},
        }
        for rid, s in SOURCES.items()
    ]
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(47)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Already documented"}]}
        for i in range(1403)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *unresolved, *known, *others]}


class FourArchivedPrimaryBylinesTests(unittest.TestCase):
    def test_only_exactly_four_authors_and_evidence_added(self):
        data = fixture()
        baseline = copy.deepcopy(data)
        updated, changed = restore_four(data)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(len(changed), 4)
        self.assertEqual(len(updated["records"]), 1845)
        for old, new in zip(baseline["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(new, old)
                continue
            s = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old) | set(new)
                 if old.get(k) != new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": s["author"], "sourceName": s["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], s["url"])
            self.assertEqual(ev["sourceUrl"], s["snapshot"])
            self.assertEqual(ev["sourcePrintedByline"], s["printedByline"])
            self.assertEqual(ev["sourceArticleTitle"], s["archiveArticleTitle"])
            self.assertEqual(ev["matchedIndexedIssue"], s["issue"])
            self.assertEqual(ev["matchedIndexedYear"], s["year"])
            self.assertEqual(
                ev["urlMatchLevel"],
                "exact-historical-url-with-optional-http-default-port",
            )
            self.assertTrue(ev["originalAvailabilityPreserved"])
            for k in ("journal", "title", "issueNumber", "year", "urls",
                      "legacyOriginal", "legacyAccessStatus"):
                self.assertEqual(new[k], old[k])

    def test_strict_original_url_issue_year_and_access_invariance(self):
        for rid in SOURCES:
            for field, altered in (
                ("title", "Contradictory title"),
                ("year", 2009),
                ("issueNumber", 99),
                ("legacyOriginal", False),
                ("authors", [{"name": "Prior author"}]),
                ("legacyAuthorEvidence", {"kind": "prior-evidence"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    row = next(x for x in data["records"] if x["id"] == rid)
                    row[field] = altered
                    with self.assertRaises(ValueError):
                        restore_four(data)
            with self.subTest(id=rid, field="sourceURL"):
                data = fixture()
                row = next(x for x in data["records"] if x["id"] == rid)
                row["urls"]["canonical"] = "https://incorrect.invalid/work"
                with self.assertRaises(ValueError):
                    restore_four(data)
            with self.subTest(id=rid, field="accessStatus"):
                data = fixture()
                row = next(x for x in data["records"] if x["id"] == rid)
                row["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_four(data)

    def test_corpus_counts_and_existing_authorship_queue(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"].append({"id": "new", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_four(data)

    def test_historical_differences_translator_and_spelling(self):
        by_author = {s["author"]: s for s in SOURCES.values()}
        vevia = by_author["Fernando Carlos Vevia Romero"]
        self.assertEqual(vevia["printedByline"], "Fernando C. Vevia Romero")
        self.assertIn("unav.es", vevia["evidence"]["fullNameCorroborationUrl"])
        self.assertTrue(vevia["title"].endswith(","))
        costantini = by_author["Peter Costantini"]
        self.assertIn("Interpress Service", costantini["evidence"]["sourcePrintedAffiliation"])
        self.assertNotEqual(costantini["title"], costantini["archiveArticleTitle"])
        gilbert = by_author["Stephen W. Gilbert"]
        self.assertNotEqual(gilbert["title"], gilbert["archiveArticleTitle"])
        self.assertIn("México", gilbert["archiveArticleTitle"])
        self.assertEqual(
            gilbert["evidence"]["creditedTranslatorNotCoauthor"],
            "Dolores Pérez Padilla",
        )
        self.assertIn(
            "unresolved", gilbert["evidence"]["bibliographicIdentityCaution"]
        )
        fignoni = by_author["Alicia Fignoni"]
        self.assertIn("figioni.htm", fignoni["url"])
        self.assertEqual(fignoni["status"], "original-page-unavailable")
        self.assertIn("Alicia Fignoni", fignoni["printedByline"])
        for s in SOURCES.values():
            self.assertIn("web.archive.org/web/", s["snapshot"])
            self.assertEqual(len(s["timestamp"]), 14)


if __name__ == "__main__":
    unittest.main()
