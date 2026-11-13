"""Fail-closed regression for five signed early Sincronía originals."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_five_primary_names_as_titles import (
    SOURCES, restore_five,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": s["issue"], "year": s["year"],
            "title": s["title"], "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": s["url"]},
            "legacyAccessStatus": {"status": s["status"]},
        }
        for rid, s in SOURCES.items()
    ]
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(38)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1411)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *pending, *known, *other]}


class FivePrimaryOriginalTests(unittest.TestCase):
    def test_exactly_five_authors_and_provenance_fields_change(self):
        corpus = fixture()
        baseline = copy.deepcopy(corpus)
        changed_corpus, changed = restore_five(corpus)
        self.assertEqual(len(changed_corpus["records"]), 1845)
        self.assertEqual(len(changed), 5)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(baseline["records"], changed_corpus["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            s = SOURCES[old["id"]]
            self.assertEqual(
                {key for key in set(old) | set(new)
                 if old.get(key) != new.get(key)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(
                new["authors"],
                [{"name": s["author"], "sourceName": s["author"]}],
            )
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceArticleUrl"], s["url"])
            self.assertEqual(ev["sourceUrl"], s["snapshot"])
            self.assertEqual(ev["sourceCaptureTimestamp"], s["timestamp"])
            self.assertEqual(ev["sourceArticleTitle"], s["sourceArticleTitle"])
            self.assertEqual(ev["sourcePrintedByline"], s["printedByline"])
            self.assertEqual(ev["matchedIndexedIssue"], s["issue"])
            self.assertEqual(ev["matchedIndexedYear"], s["year"])
            self.assertTrue(ev["titleIdentityCaveat"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            for field in (
                "journal", "year", "issueNumber", "title", "urls",
                "legacyOriginal", "legacyAccessStatus",
            ):
                self.assertEqual(old[field], new[field])

    def test_preexisting_author_or_frozen_source_drift_fails(self):
        for rid in SOURCES:
            for field, bad in (
                ("title", "Unrelated original label"),
                ("issueNumber", 99),
                ("year", 2010),
                ("legacyOriginal", False),
                ("authors", [{"name": "Someone else"}]),
                ("legacyAuthorEvidence", {"sourceUrl": "other"}),
            ):
                with self.subTest(id=rid, field=field):
                    d = fixture()
                    record = next(r for r in d["records"] if r["id"] == rid)
                    record[field] = bad
                    with self.assertRaises(ValueError):
                        restore_five(d)
            with self.subTest(id=rid, field="original_url"):
                d = fixture()
                record = next(r for r in d["records"] if r["id"] == rid)
                record["urls"]["canonical"] = "https://invalid.example/other.htm"
                with self.assertRaises(ValueError):
                    restore_five(d)
            with self.subTest(id=rid, field="original_status"):
                d = fixture()
                record = next(r for r in d["records"] if r["id"] == rid)
                record["legacyAccessStatus"]["status"] = "live"
                with self.assertRaises(ValueError):
                    restore_five(d)

    def test_unique_original_ids_and_corpus_counts_fail_closed(self):
        d = fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_five(d)
        d = fixture()
        d["records"].append({"id": "unexpected", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_five(d)
        d = fixture()
        d["records"][0]["id"] = d["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_five(d)

    def test_person_name_index_is_not_the_same_as_article_title(self):
        for src in SOURCES.values():
            self.assertNotEqual(src["title"], src["sourceArticleTitle"])
            self.assertTrue(src["snapshot"].startswith("https://web.archive.org/web/"))
            self.assertIn("/CUCSH/Sincronia/", src["url"])
            self.assertEqual(src["status"], "original-page-archived-only")
        suarez = next(s for s in SOURCES.values() if s["author"] == "Ramón Iván Suárez Caamal")
        self.assertIn("metáfora", suarez["sourceArticleTitle"])
        medina = next(s for s in SOURCES.values() if s["author"] == "Jorge Medina")
        self.assertIn("Arriví", medina["sourceArticleTitle"])
        reyes = next(s for s in SOURCES.values() if s["author"] == "Giovanni Efraín Reyes Ortiz")
        self.assertEqual(reyes["printedByline"], "Giovanni E. Reyes")
        self.assertTrue(reyes["evidence"]["fullNameInstitutionalCorroborationUrl"])
        shulterbrandt = next(s for s in SOURCES.values() if s["author"] == "Sahnya Shulterbrandt")
        self.assertIn("Tercer Mundo", shulterbrandt["sourceArticleTitle"])
        forum = next(s for s in SOURCES.values() if s["author"] == "Forum Intercultura")
        self.assertEqual(forum["evidence"]["sourceContributorType"], "collective/organizational byline")
        self.assertIn("forum.int@", forum["evidence"]["sourcePrintedContact"])


if __name__ == "__main__":
    unittest.main()
