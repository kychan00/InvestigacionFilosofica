"""Regression tests for three evidence-backed Sincronía issue-1/4 authors."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_ponce_torres_semo import (
    SOURCES, restore_three,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía", "issueNumber": x["issue"],
            "year": x["year"], "title": x["title"], "authors": [],
            "legacyOriginal": True, "urls": {"canonical": x["url"]},
            "legacyAccessStatus": {"status": x["status"]},
        }
        for rid, x in SOURCES.items()
    ]
    missing = [
        {"id": f"missing-{i}", "journal": "Sincronía", "authors": []}
        for i in range(52)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1399)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *missing, *known, *other]}


class ThreeMoreSincroniaAuthorsTests(unittest.TestCase):
    def test_only_three_authors_and_evidence_change(self):
        data = fixture()
        before = copy.deepcopy(data)
        updated, changed = restore_three(data)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 3)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(before["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(new, old)
                continue
            source = SOURCES[old["id"]]
            self.assertEqual(
                {field for field in set(old) | set(new)
                 if old.get(field) != new.get(field)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": source["author"], "sourceName": source["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], source["url"])
            self.assertEqual(ev["matchedIndexedIssue"], source["issue"])
            self.assertEqual(ev["matchedIndexedYear"], source["year"])
            self.assertEqual(
                ev["urlMatchLevel"], source["evidence"]["urlMatchLevel"]
            )
            self.assertTrue(ev["publicationVersionCaveat"])
            for key in (
                "journal", "issueNumber", "year", "title", "urls",
                "legacyOriginal", "legacyAccessStatus",
            ):
                self.assertEqual(old[key], new[key])

    def test_fail_closed_on_identity_mismatch(self):
        for rid in SOURCES:
            for field, bad in (
                ("title", "wrong title"),
                ("issueNumber", 88),
                ("year", 2020),
                ("authors", [{"name": "Previously known"}]),
                ("legacyOriginal", False),
                ("legacyAuthorEvidence", {"source": "existing"}),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    row = next(x for x in data["records"] if x["id"] == rid)
                    row[field] = bad
                    with self.assertRaises(ValueError):
                        restore_three(data)
            with self.subTest(id=rid, field="original_url"):
                data = fixture()
                row = next(x for x in data["records"] if x["id"] == rid)
                row["urls"]["canonical"] = "https://bad.invalid/"
                with self.assertRaises(ValueError):
                    restore_three(data)
            with self.subTest(id=rid, field="access"):
                data = fixture()
                row = next(x for x in data["records"] if x["id"] == rid)
                row["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_three(data)

    def test_corpus_size_or_pending_count_drift_fails(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"].append({"id": "new-record", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"][1]["id"] = data["records"][0]["id"]
        with self.assertRaises(ValueError):
            restore_three(data)

    def test_authorship_and_version_caveats(self):
        authors = {x["author"]: x for x in SOURCES.values()}
        ponce = authors["Francisco Javier Ponce"]
        self.assertEqual(ponce["issue"], 1)
        self.assertIn("sololiteratura.com", ponce["evidence"]["sourceAnnotatedLink"])
        self.assertIn("Pedro Páramo", ponce["title"])
        torres = authors["María Elena Martínez Torres"]
        self.assertEqual(torres["year"], 1997)
        self.assertIn("Stuggle", torres["title"])
        self.assertIn("LASA", torres["evidence"]["sourceEvent"])
        semo = authors["Enrique Semo"]
        self.assertEqual(semo["evidence"]["sourceOriginalIssue"], 1075)
        self.assertEqual(semo["evidence"]["sourceOriginalDate"], "1997-06-08")
        self.assertEqual(semo["year"], 1997)


if __name__ == "__main__":
    unittest.main()
