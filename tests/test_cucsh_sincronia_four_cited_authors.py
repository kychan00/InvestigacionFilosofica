"""Deterministic fail-closed test of the four historically cited bylines."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_four_cited_authors import (
    SOURCES, restore_four,
)


def fixture():
    original = [
        {
            "id": rid,
            "journal": "Sincronía",
            "issueNumber": row["issue"],
            "year": row["year"],
            "title": row["title"],
            "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": row["url"]},
            "legacyAccessStatus": {"status": row["status"]},
        }
        for rid, row in SOURCES.items()
    ]
    missing = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(66)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1384)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Known"}]}
        for i in range(391)
    ]
    return {"records": [*original, *missing, *known, *others]}


class FourCitedAuthorsTests(unittest.TestCase):
    def test_changes_exactly_four_author_provenance_pairs(self):
        data = fixture()
        before = copy.deepcopy(data)
        after, changed = restore_four(data)
        self.assertEqual(len(after["records"]), 1845)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(len(changed), 4)
        for old, new in zip(before["records"], after["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            f = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old) | set(new)
                 if old.get(k) != new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": f["author"], "sourceName": f["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], f["url"])
            self.assertEqual(ev["matchedIndexedYear"], f["year"])
            self.assertEqual(ev["matchedIndexedIssue"], f["issue"])
            self.assertEqual(ev["urlMatchLevel"], f["evidence"]["urlMatchLevel"])
            self.assertTrue(ev["publicationVersionCaveat"])
            for k in ("title", "year", "issueNumber", "urls",
                      "legacyOriginal", "legacyAccessStatus"):
                self.assertEqual(old[k], new[k])

    def test_frozen_identity_blocks_any_unsafe_change(self):
        for rid in SOURCES:
            for key, new_value in (
                ("title", "Unrelated source"),
                ("issueNumber", 200),
                ("year", 1990),
                ("legacyOriginal", False),
                ("authors", [{"name": "Earlier byline"}]),
                ("legacyAuthorEvidence", {"kind": "other"}),
            ):
                with self.subTest(id=rid, key=key):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[key] = new_value
                    with self.assertRaises(ValueError):
                        restore_four(data)
            with self.subTest(id=rid, key="urls"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["urls"]["canonical"] = "https://example.invalid/test"
                with self.assertRaises(ValueError):
                    restore_four(data)
            with self.subTest(id=rid, key="legacyAccessStatus"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_four(data)

    def test_no_missing_or_added_ids_and_correct_pending_count(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"].append({"id": "unfrozen", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_four(data)

    def test_bibliographic_discrepancies_remain_explicit(self):
        by_url = {v["url"].rsplit("/", 1)[-1]: v for v in SOURCES.values()}
        cardoso = by_url["cardoso.html"]["evidence"]
        self.assertEqual(cardoso["sourceCitationYear"], 1996)
        self.assertEqual(cardoso["sourceFootnote"], 18)
        self.assertEqual(by_url["cardoso.html"]["year"], 1998)
        levy = by_url["levy.htm"]["evidence"]
        self.assertEqual(levy["supportingCitationYear"], 1998)
        self.assertEqual(by_url["levy.htm"]["year"], 1999)
        self.assertIn("Felipe Rivera", by_url["levy2.htm"]["evidence"]["sourceTitleVariant"])
        self.assertIn("Relipe Rivera", by_url["levy2.htm"]["title"])
        self.assertEqual(
            by_url["montoya1.html"]["evidence"]["urlMatchLevel"],
            "matching-distinctive-title-no-exact-original-url-proof",
        )


if __name__ == "__main__":
    unittest.main()
