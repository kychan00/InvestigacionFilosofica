"""Fail-closed original hyperlink provenance for Dante and Gilbert in 1998."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_dante_gilbert_hypertext import (
    SOURCES, PREFIX, INDEX_CAPTURE, INDEX_ORIGINAL,
    EARLIER_INDEX_CAPTURE, restore_two,
)


def fixture():
    targets = [
        {
            "id": rid, "journal": "Sincronía",
            "issueNumber": 8, "year": 1998,
            "title": src["title"], "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": PREFIX + src["filename"]},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
        }
        for rid, src in SOURCES.items()
    ]
    remaining = [
        {"id": "cucsh:sincronia-legacy:a9b2551729fe0893d5e3",
         "journal": "Sincronía", "title": "Dante Medina", "authors": []},
        {"id": "cucsh:sincronia-legacy:d578e8ef399dde877feb",
         "journal": "Sincronía", "title": "de Campos,Jorge Lucio", "authors": []},
        {"id": "cucsh:sincronia-legacy:91f36da6674c93b19145",
         "journal": "Sincronía", "title": "Editorial Board/Consejo Editorial",
         "authors": []},
        {"id": "cucsh:sincronia-legacy:a2763a903fcca568e32a",
         "journal": "Sincronía",
         "title": "Further information for contributors.", "authors": []},
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously verified"}]}
        for i in range(1448)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *remaining, *known, *other]}


class SignedHypertextSectionTests(unittest.TestCase):
    def test_exactly_two_author_evidence_changes_no_other_modifications(self):
        d = fixture()
        baseline = copy.deepcopy(d)
        updated, changed = restore_two(d)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(set(changed), set(SOURCES))
        self.assertEqual(len(changed), 2)
        for old, new in zip(baseline["records"], updated["records"]):
            if old["id"] not in SOURCES:
                self.assertEqual(old, new)
                continue
            src = SOURCES[old["id"]]
            self.assertEqual(
                {k for k in set(old)|set(new) if old.get(k)!=new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": src["author"], "sourceName": src["author"]}
            ])
            ev = new["legacyAuthorEvidence"]
            self.assertEqual(ev["sourceUrl"], INDEX_CAPTURE)
            self.assertEqual(ev["sourceSectionIndexOriginalUrl"], INDEX_ORIGINAL)
            self.assertEqual(ev["sourceEarlierIndexCapture"], EARLIER_INDEX_CAPTURE)
            self.assertEqual(ev["sourceArticleUrl"], old["urls"]["canonical"])
            self.assertEqual(ev["sourceIndexExactLinkedOriginalUrl"],
                             old["urls"]["canonical"])
            self.assertEqual(ev["sourceIndexPrintedCredit"],
                             src["indexPrintedCredit"])
            self.assertEqual(ev["sourceIndexLinkLabel"], src["title"])
            self.assertEqual(ev["sourceWorkCaptureUrl"], src["snapshot"])
            self.assertFalse(ev["sourcePrintedAuthorOnWorkPage"])
            self.assertTrue(ev["sourceAuthorCreditOnExactLinkedSectionIndex"])
            self.assertTrue(ev["publicationVersionCaveat"])
            self.assertTrue(ev["originalAvailabilityPreserved"])
            self.assertEqual(ev["matchedIndexedYear"], 1998)
            self.assertEqual(ev["matchedIndexedIssue"], 8)
            for key in ("journal","issueNumber","year","title","urls",
                        "legacyOriginal","legacyAccessStatus"):
                self.assertEqual(old[key], new[key])

    def test_distinct_signed_authors_and_biography_remains_unsigned(self):
        new, _ = restore_two(fixture())
        by_id = {r["id"]: r for r in new["records"]}
        poets = by_id["cucsh:sincronia-legacy:4800ef829bfca4e699cb"]
        hyper = by_id["cucsh:sincronia-legacy:582537d89e07194c5970"]
        biography = by_id["cucsh:sincronia-legacy:a9b2551729fe0893d5e3"]
        self.assertEqual([a["name"] for a in poets["authors"]],
                         ["Dante Medina"])
        self.assertEqual([a["name"] for a in hyper["authors"]],
                         ["Stephen W. Gilbert"])
        self.assertFalse(biography["authors"])
        self.assertIn("Maneras de describir", poets["legacyAuthorEvidence"]["sourceCollectionTitle"])
        self.assertEqual(
            hyper["legacyAuthorEvidence"]["sourceIndexPrintedCredit"],
            "Hypertextualizado por Stephen W. Gilbert",
        )
        self.assertNotIn("Dante Medina",
                         [a["name"] for a in hyper["authors"]])

    def test_reject_any_frozen_title_url_issue_or_existing_attribution(self):
        for rid in SOURCES:
            for key, bad in (
                ("title", "Another article"), ("issueNumber", 13),
                ("year", 1997), ("legacyOriginal", False),
                ("authors", [{"name": "Preexisting"}]),
                ("legacyAuthorEvidence", {"kind": "already"}),
                ("urls", {"canonical": "http://example.invalid/another.html"}),
                ("legacyAccessStatus", {"status": "live"}),
            ):
                with self.subTest(id=rid, field=key):
                    d = fixture()
                    row = next(x for x in d["records"] if x["id"] == rid)
                    row[key] = bad
                    with self.assertRaises(ValueError):
                        restore_two(d)

    def test_corpus_and_queue_count_and_stable_id_fail_closed(self):
        d=fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_two(d)
        d=fixture()
        d["records"].append({"id":"extra", "journal":"Sincronía"})
        with self.assertRaises(ValueError):
            restore_two(d)
        d=fixture()
        d["records"][1]["id"]=d["records"][0]["id"]
        with self.assertRaises(ValueError):
            restore_two(d)


if __name__ == "__main__":
    unittest.main()
