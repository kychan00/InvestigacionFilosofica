"""Fail-closed tests for Formanchuk and Vevia signed Sincronía originals."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_formanchuk_vevia_primary import (
    SOURCES, restore_two,
)


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
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(36)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1416)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *pending, *known, *other]}


class TwoSignedOriginalsTests(unittest.TestCase):
    def test_exact_two_author_evidence_pair_changes(self):
        data = fixture()
        before = copy.deepcopy(data)
        updated, changed = restore_two(data)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 2)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(before["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            s = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old)|set(new) if old.get(k)!=new.get(k)},
                {"authors", "legacyAuthorEvidence"}
            )
            self.assertEqual(new["authors"], [
                {"name": s["author"], "sourceName": s["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceUrl"], s["snapshot"])
            self.assertEqual(ev["sourceArticleUrl"], s["url"])
            self.assertEqual(ev["sourceArticleTitle"], s["sourceArticleTitle"])
            self.assertEqual(ev["sourcePrintedByline"], s["printedByline"])
            self.assertEqual(ev["matchedIndexedIssue"], s["issue"])
            self.assertEqual(ev["matchedIndexedYear"], s["year"])
            self.assertTrue(ev["titleIdentityCaveat"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            for f in ("journal","title","issueNumber","year","urls",
                      "legacyOriginal","legacyAccessStatus"):
                self.assertEqual(old[f], new[f])

    def test_reject_wrong_identity_or_existing_source_attribution(self):
        for rid in SOURCES:
            for key, wrong in (
                ("title", "Wrong historical index"),
                ("issueNumber", 100),
                ("year", 2026),
                ("legacyOriginal", False),
                ("authors", [{"name":"Prior"}]),
                ("legacyAuthorEvidence", {"kind":"already"}),
            ):
                with self.subTest(rid=rid, key=key):
                    d=fixture()
                    row=next(x for x in d["records"] if x["id"]==rid)
                    row[key]=wrong
                    with self.assertRaises(ValueError):
                        restore_two(d)
            d=fixture()
            row=next(x for x in d["records"] if x["id"]==rid)
            row["urls"]["canonical"]="https://incorrect.invalid/example"
            with self.assertRaises(ValueError):
                restore_two(d)
            d=fixture()
            row=next(x for x in d["records"] if x["id"]==rid)
            row["legacyAccessStatus"]["status"]="live"
            with self.assertRaises(ValueError):
                restore_two(d)

    def test_frozen_corpus_and_unique_ids_required(self):
        d=fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_two(d)
        d=fixture()
        d["records"].append({"id":"extra","journal":"Sincronía"})
        with self.assertRaises(ValueError):
            restore_two(d)
        d=fixture()
        d["records"][0]["id"]=d["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_two(d)

    def test_signed_article_titles_are_not_name_labels(self):
        for s in SOURCES.values():
            self.assertNotEqual(s["title"],s["sourceArticleTitle"])
            self.assertTrue(s["snapshot"].startswith("https://web.archive.org/web/"))
            self.assertTrue(s["url"].startswith("http://fuentes.csh.udg.mx/"))
        form=next(s for s in SOURCES.values() if s["author"]=="Alejandro E. Formanchuk")
        self.assertEqual(form["sourceArticleTitle"], "El nudo gordiano")
        self.assertEqual(form["printedByline"], "ALEJANDRO E. FORMANCHUK")
        vevia=next(s for s in SOURCES.values() if s["author"]=="Fernando Carlos Vevia Romero")
        self.assertEqual(vevia["sourceArticleTitle"],"La dimensión filosófica del dolor")
        self.assertEqual(vevia["year"],1999)
        self.assertTrue(vevia["url"].endswith("/vevia2.htm"))


if __name__ == "__main__":
    unittest.main()
