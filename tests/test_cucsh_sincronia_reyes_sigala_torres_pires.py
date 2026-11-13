"""Deterministic source-identity and full-corpus guards for four signed originals."""
import copy
import unittest

from scripts.cucsh.restore_sincronia_reyes_sigala_torres_pires import (
    SOURCES, restore_four,
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
    remaining = [
        {"id": f"unresolved-{i}", "journal": "Sincronía", "authors": []}
        for i in range(32)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known from earlier source"}]}
        for i in range(1418)
    ]
    others = [
        {"id": f"outside-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [*targets, *remaining, *known, *others]}


class FourPrimaryBylineTests(unittest.TestCase):
    def test_only_four_signed_byline_and_evidence_fields_change(self):
        source = fixture()
        previous = copy.deepcopy(source)
        updated, changed = restore_four(source)
        self.assertEqual(len(updated["records"]), 1845)
        self.assertEqual(len(changed), 4)
        self.assertEqual(set(changed), set(SOURCES))
        for old, new in zip(previous["records"], updated["records"]):
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
            evidence = new["legacyAuthorEvidence"]
            self.assertEqual(evidence["sourceUrl"], expected["snapshot"])
            self.assertEqual(evidence["sourceArticleUrl"], expected["url"])
            self.assertEqual(evidence["sourcePrintedByline"], expected["printedByline"])
            self.assertEqual(evidence["sourceArticleTitle"], expected["sourceArticleTitle"])
            self.assertEqual(evidence["matchedIndexedIssue"], expected["issue"])
            self.assertEqual(evidence["matchedIndexedYear"], expected["year"])
            self.assertTrue(evidence["titleIdentityCaveat"])
            self.assertTrue(evidence["originalAvailabilityPreserved"])
            for field in (
                "journal", "issueNumber", "year", "title", "urls",
                "legacyOriginal", "legacyAccessStatus",
            ):
                self.assertEqual(old[field], new[field])

    def test_frozen_record_drift_and_preexisting_attribution_fail(self):
        for rid in SOURCES:
            for field, replacement in (
                ("title", "Unrelated manuscript"),
                ("year", 2026),
                ("issueNumber", 101),
                ("legacyOriginal", False),
                ("authors", [{"name": "Already attributed"}]),
                ("legacyAuthorEvidence", {"kind": "old"}),
            ):
                with self.subTest(rid=rid, field=field):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    target[field] = replacement
                    with self.assertRaises(ValueError):
                        restore_four(data)
            for nested, bad in (
                ("urls", {"canonical": "https://fake.invalid/work"}),
                ("legacyAccessStatus", {"status": "live"}),
            ):
                with self.subTest(rid=rid, field=nested):
                    data = fixture()
                    target = next(r for r in data["records"] if r["id"] == rid)
                    target[nested] = bad
                    with self.assertRaises(ValueError):
                        restore_four(data)

    def test_frozen_corpus_size_unique_ids_and_pending_queue(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"].append({"id": "new", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_four(data)
        data = fixture()
        data["records"][0]["id"] = data["records"][1]["id"]
        with self.assertRaises(ValueError):
            restore_four(data)

    def test_specific_work_title_and_author_discrepancies(self):
        works = {s["author"]: s for s in SOURCES.values()}
        reyes = works["Giovanni Efraín Reyes Ortiz"]
        self.assertIn("Applicationin", reyes["title"])
        self.assertNotIn("Applicationin", reyes["sourceArticleTitle"])
        self.assertEqual(reyes["printedByline"], "Giovanni E. Reyes")
        self.assertEqual(reyes["status"], "original-page-unavailable")

        sigala = works["Ricardo Sigala"]
        self.assertEqual(sigala["printedByline"], "RICARDO SIGALA")
        self.assertIn("COSMÓLISIS", sigala["sourceArticleTitle"])

        torres = works["Andrés F. Torres"]
        self.assertEqual(torres["title"], "Torres, Andres F.")
        self.assertEqual(torres["sourceArticleTitle"], "The United States and Plan Colombia")
        self.assertIn("unsaved", torres["sourcePageTitle"])

        pires = works["João Ignácio Pires Lucas"]
        self.assertIn("João Ignacio", pires["printedByline"])
        self.assertNotEqual(pires["title"], pires["sourceArticleTitle"])
        self.assertEqual(pires["issue"], 13)
        self.assertTrue(pires["url"].endswith("/pires2.htm"))

        for source in SOURCES.values():
            self.assertIn("web.archive.org/web/", source["snapshot"])
            self.assertEqual(len(source["timestamp"]), 14)


if __name__ == "__main__":
    unittest.main()
