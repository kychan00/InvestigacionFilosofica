import copy
import unittest

from scripts.cucsh.restore_sincronia_fernandez import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, UNISON_SOURCE, UNAM_SOURCE,
    restore_fernandez,
)


def fixture():
    target = {
        "id": ID, "journal": "Sincronía", "issueNumber": 10,
        "year": 1999, "title": TITLE, "authors": [], "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-archived-only"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(74)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1379)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *pending, *known, *others]}


class FernandezRestorationTests(unittest.TestCase):
    def test_changes_only_one_author_and_provenance(self):
        data = fixture()
        before = copy.deepcopy(data)
        updated, changed = restore_fernandez(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(updated["records"]), 1845)
        old, new = before["records"][0], updated["records"][0]
        self.assertEqual(
            {field for field in set(old) | set(new)
             if old.get(field) != new.get(field)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(
            new["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}]
        )
        evidence = new["legacyAuthorEvidence"]
        self.assertEqual(evidence["sourceUrl"], UNISON_SOURCE)
        self.assertEqual(evidence["sourcePrintedPage"], 67)
        self.assertEqual(evidence["supportingSourceUrl"], UNAM_SOURCE)
        self.assertEqual(evidence["sourceArticleUrl"], ORIGINAL_URL)
        self.assertEqual(
            evidence["urlMatchLevel"],
            "two-independent-exact-original-url-bibliographies",
        )
        self.assertEqual(updated["records"][1:], before["records"][1:])
        self.assertEqual(new["urls"], old["urls"])
        self.assertEqual(new["title"], old["title"])
        self.assertEqual(
            new["legacyAccessStatus"], old["legacyAccessStatus"]
        )

    def test_rejects_wrong_record_or_preexisting_attribution(self):
        for field, bad in (
            ("title", "Different title"),
            ("issueNumber", 11),
            ("year", 2000),
            ("legacyOriginal", False),
            ("authors", [{"name": "Existing writer"}]),
            ("legacyAuthorEvidence", {"kind": "existing"}),
        ):
            with self.subTest(field=field):
                data = fixture()
                data["records"][0][field] = bad
                with self.assertRaises(ValueError):
                    restore_fernandez(data)

    def test_rejects_url_or_access_status_changes(self):
        data = fixture()
        data["records"][0]["urls"]["canonical"] = "https://bad.invalid/"
        with self.assertRaises(ValueError):
            restore_fernandez(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_fernandez(data)

    def test_rejects_unexpected_corpus_or_pending_count(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaises(ValueError):
            restore_fernandez(data)
        data = fixture()
        data["records"].append({"id": "other-new", "journal": "Sincronía"})
        with self.assertRaises(ValueError):
            restore_fernandez(data)


if __name__ == "__main__":
    unittest.main()
