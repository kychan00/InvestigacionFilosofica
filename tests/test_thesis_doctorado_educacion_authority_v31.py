"""T2AY — Doctorado en Educación Program Authority V31."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class DoctoradoEducacionAuthorityV31Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "doctorado-educacion-authority-v31-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )
        cls.scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v31_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v31",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            31,
        )

    def test_doctorado_educacion_is_exact_exclude(self):
        program = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(program["canonicalName"], "Doctorado en Educación")
        self.assertEqual(program["admissionState"], "exclude")
        self.assertEqual(program["academicUnits"], ["CUCSH"])
        self.assertEqual(program["observedCount"], 73)
        self.assertEqual(
            program["observedThesisYears"],
            {"min": 2005, "max": 2024},
        )
        self.assertEqual(
            {
                canonical.normalize_key(alias)
                for alias in program["aliases"]
            },
            {"doctorado en educacion"},
        )

    def test_later_education_decisions_preserve_v31(self):
        states = {
            p["id"]: p["admissionState"]
            for p in self.registry["programs"]
            if p["id"] in {
                "program:udg:mae-investigacion-educativa",
                "program:udg:doc-cognicion-aprendizaje",
            }
        }
        self.assertEqual(
            states,
            {
                "program:udg:mae-investigacion-educativa": "exclude",
                "program:udg:doc-cognicion-aprendizaje": "review",
            },
        )

    def test_v31_scope_baseline_is_preserved_under_scope_v5(self):
        self.assertEqual(
            self.baseline["scopePolicyRevision"],
            "2026-11-02.v5",
        )
        self.assertEqual(self.scope["policyRevision"], "2026-11-02.v5")
        row = next(
            row
            for row in self.scope["rows"]
            if row["id"] == "scope:education-research"
        )
        self.assertEqual(row["boundaryState"], "boundary-review")
        self.assertEqual(
            row["programKeys"],
            ["doctorado en cognicion y aprendizaje"],
        )

    def test_metadata_confidence_stays_v4(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(policy["policyRevision"], "2026-11-02.v5")


if __name__ == "__main__":
    unittest.main()
