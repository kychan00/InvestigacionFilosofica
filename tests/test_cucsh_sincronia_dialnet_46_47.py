import copy
import unittest

from scripts.cucsh.restore_sincronia_dialnet_46_47 import (
    VERIFIED, repair_issue46_47,
)
from scripts.cucsh.validate_update import safe_dialnet_issue46_47_repair


def fixture():
    targets = [
        {
            "id": e["id"],
            "journal": "Sincronía", "issueNumber": e["issue"],
            "year": e["year"], "title": e["oldTitle"],
            "titleVariants": [e["oldTitle"]],
            "authors": [], "legacyOriginal": True,
            "urls": {"canonical": (
                "http://sincronia.cucsh.udg.mx" + e["suffix"]
            )},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyTitleEncodingEvidence": {
                "source": "original historical issue",
                "preserved": True,
            },
        }
        for e in VERIFIED
    ]
    missing = [
        {"id": f"missing-{i}", "journal": "Sincronía",
         "title": f"Unattributed {i}", "authors": []}
        for i in range(91)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Verified article {i}",
         "authors": [{"name": "Previously published"}]}
        for i in range(1358)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Different Author"}]}
        for i in range(391)
    ]
    return {"records": targets + missing + known + other}


class DialnetVerifiedRepairTests(unittest.TestCase):
    def test_only_five_exact_source_records_change(self):
        corpus = fixture()
        baseline = copy.deepcopy(corpus)
        output, changed = repair_issue46_47(corpus)
        self.assertEqual(len(changed), 5)
        self.assertEqual(set(changed), {v["id"] for v in VERIFIED})
        self.assertEqual(len(output["records"]), 1845)
        for index, entry in enumerate(VERIFIED):
            before = baseline["records"][index]
            after = output["records"][index]
            allowed = {"authors", "legacyAuthorEvidence"}
            if entry["newTitle"]:
                allowed.update({
                    "title", "titleVariants", "legacyIndexMislabelEvidence"
                })
                self.assertEqual(after["title"], entry["newTitle"])
            else:
                self.assertEqual(after["title"], before["title"])
                self.assertNotIn("legacyIndexMislabelEvidence", after)
            diff = {
                k for k in set(before) | set(after)
                if before.get(k) != after.get(k)
            }
            self.assertEqual(diff, allowed)
            self.assertEqual(
                [a["name"] for a in after["authors"]], entry["authors"]
            )
            self.assertEqual(after["urls"], before["urls"])
            self.assertEqual(
                after["legacyAccessStatus"],
                before["legacyAccessStatus"],
            )
            self.assertTrue(safe_dialnet_issue46_47_repair(before, after))
        self.assertEqual(output["records"][5:], baseline["records"][5:])

    def test_rejects_mismatched_issue_or_title(self):
        for field, value in [
            ("issueNumber", 48),
            ("title", "Different paper"),
        ]:
            corpus = fixture()
            corpus["records"][0][field] = value
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                repair_issue46_47(corpus)

    def test_rejects_overwriting_existing_author(self):
        corpus = fixture()
        corpus["records"][0]["authors"] = [{"name": "Already verified"}]
        with self.assertRaises(ValueError):
            repair_issue46_47(corpus)

    def test_rejects_tampered_primary_url_or_secondary_source(self):
        corpus = fixture()
        frozen = copy.deepcopy(corpus)
        updated, _ = repair_issue46_47(corpus)
        b, a = frozen["records"][0], updated["records"][0]
        bad = copy.deepcopy(a)
        bad["legacyAuthorEvidence"]["sourceUrl"] = "https://fake.invalid"
        self.assertFalse(safe_dialnet_issue46_47_repair(b, bad))
        bad = copy.deepcopy(a)
        bad["urls"]["canonical"] = "https://fake.invalid"
        self.assertFalse(safe_dialnet_issue46_47_repair(b, bad))

    def test_historical_spelling_remains_unchanged(self):
        corpus = fixture()
        original = copy.deepcopy(corpus)
        updated, _ = repair_issue46_47(corpus)
        for i in (2, 4):
            self.assertEqual(
                updated["records"][i]["title"],
                original["records"][i]["title"],
            )
            self.assertEqual(
                updated["records"][i]["titleVariants"],
                original["records"][i]["titleVariants"],
            )


if __name__ == "__main__":
    unittest.main()
