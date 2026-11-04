"""Regression tests for the public Philosophy thesis discovery view."""
from __future__ import annotations
import importlib.util, json, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/thesis/build_philosophy_public_index_v1.py"
CURATED = ROOT / "scripts/thesis/config/philosophy-curated-content-v1.json"
SUPPLEMENT = ROOT / "scripts/thesis/config/philosophy-official-supplement-v1.json"
CORROBORATION = ROOT / "scripts/thesis/config/philosophy-external-corroboration-v1.json"

spec = importlib.util.spec_from_file_location("philosophy_public", BUILDER)
builder = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(builder)


class PhilosophyPublicIndexV1Test(unittest.TestCase):
    def row(self, index, title, authors, year, program, program_ref, degree):
        return {
            "id": f"thesis:work:{index:08d}", "title": title, "authors": authors,
            "directors": [], "year": year, "dateQuality": "valid" if year else "unknown",
            "program": program, "programRef": program_ref, "degree": degree, "unit": "CUCSH",
            "abstractExcerpt": "", "keywords": [],
            "sourceUrl": f"https://hdl.handle.net/20.500.12104/{100000 + index}",
            "handle": f"20.500.12104/{100000 + index}",
        }

    def fixture_demo(self):
        supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
        refs = supplement["targetProgramRefs"]
        ref_for = {"Licenciatura en Filosofía": refs[0], "Maestría en Estudios Filosóficos": refs[1]}
        rows = []
        for index, seed in enumerate(supplement["seedRecords"]):
            rows.append(self.row(
                index + 1, seed["title"], seed["authors"], int(seed["year"]),
                seed["program"], ref_for[seed["program"]],
                "maestria" if seed["program"].startswith("Maestría") else "licenciatura",
            ))
        rows += [
            self.row(5, "Examen breve de dos paradojas de la teoría de conjuntos", ["Pérez Armendáriz, Adriana"], 2006, "Maestría en Filosofía", refs[2], "maestria"),
            self.row(6, "Qvaestiones qvodlibetales de historiae philosiphia.", ["Favila Vega, Víctor Manuel"], 2005, "Maestría en Filosofía", refs[2], "maestria"),
            self.row(7, "Hacia una interpretación de las condiciones y posibilidades de la filosofía en México", ["Hernández Magaña, Gilberto"], None, "Licenciatura en Filosofía", refs[0], "licenciatura"),
            self.row(8, "La transformación de la conciencia de los personajes en el cuento de Juan Rulfo: “¡Diles que no me maten!” a la luz de los postulados de Paul Ricoeur", ["Orozco Celis, Beatriz Eugenia"], 2013, "Maestría en Estudios de Literatura Mexicana", "program:udg:mae-literatura-mexicana", "maestria"),
        ]
        while len(rows) < 566:
            i = len(rows) + 1
            rows.append(self.row(i, f"Tesis general de Humanidades {i}", [f"Autora {i}"], 2020, "Maestría en Historia", "program:udg:mae-historia", "maestria"))
        return {
            "schemaVersion": "thesis-demo-index-v1", "sourceRelease": "thesis-effective-corpus-v2",
            "sourceGzipSha256": "fixture", "programAuthorityRevision": "2026-11-03.v47",
            "referenceOnly": True, "totalIncluded": 566, "totalCanonical": 27580, "records": rows,
        }

    def build(self):
        return builder.build_index(
            self.fixture_demo(),
            json.loads(CURATED.read_text(encoding="utf-8")),
            json.loads(SUPPLEMENT.read_text(encoding="utf-8")),
            json.loads(CORROBORATION.read_text(encoding="utf-8")),
        )

    def test_builds_union_without_rewriting_actual_programs(self):
        index = self.build()
        self.assertEqual(index["metrics"]["records"], 18)
        self.assertEqual(index["metrics"]["byStatus"], {"include": 16, "review": 2})
        self.assertEqual(index["metrics"]["actualProgramsRepresented"], 10)
        programs = {row["programRef"]: row for row in index["documentedPhilosophyPrograms"]}
        self.assertEqual(programs["program:udg:lic-filosofia"]["records"], 6)
        self.assertEqual(programs["program:udg:mae-estudios-filosoficos"]["records"], 3)
        self.assertEqual(programs["program:udg:mae-filosofia-historica"]["records"], 2)
        by_title = {row["title"]: row for row in index["records"]}
        tics = by_title["Filosofía y TICS. La experiencia de un curso de seminario de filosofía en bachillerato, presencial y con ayuda de la plataforma virtual Moodle, en una institución privada de la Ciudad de Guadalajara"]
        self.assertEqual(tics["program"], "Maestría en Tecnologías para el Aprendizaje")
        ricoeur = next(row for row in index["records"] if "Paul Ricoeur" in row["title"])
        self.assertEqual(ricoeur["canonicalWorkId"], "thesis:work:00000008")
        self.assertEqual(ricoeur["program"], "Maestría en Estudios de Literatura Mexicana")

    def test_review_is_visible_but_not_promoted(self):
        review = [row for row in self.build()["records"] if row["philosophyStatus"] == "review"]
        self.assertEqual(len(review), 2)
        self.assertTrue(all(row["philosophyRole"] == "program-core-candidate" for row in review))
        self.assertTrue(all(row["canonicalWorkId"] is None for row in review))

    def test_t2ct_projects_corroboration_only_on_existing_review_records(self):
        index = self.build()
        self.assertEqual(index["metrics"]["corroboratedReviewRecords"], 2)
        rows = [row for row in index["records"] if row.get("externalCorroboration")]
        self.assertEqual({row["philosophyStatus"] for row in rows}, {"review"})
        self.assertEqual(len(rows), 2)
        by_author = {row["authors"][0]: row for row in rows}
        galarza = by_author["Daniel Galarza Santiago"]["externalCorroboration"]
        adriel = by_author["Adriel Manuel Hernández Guzmán"]["externalCorroboration"]
        self.assertFalse(galarza["identityConfirmed"])
        self.assertFalse(galarza["physicalLocationConfirmed"])
        self.assertGreaterEqual(len(galarza["evidenceUrls"]), 1)
        self.assertFalse(adriel["identityConfirmed"])
        self.assertFalse(adriel["physicalLocationConfirmed"])
        self.assertEqual(len(adriel["evidenceUrls"]), 1)

    def test_corroboration_does_not_create_new_public_records(self):
        index = self.build()
        self.assertEqual(index["metrics"]["records"], 18)
        titles = {row["title"] for row in index["records"]}
        self.assertNotIn("El significado del significante \"bueno\" en la obra Ética de la liberación en la edad de la globalización y la exclusión de Enrique Dussel", titles)
        self.assertNotIn("Alexander von Humboldt: un ensayo sobre la antropología filosófica de lo mexicano", titles)

    def test_reference_only_url_guard(self):
        self.assertIsNone(builder.safe_reference_url("https://example.org/thesis.pdf"))
        self.assertIsNone(builder.safe_reference_url("https://example.org/bitstream/123"))
        self.assertEqual(builder.safe_reference_url("https://philarchive.org/rec/GALFDL-5"), "https://philarchive.org/rec/GALFDL-5")


if __name__ == "__main__":
    unittest.main()
