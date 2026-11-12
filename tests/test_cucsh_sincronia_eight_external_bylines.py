import copy
import unittest

from scripts.cucsh.backfill_sincronia_eight_external_bylines import (
    VERIFIED,
    apply_evidence_eight,
)


def fixture():
    targets = [
        {
            "id": item["id"],
            "journal": "Sincronía",
            "issueNumber": item["issue"],
            "year": 1996 + (item["issue"] // 3),
            "title": item["title"],
            "authors": [],
            "legacyOriginal": True,
            "urls": {"canonical": "https://legacy.example/" + str(i)},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
        }
        for i, item in enumerate(VERIFIED)
    ]
    pending = [
        {"id": "missing-" + str(i), "journal": "Sincronía",
         "authors": [], "title": "Missing " + str(i)}
        for i in range(115)
    ]
    authored = [
        {"id": "authored-" + str(i), "journal": "Sincronía",
         "authors": [{"name": "Known Author"}], "title": "Article " + str(i)}
        for i in range(1331)
    ]
    other = [
        {"id": "other-" + str(i), "journal": "Protrepsis",
         "authors": [{"name": "Other Author"}], "title": "Other " + str(i)}
        for i in range(391)
    ]
    return {"records": targets + pending + authored + other}


class ExternalBylineTests(unittest.TestCase):
    def test_eight_exact_records_only(self):
        data = fixture()
        previous = copy.deepcopy(data)
        output, changed = apply_evidence_eight(data)
        self.assertEqual(len(changed), 8)
        self.assertEqual(len(output["records"]), 1845)
        for index, item in enumerate(VERIFIED):
            before = previous["records"][index]
            after = output["records"][index]
            self.assertEqual(
                sorted(set(before) ^ set(after)),
                ["authors", "legacyAuthorEvidence"],
            )
            for field, original in before.items():
                if field != "authors":
                    self.assertEqual(after[field], original)
            self.assertEqual(
                [a["name"] for a in after["authors"]], item["authors"]
            )
            self.assertEqual(
                after["legacyAuthorEvidence"]["sourceUrl"], item["source"]
            )
        self.assertEqual(output["records"][8:], previous["records"][8:])

    def test_rejects_inconsistent_work_identity(self):
        data = fixture()
        data["records"][0]["title"] = "Different published article"
        with self.assertRaisesRegex(ValueError, "baseline"):
            apply_evidence_eight(data)

    def test_rejects_existing_author_metadata(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Other"}]
        with self.assertRaises(ValueError):
            apply_evidence_eight(data)

    def test_rejects_corpus_drift(self):
        data = fixture()
        data["records"].pop()
        with self.assertRaisesRegex(ValueError, "frozen corpus"):
            apply_evidence_eight(data)


if __name__ == "__main__":
    unittest.main()
