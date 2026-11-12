import copy
import unittest

from scripts.cucsh.restore_sincronia_two_vidaurre_works import (
    VERIFIED, restore_two_vidaurre_works,
)
from scripts.cucsh.validate_update import safe_two_vidaurre_reproduced_works


def fixture():
    targets = [
        {
            "id": item["id"], "journal": "Sincronía",
            "issueNumber": item["issue"], "year": item["year"],
            "title": item["oldTitle"],
            "titleVariants": [item["oldTitle"]],
            "authors": [], "legacyOriginal": True,
            "urls": {
                "canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia" +
                             item["suffix"]
            },
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
        }
        for item in VERIFIED
    ]
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía",
         "title": f"Unattributed {i}", "authors": []}
        for i in range(84)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Known {i}",
         "authors": [{"name": "Known Author"}]}
        for i in range(1368)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "title": f"Other {i}",
         "authors": [{"name": "Other Author"}]}
        for i in range(391)
    ]
    return {"records": targets + pending + known + other}


class TwoVidaurreWorksTests(unittest.TestCase):
    def test_exactly_two_work_identities_change(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, changed = restore_two_vidaurre_works(data)
        self.assertEqual(set(changed), {x["id"] for x in VERIFIED})
        self.assertEqual(len(out["records"]), 1845)
        allowed = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        for index, item in enumerate(VERIFIED):
            before, after = frozen["records"][index], out["records"][index]
            diff = {
                key for key in set(before) | set(after)
                if before.get(key) != after.get(key)
            }
            self.assertEqual(diff, allowed)
            self.assertEqual(after["title"], item["title"])
            self.assertIn(item["exactHeading"], after["titleVariants"])
            self.assertIn(item["oldTitle"], after["titleVariants"])
            self.assertEqual(
                [a["name"] for a in after["authors"]], item["authors"]
            )
            self.assertEqual(after["urls"], before["urls"])
            self.assertEqual(
                after["legacyAccessStatus"], before["legacyAccessStatus"]
            )
            self.assertTrue(
                safe_two_vidaurre_reproduced_works(before, after)
            )
        self.assertEqual(out["records"][2:], frozen["records"][2:])

    def test_drifted_issue_or_title_fails_closed(self):
        for field, value in (("issueNumber", 99), ("title", "Different label")):
            data = fixture()
            data["records"][0][field] = value
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                restore_two_vidaurre_works(data)

    def test_never_overwrites_existing_authors(self):
        data = fixture()
        data["records"][1]["authors"] = [{"name": "Existing Person"}]
        with self.assertRaises(ValueError):
            restore_two_vidaurre_works(data)

    def test_validator_rejects_url_source_heading_and_author_tampering(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, _ = restore_two_vidaurre_works(data)
        before, after = frozen["records"][1], out["records"][1]
        for mode in ("url", "source", "heading", "author", "availability"):
            bad = copy.deepcopy(after)
            if mode == "url":
                bad["urls"]["canonical"] = "https://wrong.invalid/"
            elif mode == "source":
                bad["legacyIndexMislabelEvidence"]["sourceUrl"] = (
                    "https://wrong.invalid/source"
                )
            elif mode == "heading":
                bad["titleVariants"].remove(VERIFIED[1]["exactHeading"])
            elif mode == "author":
                bad["authors"][0]["name"] = "Wrong Author"
            elif mode == "availability":
                bad["legacyAccessStatus"] = {"status": "live"}
            self.assertFalse(
                safe_two_vidaurre_reproduced_works(before, bad)
            )

    def test_empty_old_variants_still_keep_original_heading_and_index_label(self):
        data = fixture()
        for row in data["records"][:2]:
            row["titleVariants"] = []
        frozen = copy.deepcopy(data)
        out, _ = restore_two_vidaurre_works(data)
        for i, item in enumerate(VERIFIED):
            self.assertEqual(
                out["records"][i]["titleVariants"],
                [item["title"], item["exactHeading"], item["oldTitle"]],
            )
            self.assertTrue(
                safe_two_vidaurre_reproduced_works(
                    frozen["records"][i], out["records"][i]
                )
            )


if __name__ == "__main__":
    unittest.main()
