import unittest

from scripts.cucsh.backfill_sincronia_authors import (
    VERIFIED_AUTHORS, apply_verified_authors,
)


def make_row(identifier, issue, title):
    return {
        "id": identifier,
        "journal": "Sincronía",
        "issueNumber": issue,
        "title": title,
        "authors": [],
        "legacyOriginal": True,
        "urls": {"canonical": "http://original.example.org/source.htm"},
    }


def snapshot():
    rows = [
        make_row(identifier, issue, title)
        for identifier, (issue, title, _) in VERIFIED_AUTHORS.items()
    ]
    rows.append({
        "id": "other", "journal": "Protrepsis", "title": "Old"
    })
    return {"schemaVersion": 1, "provider": "CUCSH Filosofía", "records": rows}


class VerifiedAuthorTests(unittest.TestCase):
    def test_exact_evidence_list_preserves_all_other_fields(self):
        before = snapshot()
        after, report = apply_verified_authors(before)
        self.assertEqual(len(before["records"]), len(after["records"]))
        self.assertEqual(len(report["changedAuthors"]), 6)
        self.assertEqual(after["records"][-1], before["records"][-1])
        self.assertTrue(all(
            row.get("legacyAuthorEvidence", {}).get("auditRunId") == 43030567727
            for row in after["records"][:6]
        ))
        self.assertTrue(all(len(row["authors"]) == 1 for row in after["records"][:6]))

    def test_idempotent_and_author_names_are_not_affiliations(self):
        first, report = apply_verified_authors(snapshot())
        second, report2 = apply_verified_authors(first)
        self.assertEqual(first, second)
        self.assertEqual(len(report2["changedAuthors"]), 0)
        names = [row["authors"][0]["name"] for row in first["records"][:6]]
        self.assertNotIn("Stanford University", names)
        self.assertNotIn("National University of Singapore", names)
        self.assertNotIn("Regresar a ana", names)

    def test_wrong_issue_refuses_modification(self):
        original = snapshot()
        original["records"][0]["issueNumber"] = 9
        with self.assertRaisesRegex(ValueError, "not aligned"):
            apply_verified_authors(original)

    def test_existing_conflicting_author_refuses_overwrite(self):
        original = snapshot()
        original["records"][0]["authors"] = [{"name": "Another person"}]
        with self.assertRaisesRegex(ValueError, "conflicting authors"):
            apply_verified_authors(original)


if __name__ == "__main__":
    unittest.main()
