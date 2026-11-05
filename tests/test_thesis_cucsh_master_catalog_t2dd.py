"""T2DD: CUCSH master-catalog scan keeps bibliography and physical holding separate."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/scan_cucsh_master_catalog_mef_targets_t2dd.py"
T2DB = ROOT / "scripts/thesis/config/mef-program-resolution-t2db.json"

spec = importlib.util.spec_from_file_location("t2dd", SCRIPT)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


def row(title, author, program="Maestría en Estudios Filosóficos", url="https://www.biblioteca.cucsh.udg.mx/?q=content/example"):
    return {
        "title": title,
        "author": author,
        "coauthor": "",
        "director": "",
        "yearRaw": "2019",
        "year": 2019,
        "programRaw": program,
        "recordUrl": url,
        "recordUrlAlternates": [],
        "catalogPageUrl": "https://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-maestria&page=1",
    }


def crawl(rows):
    return {
        "landingRequestedUrl": "https://www.biblioteca.cucsh.udg.mx/vista-tesis-maestria",
        "landingFinalUrl": "https://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-maestria",
        "lastPageIndex": 0,
        "pagesFetched": 1,
        "rows": rows,
        "pageEvidence": [{"page": 0, "rows": len(rows)}],
    }


class T2DDTests(unittest.TestCase):
    def setUp(self):
        self.t2db = json.loads(T2DB.read_text(encoding="utf-8"))

    def fake_crawler(self, rows):
        return lambda **kwargs: crawl(rows)

    def target(self, author):
        return next(x for x in self.t2db["priorityCases"] if x["author"] == author)

    def test_exact_mario_reference_confirms_catalog_not_physical_holding(self):
        mario = self.target("Mario Damián Del Muro Silva")
        out = mod.scan(
            self.t2db,
            crawler=self.fake_crawler([
                row(mario["title"], "Del Muro Silva, Mario Damián")
            ]),
            delay=0,
        )
        result = next(x for x in out["results"] if x["author"] == mario["author"])
        self.assertEqual(result["status"], "cucsh-library-catalog-reference-confirmed")
        self.assertTrue(result["libraryCatalogReferenceConfirmed"])
        self.assertFalse(result["physicalHoldingConfirmed"])
        self.assertEqual(out["metrics"]["libraryCatalogReferencesConfirmed"], 1)
        self.assertEqual(out["metrics"]["physicalHoldingsConfirmed"], 0)

    def test_exact_title_author_other_program_becomes_conflict_review(self):
        adriel = self.target("Adriel Manuel Hernández Guzmán")
        out = mod.scan(
            self.t2db,
            crawler=self.fake_crawler([
                row(
                    adriel["title"],
                    "Hernández Guzmán, Adriel Manuel",
                    program="Maestría en Ciencias Sociales",
                )
            ]),
            delay=0,
        )
        result = next(x for x in out["results"] if x["author"] == adriel["author"])
        self.assertEqual(result["status"], "exact-reference-program-conflict-review")
        self.assertTrue(result["programConflict"])
        self.assertFalse(result["libraryCatalogReferenceConfirmed"])

    def test_adriel_known_title_variant_can_match(self):
        adriel = self.target("Adriel Manuel Hernández Guzmán")
        out = mod.scan(
            self.t2db,
            crawler=self.fake_crawler([
                row(adriel["titleVariant"], "Adriel Manuel Hernández Guzmán")
            ]),
            delay=0,
        )
        result = next(x for x in out["results"] if x["author"] == adriel["author"])
        self.assertEqual(result["status"], "cucsh-library-catalog-reference-confirmed")
        self.assertEqual(len(result["exactTitleAuthor"]), 1)

    def test_author_only_does_not_confirm_reference(self):
        mario = self.target("Mario Damián Del Muro Silva")
        out = mod.scan(
            self.t2db,
            crawler=self.fake_crawler([
                row("Otra tesis", "Mario Damián Del Muro Silva")
            ]),
            delay=0,
        )
        result = next(x for x in out["results"] if x["author"] == mario["author"])
        self.assertEqual(result["status"], "not-found-in-completed-cucsh-master-catalog")
        self.assertEqual(len(result["authorOnly"]), 1)
        self.assertFalse(result["libraryCatalogReferenceConfirmed"])

    def test_title_only_does_not_confirm_reference(self):
        mario = self.target("Mario Damián Del Muro Silva")
        out = mod.scan(
            self.t2db,
            crawler=self.fake_crawler([
                row(mario["title"], "Otra Persona")
            ]),
            delay=0,
        )
        result = next(x for x in out["results"] if x["author"] == mario["author"])
        self.assertEqual(len(result["titleOnly"]), 1)
        self.assertFalse(result["libraryCatalogReferenceConfirmed"])

    def test_complete_negative_scan_is_not_nonexistence_claim(self):
        out = mod.scan(
            self.t2db,
            crawler=self.fake_crawler([
                row("Tesis no relacionada", "Persona Distinta", program="Maestría en Derecho")
            ]),
            delay=0,
        )
        self.assertFalse(out["negativeResultMeansNonexistence"])
        self.assertEqual(out["metrics"]["exactTitleAuthorMatches"], 0)
        self.assertTrue(
            all(
                result["status"] == "not-found-in-completed-cucsh-master-catalog"
                for result in out["results"]
            )
        )

    def test_incomplete_pagination_is_rejected(self):
        bad = {
            "landingRequestedUrl": "x",
            "landingFinalUrl": "x",
            "lastPageIndex": 2,
            "pagesFetched": 1,
            "rows": [row("x", "y")],
            "pageEvidence": [{"page": 0, "rows": 1}],
        }
        with self.assertRaises(ValueError):
            mod.scan(self.t2db, crawler=lambda **kwargs: bad, delay=0)


if __name__ == "__main__":
    unittest.main()
