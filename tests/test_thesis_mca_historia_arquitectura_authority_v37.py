"""T2BG — MCA Historia de la Arquitectura Mexicana Authority V37."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class MCAHistoriaArquitecturaAuthorityV37Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "mca-historia-arquitectura-authority-v37-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v37_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v37",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            37,
        )

    def test_history_orientation_variants_are_exact_include(self):
        variants = (
            "Maestría En Arquitectura; Orientacion En Historia De La Arquitectura Mexicana",
            "MAESTRIA EN CIENCIAS DE LA ARQUITECTURA CON ORIENTACION EN HISTORIA DE LA ARQUITECTURA MEXICANA",
            "Maestría En Ciencias De La Arquitectura Con Orientación En Historia De La Arquitectura Mexicana",
            "Maestría En Ciencias De La Arquitectura Orientación En Historia De La Arquitectura Mexicana",
            "Maestría En Ciencias De La Arquitectura Orientación En: Historia De La Arquitectura Mexicana",
            "Maestría En Ciencias De La Arquitectura Orientación Historia De La Arquitectura Mexicana",
        )
        for raw in variants:
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "include")

    def test_target_authority_metadata_is_stable(self):
        target = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(target["observedCount"], 16)
        self.assertEqual(target["academicUnits"], ["CUAAD"])
        self.assertEqual(target["disciplineFamily"], "historia-arquitectura")
        self.assertEqual(target["lifecycleState"], "active")
        self.assertEqual(
            target["observedThesisYears"],
            {"min": 1996, "max": 2019},
        )

    def test_base_mca_remains_review_without_history_aliases(self):
        base = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["baseProgramRef"]
        )
        self.assertEqual(base["admissionState"], "review")
        self.assertEqual(base["observedCount"], 96)
        self.assertEqual(
            base["observedThesisYears"],
            {"min": 1998, "max": 2021},
        )
        normalized_aliases = {
            canonical.normalize_key(alias)
            for alias in base["aliases"]
        }
        self.assertTrue(all(
            "historia de la arquitectura mexicana" not in alias
            for alias in normalized_aliases
        ))

    def test_historical_maestria_remains_separate_include(self):
        historical = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["historicalProgramRef"]
        )
        self.assertEqual(historical["admissionState"], "include")
        self.assertEqual(historical["observedCount"], 4)
        self.assertNotEqual(historical["id"], self.baseline["programRef"])
        self.assertEqual(
            historical.get("possibleSuccessorRef"),
            self.baseline["baseProgramRef"],
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
