import copy
import unittest

from scripts.cucsh.restore_sincronia_vidaurre_velazquez import (
    ID, OLD, TITLE, HEADING, AUTHOR, SOURCE, SUPPORT,
    restore_velazquez_work,
)
from scripts.cucsh.validate_update import safe_vidaurre_velazquez_restoration


def fixture():
    target = {
        "id": ID, "journal": "Sincronía",
        "issueNumber": 13, "year": 2000,
        "title": OLD, "titleVariants": [OLD],
        "authors": [], "legacyOriginal": True,
        "urls": {
            "canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/vidauri2.htm"
        },
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía",
         "title": f"Unattributed {i}", "authors": []}
        for i in range(83)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Known {i}",
         "authors": [{"name": "Known Author"}]}
        for i in range(1370)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target] + pending + known + other}


class VidaurreVelazquezTests(unittest.TestCase):
    def test_exactly_one_frozen_work_changes(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, changed = restore_velazquez_work(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(out["records"]), 1845)
        before, after = frozen["records"][0], out["records"][0]
        allowed = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        self.assertEqual({
            key for key in set(before) | set(after)
            if before.get(key) != after.get(key)
        }, allowed)
        self.assertEqual(after["title"], TITLE)
        self.assertEqual(after["titleVariants"], [TITLE, HEADING, OLD])
        self.assertEqual(
            after["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}]
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["sourceUrl"], SOURCE
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["supportingSourceUrl"],
            SUPPORT,
        )
        self.assertEqual(after["urls"], before["urls"])
        self.assertEqual(
            after["legacyAccessStatus"], before["legacyAccessStatus"]
        )
        self.assertTrue(safe_vidaurre_velazquez_restoration(before, after))
        self.assertEqual(out["records"][1:], frozen["records"][1:])

    def test_empty_old_variants_keep_heading_and_index_label(self):
        data = fixture()
        data["records"][0]["titleVariants"] = []
        frozen = copy.deepcopy(data)
        out, _ = restore_velazquez_work(data)
        self.assertEqual(
            out["records"][0]["titleVariants"], [TITLE, HEADING, OLD]
        )
        self.assertTrue(
            safe_vidaurre_velazquez_restoration(
                frozen["records"][0], out["records"][0]
            )
        )

    def test_identity_drift_fails_closed(self):
        for field, value in (("issueNumber", 99), ("title", "Different label")):
            data = fixture()
            data["records"][0][field] = value
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                restore_velazquez_work(data)

    def test_existing_author_is_never_overwritten(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Existing"}]
        with self.assertRaises(ValueError):
            restore_velazquez_work(data)

    def test_validator_rejects_url_source_heading_author_and_status_tampering(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, _ = restore_velazquez_work(data)
        before, after = frozen["records"][0], out["records"][0]
        for mode in ("url", "source", "heading", "author", "availability"):
            bad = copy.deepcopy(after)
            if mode == "url":
                bad["urls"]["canonical"] = "https://wrong.invalid/"
            elif mode == "source":
                bad["legacyAuthorEvidence"]["sourceUrl"] = (
                    "https://wrong.invalid/source"
                )
            elif mode == "heading":
                bad["titleVariants"].remove(HEADING)
            elif mode == "author":
                bad["authors"][0]["name"] = "Wrong Person"
            elif mode == "availability":
                bad["legacyAccessStatus"] = {"status": "live"}
            self.assertFalse(
                safe_vidaurre_velazquez_restoration(before, bad)
            )


if __name__ == "__main__":
    unittest.main()
