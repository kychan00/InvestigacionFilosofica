import copy
import unittest

from scripts.cucsh.backfill_sincronia_issue_one_authors import (
    EVIDENCE, apply_first_issue_authors
)


def fixture():
    targets = [
        {
            "id": e["id"], "journal": "Sincronía",
            "issueNumber": e["issue"], "year": e["year"],
            "title": e["title"], "authors": [],
            "legacyOriginal": True,
            "urls": {
                "canonical": "http://sincronia.cucsh.udg.mx" +
                             e["originalSuffix"]
            },
            "legacyAccessStatus": {"status": "original-page-archived-only"},
            "legacyTitleEncodingEvidence": {"kind": "preserved-original-index"},
        }
        for e in EVIDENCE
    ]
    pending = [
        {"id": "pending-" + str(n), "journal": "Sincronía",
         "title": "Unattributed " + str(n), "authors": []}
        for n in range(96)
    ]
    known = [
        {"id": "authored-" + str(n), "journal": "Sincronía",
         "title": "Known " + str(n),
         "authors": [{"name": "Previously Verified Author"}]}
        for n in range(1355)
    ]
    others = [
        {"id": "other-" + str(n), "journal": "Protrepsis",
         "title": "Other " + str(n),
         "authors": [{"name": "Other Journal Author"}]}
        for n in range(391)
    ]
    return {"records": targets + pending + known + others}


class FirstIssueAuthorsTests(unittest.TestCase):
    def test_exactly_three_verified_authors_and_all_other_fields_unchanged(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        updated, ids = apply_first_issue_authors(data)
        self.assertEqual(set(ids), {e["id"] for e in EVIDENCE})
        self.assertEqual(len(updated["records"]), 1845)
        for i, entry in enumerate(EVIDENCE):
            before = frozen["records"][i]
            after = updated["records"][i]
            changes = sorted(
                k for k in set(before) | set(after)
                if before.get(k) != after.get(k)
            )
            self.assertEqual(changes, ["authors", "legacyAuthorEvidence"])
            self.assertEqual(
                [p["name"] for p in after["authors"]], [entry["author"]]
            )
            self.assertEqual(
                after["legacyAuthorEvidence"]["sourceUrl"],
                entry["sourceUrl"]
            )
            self.assertEqual(after["title"], before["title"])
            self.assertEqual(after["urls"], before["urls"])
            self.assertEqual(
                after["legacyAccessStatus"], before["legacyAccessStatus"]
            )
            self.assertEqual(
                after["legacyTitleEncodingEvidence"],
                before["legacyTitleEncodingEvidence"]
            )
        self.assertEqual(updated["records"][3:], frozen["records"][3:])

    def test_rejects_drifted_historical_title(self):
        data = fixture()
        data["records"][1]["title"] = "Unverified changed title"
        with self.assertRaisesRegex(ValueError, "original issue-one"):
            apply_first_issue_authors(data)

    def test_rejects_authors_which_were_already_verified(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Somebody"}]
        with self.assertRaises(ValueError):
            apply_first_issue_authors(data)

    def test_rejects_changed_original_url(self):
        data = fixture()
        data["records"][2]["urls"]["canonical"] = "https://unknown.example/"
        with self.assertRaisesRegex(ValueError, "original issue-one"):
            apply_first_issue_authors(data)


if __name__ == "__main__":
    unittest.main()
