import copy
import unittest

from scripts.cucsh.backfill_sincronia_seven_bylines import VERIFIED, apply_verified_bylines


def fixture():
    verified = [
        {
            "id": item["id"],
            "journal": "Sincronía",
            "issueNumber": item["issue"],
            "title": item["title"],
            "authors": [],
            "legacyOriginal": True,
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "urls": {"canonical": "https://old.example/" + str(i)},
        }
        for i, item in enumerate(VERIFIED)
    ]
    remaining = [
        {"id": "missing-" + str(i), "journal": "Sincronía",
         "authors": [], "title": "Missing " + str(i)}
        for i in range(123)
    ]
    authored = [
        {"id": "authored-" + str(i), "journal": "Sincronía",
         "authors": [{"name": "Published Author"}], "title": "Article " + str(i)}
        for i in range(1324)
    ]
    other = [
        {"id": "other-" + str(i), "journal": "Protrepsis",
         "authors": [{"name": "Author"}], "title": "Other " + str(i)}
        for i in range(391)
    ]
    return {"records": verified + remaining + authored + other}


class SevenVerifiedBylinesTests(unittest.TestCase):
    def test_only_verified_authors_change(self):
        data = fixture()
        before = copy.deepcopy(data)
        out, changed = apply_verified_bylines(data)
        self.assertEqual(len(changed), 7)
        self.assertEqual(len(out["records"]), 1845)
        for i, item in enumerate(VERIFIED):
            prior, result = before["records"][i], out["records"][i]
            self.assertEqual(result["title"], prior["title"])
            self.assertEqual(result["urls"], prior["urls"])
            self.assertEqual(result["legacyAccessStatus"], prior["legacyAccessStatus"])
            self.assertEqual(
                [a["name"] for a in result["authors"]], item["authors"]
            )
            self.assertEqual(
                result["legacyAuthorEvidence"]["sourceUrl"], item["evidence"]
            )
        self.assertEqual(out["records"][7:], before["records"][7:])

    def test_rejects_wrong_title_before_attribution(self):
        data = fixture()
        data["records"][0]["title"] = "Different work"
        with self.assertRaisesRegex(ValueError, "Curated evidence"):
            apply_verified_bylines(data)

    def test_rejects_existing_author(self):
        data = fixture()
        data["records"][2]["authors"] = [{"name": "Somebody else"}]
        with self.assertRaises(ValueError):
            apply_verified_bylines(data)


if __name__ == "__main__":
    unittest.main()
