"""T2AZ — Historia de la Arquitectura Mexicana Authority V32."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))
import build_canonical_corpus_v1 as canonical


class HistoriaArquitecturaAuthorityV32Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "historia-arquitectura-authority-v32-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_active_registry_is_v32(self):
        self.assertEqual(
            self.registry["registryRevision"],
            self.baseline["registryRevision"],
        )

    def test_historical_authority_is_exact_include(self):
        resolved = canonical.resolve_program(
            "Maestría en Historia de la Arquitectura Mexicana",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            self.baseline["programRef"],
        )
        self.assertEqual(resolved["admissionState"], "include")

    def test_base_mca_remains_review(self):
        resolved = canonical.resolve_program(
            "Maestría en Ciencias de la Arquitectura",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            self.baseline["expected"]["baseProgramRef"],
        )
        self.assertEqual(
            resolved["admissionState"],
            self.baseline["expected"]["baseProgramAdmissionState"],
        )

    def test_conservation_historical_remains_review(self):
        resolved = canonical.resolve_program(
            "Maestría en Conservación del Patrimonio Edificado",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            self.baseline["expected"]["conservationHistoricalRef"],
        )
        self.assertEqual(
            resolved["admissionState"],
            self.baseline["expected"]["conservationHistoricalAdmissionState"],
        )

    def test_metadata_confidence_stays_v4(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(policy["policyRevision"], "2026-11-02.v4")

    def test_scope_policy_stays_v4(self):
        scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(scope["policyRevision"], "2026-11-02.v4")


if __name__ == "__main__":
    unittest.main()
