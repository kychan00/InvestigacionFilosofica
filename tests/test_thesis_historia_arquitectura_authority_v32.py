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

    def test_v32_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v32",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            32,
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

    def test_base_mca_baseline_review_is_superseded_by_v41_include(self):
        resolved = canonical.resolve_program(
            "Maestría en Ciencias de la Arquitectura",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            self.baseline["expected"]["baseProgramRef"],
        )
        self.assertEqual(
            self.baseline["expected"]["baseProgramAdmissionState"],
            "review",
        )
        self.assertEqual(resolved["admissionState"], "include")

    def test_v32_conservation_baseline_is_preserved_under_v35(self):
        self.assertEqual(
            self.baseline["expected"]["conservationHistoricalAdmissionState"],
            "review",
        )
        resolved = canonical.resolve_program(
            "Maestría en Conservación del Patrimonio Edificado",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            self.baseline["expected"]["conservationHistoricalRef"],
        )
        self.assertEqual(resolved["admissionState"], "include")

    def test_active_metadata_confidence_is_v5(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(policy["policyRevision"], "2026-11-02.v5")

    def test_v32_scope_baseline_is_preserved_under_scope_v5(self):
        scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            self.baseline["scopePolicyRevision"],
            "2026-11-02.v4",
        )
        self.assertEqual(scope["policyRevision"], "2026-11-02.v5")


if __name__ == "__main__":
    unittest.main()
