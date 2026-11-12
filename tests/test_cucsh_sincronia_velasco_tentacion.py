import copy
import unittest

from scripts.cucsh.restore_sincronia_velasco_tentacion import (
    ID, OLD, TITLE, HEADING, AUTHOR, TEXT_SOURCE, URL_SOURCE,
    URL_ASSOCIATION, restore_tentacion,
)
from scripts.cucsh.validate_update import safe_velasco_tentacion_restoration


def fixture():
    target = {
        "id": ID, "journal": "Sincronía",
        "issueNumber": 16, "year": 2000,
        "title": OLD, "titleVariants": [OLD],
        "authors": [], "legacyOriginal": True,
        "urls": {
            "canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/tentacion.htm"
        },
        "legacyAccessStatus": {"status": "original-page-unavailable"},
        "legacyTitleEncodingEvidence": {"kind": "preserved-historical-index"},
    }
    pending = [
        {"id": f"pending-{i}", "journal": "Sincronía",
         "title": f"Unknown {i}", "authors": []}
        for i in range(82)
    ]
    known = [
        {"id": f"known-{i}", "journal": "Sincronía",
         "title": f"Known {i}",
         "authors": [{"name": "Known Author"}]}
        for i in range(1371)
    ]
    others = [
        {"id": f"other-{i}", "journal": "Protrepsis",
         "authors": [{"name": "Other"}]}
        for i in range(391)
    ]
    return {"records": [target] + pending + known + others}


class VelascoTentacionTests(unittest.TestCase):
    def test_only_one_triangulated_work_changes(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, changed = restore_tentacion(data)
        self.assertEqual(changed, [ID])
        self.assertEqual(len(out["records"]), 1845)
        before, after = frozen["records"][0], out["records"][0]
        allowed = {
            "title", "titleVariants", "authors",
            "legacyIndexMislabelEvidence", "legacyAuthorEvidence",
        }
        self.assertEqual({
            k for k in set(before) | set(after)
            if before.get(k) != after.get(k)
        }, allowed)
        self.assertEqual(after["title"], TITLE)
        self.assertEqual(after["titleVariants"], [TITLE, HEADING, OLD])
        self.assertEqual(
            after["authors"], [{"name": AUTHOR, "sourceName": AUTHOR}]
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["fullTextReproductionUrl"],
            TEXT_SOURCE,
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"][
                "legacyPathAssociationSourceUrl"
            ],
            URL_SOURCE,
        )
        self.assertEqual(
            after["legacyIndexMislabelEvidence"]["associatedLegacyUrl"],
            URL_ASSOCIATION,
        )
        self.assertTrue(safe_velasco_tentacion_restoration(before, after))
        self.assertEqual(after["urls"], before["urls"])
        self.assertEqual(
            after["legacyAccessStatus"], before["legacyAccessStatus"]
        )
        self.assertEqual(out["records"][1:], frozen["records"][1:])

    def test_identity_drift_fails_closed(self):
        for field, value in (
            ("issueNumber", 17),
            ("title", "Different historical text"),
        ):
            data = fixture()
            data["records"][0][field] = value
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                restore_tentacion(data)

    def test_existing_author_is_never_replaced(self):
        data = fixture()
        data["records"][0]["authors"] = [{"name": "Prior Author"}]
        with self.assertRaises(ValueError):
            restore_tentacion(data)

    def test_guard_rejects_source_url_heading_author_and_availability_tampering(self):
        data = fixture()
        frozen = copy.deepcopy(data)
        out, _ = restore_tentacion(data)
        before, after = frozen["records"][0], out["records"][0]
        for mode in ("url", "source", "path_source", "heading", "author", "status"):
            bad = copy.deepcopy(after)
            if mode == "url":
                bad["urls"]["canonical"] = "https://wrong.invalid/"
            elif mode == "source":
                bad["legacyIndexMislabelEvidence"]["fullTextReproductionUrl"] = (
                    "https://wrong.invalid/text"
                )
            elif mode == "path_source":
                bad["legacyAuthorEvidence"][
                    "legacyPathAssociationSourceUrl"
                ] = "https://wrong.invalid/path"
            elif mode == "heading":
                bad["titleVariants"].remove(HEADING)
            elif mode == "author":
                bad["authors"][0]["name"] = "Wrong Author"
            elif mode == "status":
                bad["legacyAccessStatus"] = {"status": "live"}
            self.assertFalse(
                safe_velasco_tentacion_restoration(before, bad)
            )

    def test_empty_variants_still_preserve_heading_and_old_index_label(self):
        data = fixture()
        data["records"][0]["titleVariants"] = []
        frozen = copy.deepcopy(data)
        out, _ = restore_tentacion(data)
        self.assertEqual(
            out["records"][0]["titleVariants"], [TITLE, HEADING, OLD]
        )
        self.assertTrue(
            safe_velasco_tentacion_restoration(
                frozen["records"][0], out["records"][0]
            )
        )


if __name__ == "__main__":
    unittest.main()
