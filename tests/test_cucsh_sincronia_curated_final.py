import unittest

from scripts.cucsh.finalize_sincronia_curated import (
    GRANILLO_AUTHOR,
    GRANILLO_ID,
    GRANILLO_PREVIOUS,
    MATEO_AUTHOR,
    MATEO_ID,
    MATEO_PREVIOUS,
    MATEO_TITLE,
    apply_patch,
)


def fixture():
    return {
        "records": [
            {
                "id": MATEO_ID,
                "journal": "Sincronía",
                "issueNumber": 16,
                "title": MATEO_PREVIOUS,
                "titleVariants": [MATEO_PREVIOUS],
                "authors": [],
                "legacyAccessStatus": {
                    "status": "original-page-unavailable",
                    "originalUrl": (
                        "http://fuentes.csh.udg.mx/CUCSH/"
                        "Sincronia/pobreza.htm"
                    ),
                },
            },
            {
                "id": GRANILLO_ID,
                "journal": "Sincronía",
                "issueNumber": 5,
                "title": "La envidia como cultura: el caso mexicano",
                "titleVariants": [
                    "La envidia como cultura: el caso mexicano"
                ],
                "authors": [{
                    "name": GRANILLO_PREVIOUS,
                    "sourceName": GRANILLO_PREVIOUS,
                }],
                "legacyAuthorEvidence": {
                    "verifiedAuthor": GRANILLO_PREVIOUS,
                },
            },
            {"id": "untouched", "journal": "Protrepsis", "title": "X"},
        ]
    }


class FinalizeSincroniaCuratedTests(unittest.TestCase):
    def test_applies_only_frozen_verified_changes(self):
        data = fixture()
        before_untouched = dict(data["records"][2])
        after, changed = apply_patch(data, audit_run_id=123)

        self.assertEqual(
            changed,
            [MATEO_ID, GRANILLO_ID],
        )
        self.assertEqual(after["records"][0]["title"], MATEO_TITLE)
        self.assertEqual(
            after["records"][0]["authors"][0]["name"],
            MATEO_AUTHOR,
        )
        self.assertEqual(
            after["records"][0]["legacyAccessStatus"]["status"],
            "original-page-unavailable",
        )
        self.assertEqual(
            after["records"][1]["authors"][0]["name"],
            GRANILLO_AUTHOR,
        )
        self.assertEqual(after["records"][2], before_untouched)

    def test_fails_closed_on_unexpected_mateo_baseline(self):
        data = fixture()
        data["records"][0]["title"] = "Different"
        with self.assertRaisesRegex(ValueError, "Mateo"):
            apply_patch(data)

    def test_fails_closed_on_unexpected_granillo_baseline(self):
        data = fixture()
        data["records"][1]["authors"][0]["name"] = "Different"
        with self.assertRaisesRegex(ValueError, "Granillo"):
            apply_patch(data)


if __name__ == "__main__":
    unittest.main()
