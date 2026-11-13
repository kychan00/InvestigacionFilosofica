"""Tests for three issue-five source-backed Sincronía author attributions."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_koene_wearne_gimenez import SOURCES, restore_three


def fixture():
    target = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": src["issue"], "year": src["year"],
            "title": src["title"], "authors": [], "legacyOriginal": True,
            "urls": {"canonical": src["url"]},
            "legacyAccessStatus": {"status": src["status"]},
        }
        for rid, src in SOURCES.items()
    ]
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(57)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1394)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [*target, *unresolved, *known, *other]}


class ThreeIssueFiveBylineTests(unittest.TestCase):
    def test_change_only_target_authors_and_evidence(self):
        data = fixture()
        before = copy.deepcopy(data)
        result, changed = restore_three(data)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(len(changed), 3)
        self.assertEqual(len(result["records"]), 1845)
        for old, new in zip(before["records"], result["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(new, old)
                continue
            src = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old) | set(new) if old.get(k) != new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(
                new["authors"],
                [{"name": src["author"], "sourceName": src["author"]}],
            )
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], src["url"])
            self.assertEqual(ev["matchedIndexedIssue"], src["issue"])
            self.assertEqual(ev["matchedIndexedYear"], src["year"])
            self.assertEqual(ev["urlMatchLevel"], src["evidence"]["urlMatchLevel"])
            self.assertTrue(ev["publicationVersionCaveat"])
            for k in ("journal", "title", "issueNumber", "year",
                      "urls", "legacyOriginal", "legacyAccessStatus"):
                self.assertEqual(old[k], new[k])

    def test_fail_closed_on_frozen_metadata_or_existing_byline(self):
        for rid, src in SOURCES.items():
            for field, incorrect in (
                ("title", "Different work"),
                ("issueNumber", 6),
                ("year", 2000),
                ("legacyOriginal", False),
                ("authors", [{"name": "Existing"}]),
                ("legacyAuthorEvidence", {"sourceUrl": "existing"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[field] = incorrect
                    with self.assertRaises(ValueError):
                        restore_three(data)
            with self.subTest(id=rid, field="original_url"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["urls"]["canonical"] = "https://invalid.example/article"
                with self.assertRaises(ValueError):
                    restore_three(data)
            with self.subTest(id=rid, field="original_status"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_three(data)

    def test_fails_if_corpus_or_queue_changes(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"].append({"id": "unexpected", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_three(data)

    def test_cite_title_spelling_and_reprint_discrepancies(self):
        by_author = {src["author"]: src for src in SOURCES.values()}
        koene = by_author["Jacoba Koene"]
        self.assertIn("arma de subversión", koene["title"])
        self.assertNotIn(
            "arma de subversión", koene["evidence"]["sourceCitationTitleVariant"]
        )
        wearne = by_author["Bruce C. Wearne"]
        self.assertIn("Salemanship", wearne["title"])
        self.assertIn("Salesmanship", wearne["evidence"]["sourceListedTitle"])
        gimenez = by_author["Martha E. Gimenez"]
        self.assertEqual(gimenez["evidence"]["sourceCitedYear"], 1998)
        self.assertIn("1993", gimenez["evidence"]["supportingCitation"])
        self.assertTrue(gimenez["url"].endswith("/gimenez.htm"))


if __name__ == "__main__":
    unittest.main()
