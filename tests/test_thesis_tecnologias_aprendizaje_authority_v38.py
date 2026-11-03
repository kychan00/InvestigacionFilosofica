"""T2BH — Maestría en Tecnologías para el Aprendizaje Authority V38."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class TecnologiasAprendizajeAuthorityV38Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "tecnologias-aprendizaje-authority-v38-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v38_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v38",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            38,
        )

    def test_mta_variants_are_exact_exclude(self):
        for raw in (
            "Maestría en Tecnologías para el Aprendizaje",
            "MAESTRIA EN TECNOLOGIAS PARA EL APRENDIZAJE",
            "MAESTRIA EN TECNOLOGÍAS PARA EL APRENDIZAJE",
            "Maestría en Tecnologias para el Aprendizaje",
        ):
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "exclude")

    def test_target_authority_metadata_is_stable(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(target["observedCount"], 266)
        self.assertEqual(
            target["academicUnits"],
            ["CUCEA", "CUVALLES", "CUCOSTA"],
        )
        self.assertEqual(
            target["disciplineFamily"],
            "educacion-tecnologia-aprendizaje",
        )
        self.assertEqual(target["lifecycleState"], "active")
        self.assertEqual(
            target["observedThesisYears"],
            {"min": 2004, "max": 2026},
        )

    def test_education_sibling_decisions_remain_distinct(self):
        expected = self.baseline["expected"]["siblingEducation"]
        by_id = {p["id"]: p for p in self.registry["programs"]}
        for program_ref, contract in expected.items():
            with self.subTest(program_ref=program_ref):
                self.assertEqual(
                    by_id[program_ref]["admissionState"],
                    contract["admissionState"],
                )
                self.assertEqual(
                    by_id[program_ref]["observedCount"],
                    contract["works"],
                )

    def test_scope_and_metadata_revisions_remain_stable(self):
        metadata = canonical.load_program_metadata_evidence_policy()
        scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            metadata["policyRevision"],
            self.baseline["programMetadataEvidenceRevision"],
        )
        self.assertEqual(
            scope["policyRevision"],
            self.baseline["scopePolicyRevision"],
        )


if __name__ == "__main__":
    unittest.main()
