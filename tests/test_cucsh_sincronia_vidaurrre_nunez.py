import copy
import unittest

from scripts.cucsh.restore_sincronia_vidaurrre_nunez import (
    RECORD_ID, OLD_LABEL, TRUE_TITLE, AUTHOR, SOURCE, restore_title,
)
from scripts.cucsh.validate_update import safe_vidaurrre_nunez_restoration


def fixture():
    target = {
        "id": RECORD_ID, "journal": "Sincronía",
        "issueNumber": 16, "year": 2000,
        "title": OLD_LABEL, "titleVariants": [OLD_LABEL],
        "authors": [], "legacyOriginal": True,
        "urls": {"canonical": (
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/nunez.htm"
        )},
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "original-index-character-review"},
    }
    pending = [
        {"id": "missing-" + str(i), "journal": "Sincronía",
         "authors": [], "title": "Unknown " + str(i)}
        for i in range(100)
    ]
    authored = [
        {"id": "authored-" + str(i), "journal": "Sincronía",
         "authors": [{"name": "Known Author"}], "title": "Known " + str(i)}
        for i in range(1353)
    ]
    other = [
        {"id": "other-" + str(i), "journal": "Protrepsis",
         "authors": [{"name": "Different Author"}], "title": "Other " + str(i)}
        for i in range(391)
    ]
    return {"records": [target] + pending + authored + other}


class VidaurreCitationTests(unittest.TestCase):
    def test_single_exact_article_changed_without_loss(self):
        data = fixture()
        original = copy.deepcopy(data)
        output, changed = restore_title(data)
        self.assertEqual(changed, [RECORD_ID])
        self.assertEqual(len(output["records"]), 1845)
        before, after = original["records"][0], output["records"][0]
        changed_fields = {
            k for k in set(before) | set(after)
            if before.get(k) != after.get(k)
        }
        self.assertEqual(changed_fields, {
            "title", "titleVariants", "authors", "legacyAuthorEvidence",
            "legacyIndexMislabelEvidence",
        })
        self.assertEqual(after["title"], TRUE_TITLE)
        self.assertEqual(after["authors"], [
            {"name": AUTHOR, "sourceName": AUTHOR}
        ])
        self.assertEqual(after["legacyIndexMislabelEvidence"]["sourceUrl"], SOURCE)
        self.assertEqual(after["urls"], before["urls"])
        self.assertEqual(after["legacyAccessStatus"], before["legacyAccessStatus"])
        self.assertTrue(safe_vidaurrre_nunez_restoration(before, after))
        self.assertEqual(output["records"][1:], original["records"][1:])

    def test_fail_closed_if_title_changed_without_source(self):
        data = fixture()
        data["records"][0]["title"] = "Different indexed text"
        with self.assertRaisesRegex(ValueError, "baseline"):
            restore_title(data)

    def test_fail_closed_if_author_already_verified(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Other Person"}]
        with self.assertRaises(ValueError):
            restore_title(data)

    def test_guard_rejects_changed_url_or_evidence(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        output, _ = restore_title(data)
        before, after = frozen["records"][0], output["records"][0]
        fake = copy.deepcopy(after)
        fake["urls"]["canonical"] = "https://example.edu/"
        self.assertFalse(safe_vidaurrre_nunez_restoration(before, fake))
        fake = copy.deepcopy(after)
        fake["legacyIndexMislabelEvidence"]["sourceUrl"] = "https://unknown.example"
        self.assertFalse(safe_vidaurrre_nunez_restoration(before, fake))

    def test_guard_rejects_wrong_byline(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        output, _ = restore_title(data)
        fake = copy.deepcopy(output["records"][0])
        fake["authors"] = [{"name": "Not Cited Author"}]
        self.assertFalse(safe_vidaurrre_nunez_restoration(
            frozen["records"][0], fake
        ))


if __name__ == "__main__":
    unittest.main()
