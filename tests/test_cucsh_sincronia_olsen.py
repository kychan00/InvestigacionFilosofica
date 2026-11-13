import copy
import unittest

from scripts.cucsh.restore_sincronia_olsen import (
    ID, TITLE, AUTHOR, ORIGINAL_URL, COLMEX_SOURCE,
    REPRODUCTION_SOURCE, COLMEX_CITED_URL, restore_olsen,
)


def fixture():
    target = {
        "id": ID, "journal": "Sincronía", "issueNumber": 2, "year": 1997,
        "title": TITLE, "authors": [], "legacyOriginal": True,
        "urls": {"canonical": ORIGINAL_URL},
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
    }
    unresolved = [
        {"id": f"pending-{i}", "journal": "Sincronía", "authors": []}
        for i in range(77)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "authors": [{"name": "Known"}]}
        for i in range(1376)
    ]
    other = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target, *unresolved, *known, *other]}


class OlsenAttributionTests(unittest.TestCase):
    def test_only_one_byline_and_provenance_added(self):
        data = fixture()
        old = copy.deepcopy(data)
        updated, changed = restore_olsen(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(updated["records"]), 1845)
        before, after = old["records"][0], updated["records"][0]
        self.assertEqual(
            {field for field in set(before) | set(after)
             if before.get(field) != after.get(field)},
            {"authors", "legacyAuthorEvidence"},
        )
        self.assertEqual(
            after["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}]
        )
        ev = after["legacyAuthorEvidence"]
        self.assertEqual(ev["sourceUrl"], COLMEX_SOURCE)
        self.assertEqual(ev["reproducedTextUrl"], REPRODUCTION_SOURCE)
        self.assertEqual(ev["institutionalCitationUrlVariant"], COLMEX_CITED_URL)
        self.assertEqual(ev["sourceArticleUrl"], ORIGINAL_URL)
        self.assertEqual(
            ev["urlMatchLevel"],
            "original-exact-url-in-reproduction-alternate-host-in-thesis",
        )
        self.assertEqual(after["urls"], before["urls"])
        self.assertEqual(after["title"], before["title"])
        self.assertEqual(
            after["legacyAccessStatus"], before["legacyAccessStatus"]
        )
        self.assertEqual(updated["records"][1:], old["records"][1:])

    def test_identity_and_corpus_drift_fail_closed(self):
        for field, bad in (
            ("title", "unrelated"), ("issueNumber", 3), ("year", 1998),
            ("legacyOriginal", False),
            ("authors", [{"name": "Existing"}]),
            ("legacyAuthorEvidence", {"kind": "existing"}),
        ):
            with self.subTest(field=field):
                data = fixture()
                data["records"][0][field] = bad
                with self.assertRaises(ValueError):
                    restore_olsen(data)
        data = fixture()
        data["records"][0]["urls"]["canonical"] = COLMEX_CITED_URL
        with self.assertRaises(ValueError):
            restore_olsen(data)
        data = fixture()
        data["records"][0]["legacyAccessStatus"]["status"] = "live"
        with self.assertRaises(ValueError):
            restore_olsen(data)


if __name__ == "__main__":
    unittest.main()
