"""Offline fail-closed tests: four signed original historical Sincronía pages."""
import copy
import unittest
from scripts.cucsh.restore_sincronia_second_four_wayback import (
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
        {"id": f"unresolved-{i}", "journal": "Sincronía", "authors": []}
        for i in range(43)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1407)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *unresolved, *known, *other]}


class SecondFourArchivedWorksTests(unittest.TestCase):
    def test_four_only_author_and_evidence_changes(self):
        original = fixture()
        baseline = copy.deepcopy(original)
        after, changed = restore_four(original)
        self.assertEqual(len(after["records"]), 1845)
        self.assertEqual(len(changed), 4)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(baseline["records"], after["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(new, old)
                continue
            expected = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old) | set(new)
                 if old.get(k) != new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(
                new["authors"],
                [{"name": expected["author"], "sourceName": expected["author"]}],
            )
            evidence = new["legacyAuthorEvidence"]
            self.assertEqual(evidence["sourceUrl"], expected["snapshot"])
            self.assertEqual(evidence["sourceArticleTitle"], expected["archiveArticleTitle"])
            self.assertEqual(evidence["sourcePrintedByline"], expected["printedByline"])
            self.assertEqual(evidence["sourceArticleUrl"], expected["url"])
            self.assertEqual(evidence["matchedIndexedIssue"], expected["issue"])
            self.assertEqual(evidence["matchedIndexedYear"], expected["year"])
            self.assertTrue(evidence["originalAvailabilityPreserved"])
            for field in ("journal","title","issueNumber","year","urls",
                          "legacyOriginal","legacyAccessStatus"):
                self.assertEqual(old[field], new[field])

    def test_reject_all_record_drift_and_existing_author(self):
        for rid in SOURCES:
            for field, altered in (
                ("title", "Other title"), ("year", 2026),
                ("issueNumber", 19), ("legacyOriginal", False),
                ("authors", [{"name": "Existing byline"}]),
                ("legacyAuthorEvidence", {"kind": "existing"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[field] = altered
                    with self.assertRaises(ValueError):
                        restore_four(data)
            with self.subTest(id=rid, field="url"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["urls"]["canonical"] = "https://incorrect.invalid/"
                with self.assertRaises(ValueError):
                    restore_four(data)
            with self.subTest(id=rid, field="status"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_four(data)

    def test_fail_if_frozen_corpus_or_queue_changed(self):
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

    def test_original_copyright_year_not_journal_year_and_variants(self):
        source = {s["author"]: s for s in SOURCES.values()}
        duran = source["Javier Durán"]
        self.assertEqual(duran["year"], 1998)
        self.assertEqual(duran["evidence"]["sourcePrintedCopyrightYear"], 1996)
        self.assertIn("_Los muros de agua_", duran["title"])
        self.assertNotIn("_Los muros de agua_", duran["archiveArticleTitle"])
        friederich = source["Alex Friederich"]
        self.assertIn("freiderich.htm", friederich["url"])
        self.assertEqual(friederich["archivePageTitle"], "Ma Ing Yeats")
        self.assertEqual(friederich["title"], friederich["archiveArticleTitle"])
        costantini = source["Peter Costantini"]
        self.assertIn("Listening", costantini["title"])
        velasco = source["Arnulfo Eduardo Velasco"]
        self.assertTrue(velasco["title"].startswith("Los elementos"))
        self.assertTrue(velasco["archiveArticleTitle"].startswith("ELEMENTOS"))
        self.assertEqual(velasco["evidence"]["sourcePrintedAffiliation"], "Universidad de Guadalajara")


if __name__ == "__main__":
    unittest.main()
