"""Fail-closed provenance tests for six Kathy Leonard issue-seven interviews."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_six_kathy_leonard_interviews import (
    ENTRIES, AUTHOR, restore_six,
)


def fixture():
    targets = [
        {
            "id": rid,
            "journal": "Sincronía",
            "issueNumber": 7, "year": 1998,
            "title": s["title"],
            "authors": [],
            "legacyOriginal": True,
            "urls": {
                "canonical": (
                    "http://fuentes.csh.udg.mx/CUCSH/Sincronia/" + s["filename"]
                )
            },
            "legacyAccessStatus": {"status": "original-page-unavailable"},
        }
        for rid, s in ENTRIES.items()
    ]
    unresolved = [
        {"id": f"unresolved-{i}", "journal": "Sincronía", "authors": []}
        for i in range(6)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Previously documented"}]}
        for i in range(1442)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other journal"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *unresolved, *known, *other]}


class SixLeonardInterviewsTests(unittest.TestCase):
    def test_exactly_six_interviewer_and_evidence_changes(self):
        data = fixture()
        previous = copy.deepcopy(data)
        result, changed = restore_six(data)
        self.assertEqual(len(result["records"]), 1845)
        self.assertEqual(set(changed), set(ENTRIES))
        self.assertEqual(len(changed), 6)
        for old, new in zip(previous["records"], result["records"]):
            if old["id"] not in ENTRIES:
                self.assertEqual(old, new)
                continue
            src = ENTRIES[old["id"]]
            self.assertEqual(
                {k for k in set(old)|set(new) if old.get(k)!=new.get(k)},
                {"authors", "legacyAuthorEvidence"},
            )
            self.assertEqual(new["authors"], [
                {"name": AUTHOR, "sourceName": AUTHOR}
            ])
            evidence = new["legacyAuthorEvidence"]
            self.assertEqual(evidence["creditedRole"], "interviewer")
            self.assertEqual(
                evidence["sourceIntervieweeNotCoauthor"], src["interviewee"]
            )
            self.assertTrue(evidence["originalIndexedLabelIsIntervieweeNotByline"])
            self.assertFalse(evidence["sourcePrintedAuthorOnThisPage"])
            self.assertEqual(evidence["matchedIndexedIssue"], 7)
            self.assertEqual(evidence["matchedIndexedYear"], 1998)
            self.assertEqual(evidence["sourceLaterBookPublicationYear"], 2001)
            self.assertEqual(evidence["sourceLaterBookAuthor"], "Kathy S. Leonard")
            self.assertTrue(evidence["publicationVersionCaveat"])
            self.assertEqual(evidence["sourceArticleUrl"], old["urls"]["canonical"])
            self.assertEqual(evidence["verifiedTitle"], old["title"])
            for key in (
                "journal","title","issueNumber","year","urls","legacyOriginal",
                "legacyAccessStatus",
            ):
                self.assertEqual(old[key], new[key])

    def test_original_html_unsigned_but_independent_reprints_credited(self):
        for src in ENTRIES.values():
            self.assertIn(src["interviewee"], src["additionalEvidence"] if
                          src["republication"] else src["title"])
        by_interviewee = {x["interviewee"]: x for x in ENTRIES.values()}
        for name in ("Yolanda Bedregal", "Mery Flores Saavedra"):
            self.assertIn("arcagulharevistadecultura.blogspot.com",
                          by_interviewee[name]["republication"])
        for name in (
            "Velia Calvimontes Salinas",
            "Elsa Dorado de Revilla",
            "Roxana Sélum",
            "Rosario Quiroga de Urquieta",
        ):
            self.assertIsNone(by_interviewee[name]["republication"])

    def test_all_six_interviewees_not_authors(self):
        result, _ = restore_six(fixture())
        for record in result["records"][:6]:
            self.assertEqual([a["name"] for a in record["authors"]],
                             ["Kathy Leonard"])
            self.assertNotIn(
                record["title"],
                [a["name"] for a in record["authors"]],
            )

    def test_fail_closed_on_prior_byline_frozen_metadata_or_url(self):
        for rid in ENTRIES:
            for key, wrong in (
                ("title", "Different interview"),
                ("year", 1999),
                ("issueNumber", 8),
                ("legacyOriginal", False),
                ("authors", [{"name": "Existing"}]),
                ("legacyAuthorEvidence", {"kind": "already"}),
                ("urls", {"canonical": "https://invalid.example/"} ),
                ("legacyAccessStatus", {"status": "live"}),
            ):
                with self.subTest(rid=rid, key=key):
                    d = fixture()
                    next(x for x in d["records"] if x["id"]==rid)[key] = wrong
                    with self.assertRaises(ValueError):
                        restore_six(d)

    def test_frozen_corpus_and_missing_queue_enforced(self):
        d = fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            restore_six(d)
        d = fixture()
        d["records"].append({"id": "extra", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_six(d)
        d = fixture()
        d["records"][0]["id"] = d["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_six(d)


if __name__ == "__main__":
    unittest.main()
