"""Fail-closed regression tests for the next three source-cited bylines."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_three_new_cited import SOURCES, restore_three


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": f["issue"], "year": f["year"],
            "title": f["title"], "authors": [], "legacyOriginal": True,
            "urls": {"canonical": f["url"]},
            "legacyAccessStatus": {"status": f["status"]},
        }
        for rid, f in SOURCES.items()
    ]
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(60)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1391)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *pending, *known, *others]}


class ThreeNewCitedTests(unittest.TestCase):
    def test_only_three_bylines_and_documentation_change(self):
        original = fixture()
        before = copy.deepcopy(original)
        result, changed = restore_three(original)
        self.assertEqual(len(result["records"]), 1845)
        self.assertEqual(len(changed), 3)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(before["records"], result["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            expected = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old) | set(new) if old.get(k) != new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": expected["author"], "sourceName": expected["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], expected["url"])
            self.assertEqual(ev["verifiedAuthor"], expected["author"])
            self.assertEqual(ev["matchedIndexedIssue"], expected["issue"])
            self.assertEqual(ev["matchedIndexedYear"], expected["year"])
            self.assertTrue(ev["publicationVersionCaveat"])
            for key in ("title", "year", "issueNumber", "urls",
                        "legacyOriginal", "legacyAccessStatus"):
                self.assertEqual(old[key], new[key])

    def test_rejects_any_frozen_identity_change(self):
        for rid in SOURCES:
            for key, bad in (
                ("title", "wrong title"),
                ("year", 2020),
                ("issueNumber", 15),
                ("legacyOriginal", False),
                ("authors", [{"name": "Existing"}]),
                ("legacyAuthorEvidence", {"kind": "prior"}),
            ):
                with self.subTest(id=rid, key=key):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    target[key] = bad
                    with self.assertRaises(ValueError):
                        restore_three(data)
            for field, bad in (
                ("canonical", "https://unverified.invalid"),
                ("status", "live"),
            ):
                with self.subTest(id=rid, field=field):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    if field == "canonical":
                        target["urls"][field] = bad
                    else:
                        target["legacyAccessStatus"][field] = bad
                    with self.assertRaises(ValueError):
                        restore_three(data)

    def test_rejects_corpus_or_missing_author_queue_drift(self):
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

    def test_historical_caveats_are_explicit(self):
        by_author = {v["author"]: v for v in SOURCES.values()}
        gladys = by_author["Gladys Adamson"]
        self.assertEqual(gladys["evidence"]["sourceCitedOriginalUrl"], gladys["url"])
        self.assertEqual(gladys["evidence"]["sourceNote"], 2)
        self.assertEqual(gladys["year"], 1998)
        pires = by_author["João Ignácio Pires Lucas"]
        self.assertEqual(pires["evidence"]["relatedPublicationYear"], 1998)
        self.assertEqual(pires["year"], 1999)
        reyes = by_author["Giovanni Efraín Reyes Ortiz"]
        self.assertEqual(reyes["evidence"]["sourceByline"], "Giovanni E. Reyes")
        self.assertIn("no-original-url-proof", reyes["evidence"]["urlMatchLevel"])


if __name__ == "__main__":
    unittest.main()
