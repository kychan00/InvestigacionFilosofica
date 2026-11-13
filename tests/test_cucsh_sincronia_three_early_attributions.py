import copy
import unittest

from scripts.cucsh.restore_sincronia_three_early_attributions import (
    ORIGINALS, restore_three,
)


def fixture():
    targets = [
        {
            "id": rid,
            "journal": "Sincronía",
            "issueNumber": f["issue"],
            "year": f["year"],
            "title": f["title"],
            "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": f["url"]},
            "legacyAccessStatus": {"status": f["status"]},
        }
        for rid, f in ORIGINALS.items()
    ]
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(70)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known Author"}]}
        for i in range(1381)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *pending, *known, *other]}


class ThreeEarlyAttributionsTests(unittest.TestCase):
    def test_exactly_three_author_and_provenance_changes(self):
        data = fixture()
        original = copy.deepcopy(data)
        updated, changed = restore_three(data)
        self.assertEqual(set(changed), set(ORIGINALS))
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 3)
        for old, new in zip(original["records"], updated["records"]):
            if old["id"] not in ORIGINALS:
                self.assertEqual(new, old)
                continue
            expected = ORIGINALS[old["id"]]
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
            self.assertEqual(evidence["sourceArticleUrl"], expected["url"])
            self.assertEqual(
                evidence["urlMatchLevel"],
                expected["evidence"]["urlMatchLevel"],
            )
            self.assertIn("publicationVersionCaveat", evidence)
            self.assertEqual(evidence["matchedIndexedYear"], expected["year"])
            for field in ("title", "issueNumber", "year", "urls",
                          "legacyAccessStatus", "legacyOriginal"):
                self.assertEqual(new[field], old[field])

    def test_no_index_year_or_original_url_drift(self):
        for rid, evidence in ORIGINALS.items():
            for key, value in (
                ("title", "Other title"),
                ("issueNumber", 99),
                ("year", 2010),
                ("legacyOriginal", False),
                ("authors", [{"name": "Prior author"}]),
                ("legacyAuthorEvidence", {"sourceUrl": "prior"}),
            ):
                with self.subTest(id=rid, field=key):
                    data = fixture()
                    row = next(r for r in data["records"] if r["id"] == rid)
                    row[key] = value
                    with self.assertRaises(ValueError):
                        restore_three(data)
            with self.subTest(id=rid, field="url"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["urls"]["canonical"] = "https://unrelated.invalid"
                with self.assertRaises(ValueError):
                    restore_three(data)
            with self.subTest(id=rid, field="availability"):
                data = fixture()
                row = next(r for r in data["records"] if r["id"] == rid)
                row["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_three(data)

    def test_frozen_corpus_count_and_pending_queue(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"].append({"id": "extra", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_three(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_three(data)

    def test_version_attribution_caveats_and_sources(self):
        works = list(ORIGINALS.values())
        self.assertEqual(
            {f["author"] for f in works},
            {"Noam Chomsky", "Alfredo Naime Padua", "David Bacon"},
        )
        for f in works:
            self.assertTrue(f["evidence"]["sourceUrl"].startswith("https://"))
            self.assertTrue(f["evidence"]["publicationVersionCaveat"])
            self.assertEqual(
                f["evidence"]["sourceArticleUrl"], f["url"]
            )
            self.assertNotIn("external-exact-original-url", f["evidence"]["urlMatchLevel"])


if __name__ == "__main__":
    unittest.main()
