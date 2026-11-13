"""Fail-closed checks for two Sincronía authors and exact source identity."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_sanchez_catela import SOURCES, restore_two


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": s["issue"], "year": s["year"],
            "title": s["title"], "authors": [], "legacyOriginal": True,
            "urls": {"canonical": s["url"]},
            "legacyAccessStatus": {"status": s["status"]},
        }
        for rid, s in SOURCES.items()
    ]
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(55)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1397)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *unresolved, *known, *others]}


class SanchezAndCatelaTests(unittest.TestCase):
    def test_only_two_author_evidence_pairs_change(self):
        data = fixture()
        before = copy.deepcopy(data)
        updated, changed = restore_two(data)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(len(changed), 2)
        for old, new in zip(before["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            src = SOURCES[old["id"]]
            self.assertEqual(
                {key for key in set(old) | set(new)
                 if old.get(key) != new.get(key)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": src["author"], "sourceName": src["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], src["url"])
            self.assertEqual(ev["matchedIndexedIssue"], src["issue"])
            self.assertEqual(ev["matchedIndexedYear"], src["year"])
            self.assertEqual(
                ev["urlMatchLevel"], src["evidence"]["urlMatchLevel"]
            )
            self.assertTrue(ev["publicationVersionCaveat"])
            for field in (
                "journal", "title", "year", "issueNumber", "urls",
                "legacyOriginal", "legacyAccessStatus",
            ):
                self.assertEqual(old[field], new[field])

    def test_fail_closed_on_any_frozen_record_mismatch(self):
        for rid in SOURCES:
            for key, value in (
                ("title", "Different article"),
                ("year", 2026),
                ("issueNumber", 100),
                ("legacyOriginal", False),
                ("authors", [{"name": "Already known"}]),
                ("legacyAuthorEvidence", {"kind": "already"}),
            ):
                with self.subTest(id=rid, field=key):
                    d = fixture()
                    row = next(r for r in d["records"] if r["id"] == rid)
                    row[key] = value
                    with self.assertRaises(ValueError):
                        restore_two(d)
            for key, value in (
                ("url", "https://invented.example/"),
                ("status", "live"),
            ):
                with self.subTest(id=rid, field=key):
                    d = fixture()
                    row = next(r for r in d["records"] if r["id"] == rid)
                    if key == "url":
                        row["urls"]["canonical"] = value
                    else:
                        row["legacyAccessStatus"]["status"] = value
                    with self.assertRaises(ValueError):
                        restore_two(d)

    def test_freeze_corpus_and_remaining_authorless_queue(self):
        d = fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_two(d)
        d = fixture()
        d["records"].append({"id": "unexpected", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_two(d)
        d = fixture()
        d["records"][0]["id"] = d["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_two(d)

    def test_primary_provenance_details_remain_explicit(self):
        by_author = {x["author"]: x for x in SOURCES.values()}
        sanchez = by_author["Guadalupe Sánchez Robles"]
        ev = sanchez["evidence"]
        self.assertEqual(ev["sourceCitedOriginalUrl"], sanchez["url"])
        self.assertEqual(ev["sourceLastConsulted"], "2012-10-16")
        self.assertIn("rebelión", ev["sourceCitationTitleVariant"])
        self.assertIn("rebelion", sanchez["title"])
        catela = by_author["Ludmila da Silva Catela"]
        ev = catela["evidence"]
        self.assertEqual(
            ev["additionalSourceCitedOriginalUrl"], catela["url"]
        )
        self.assertNotEqual(
            ev["supportingCitedOriginalUrlVariant"], catela["url"]
        )
        self.assertIn("sincronia.cucsh.udg.mx", ev["supportingCitedOriginalUrlVariant"])


if __name__ == "__main__":
    unittest.main()
