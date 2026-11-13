import copy
import unittest

from scripts.cucsh.restore_sincronia_issue18_poveda_dean import (
    VERIFIED, restore_issue18_poveda_dean,
)
from scripts.cucsh.validate_update import (
    safe_issue18_poveda_dean_restoration,
)


def fixture():
    targets = [
        {
            "id": item["id"], "journal": "Sincronía",
            "issueNumber": 18, "year": 2001,
            "title": item["oldTitle"],
            "titleVariants": [item["oldTitle"]],
            "authors": [], "legacyOriginal": True,
            "urls": {"canonical": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia" + item["suffix"]
            )},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyTitleEncodingEvidence": {"kind": "preserved-index"},
        }
        for item in VERIFIED
    ]
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía",
         "title": f"Unknown {i}", "authors": []}
        for i in range(86)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Known {i}",
         "authors": [{"name": "Published Author"}]}
        for i in range(1366)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": targets + pending + known + others}


class Issue18PovedaDeanTests(unittest.TestCase):
    def test_exactly_two_source_pinned_records_change(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        result, changed = restore_issue18_poveda_dean(data)
        self.assertEqual(set(changed), {x["id"] for x in VERIFIED})
        self.assertEqual(len(result["records"]), 1845)
        allowed = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        for i, item in enumerate(VERIFIED):
            old, new = frozen["records"][i], result["records"][i]
            diff = {
                k for k in set(old) | set(new)
                if old.get(k) != new.get(k)
            }
            self.assertEqual(diff, allowed)
            self.assertEqual(new["title"], item["newTitle"])
            self.assertEqual(
                [a["name"] for a in new["authors"]], item["authors"]
            )
            self.assertIn(item["oldTitle"], new["titleVariants"])
            self.assertTrue(
                safe_issue18_poveda_dean_restoration(old, new)
            )
            self.assertEqual(old["urls"], new["urls"])
            self.assertEqual(
                old["legacyAccessStatus"], new["legacyAccessStatus"]
            )
        self.assertEqual(result["records"][2:], frozen["records"][2:])

    def test_wrong_title_or_issue_fails_closed(self):
        for field, value in [
            ("title", "Different historical label"),
            ("issueNumber", 17),
        ]:
            data = fixture()
            data["records"][0][field] = value
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                restore_issue18_poveda_dean(data)

    def test_never_overwrites_existing_author(self):
        data = fixture()
        data["records"][1]["authors"] = [{"name": "Already known"}]
        with self.assertRaises(ValueError):
            restore_issue18_poveda_dean(data)

    def test_validator_rejects_url_source_author_or_alias_tampering(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, _ = restore_issue18_poveda_dean(data)
        old, new = frozen["records"][1], out["records"][1]
        for mode in ("url", "source", "author", "alias"):
            tampered = copy.deepcopy(new)
            if mode == "url":
                tampered["urls"]["canonical"] = "https://wrong.invalid/"
            elif mode == "source":
                tampered["legacyIndexMislabelEvidence"]["sourceUrl"] = (
                    "https://wrong.invalid/source"
                )
            elif mode == "author":
                tampered["authors"][0]["name"] = "Wrong Person"
            elif mode == "alias":
                tampered["titleVariants"].remove(VERIFIED[1]["oldTitle"])
            self.assertFalse(
                safe_issue18_poveda_dean_restoration(old, tampered)
            )


if __name__ == "__main__":
    unittest.main()
