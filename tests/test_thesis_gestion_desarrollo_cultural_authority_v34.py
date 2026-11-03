"""T2BB — Maestría en Gestión y Desarrollo Cultural Authority V34."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class GestionDesarrolloCulturalAuthorityV34Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "gestion-desarrollo-cultural-authority-v34-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v34_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v34",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            34,
        )

    def test_exact_program_resolves_to_include(self):
        for raw in (
            "Maestría en Gestión y Desarrollo Cultural",
            "MAESTRIA EN GESTION Y DESARROLLO CULTURAL",
        ):
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "include")

    def test_cultural_management_programs_remain_separate(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        sibling = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["siblingProgramRef"]
        )
        self.assertNotEqual(target["id"], sibling["id"])
        self.assertEqual(target["admissionState"], "include")
        self.assertEqual(sibling["admissionState"], "include")
        self.assertEqual(target["disciplineFamily"], "gestion-cultural")
        self.assertEqual(sibling["disciplineFamily"], "gestion-cultural")
        self.assertNotEqual(
            {
                canonical.normalize_key(alias)
                for alias in target["aliases"]
            },
            {
                canonical.normalize_key(alias)
                for alias in sibling["aliases"]
            },
        )
        self.assertIsNone(target.get("possibleSuccessorRef"))
        self.assertIsNone(sibling.get("possibleSuccessorRef"))

    def test_target_authority_freezes_full_inventory_dimensions(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(target["academicUnits"], ["CUAAD"])
        self.assertEqual(target["observedCount"], 40)
        self.assertEqual(
            target["observedThesisYears"],
            {"min": 2008, "max": 2021},
        )

    def test_metadata_confidence_stays_v4(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(
            policy["policyRevision"],
            self.baseline["programMetadataEvidenceRevision"],
        )

    def test_v34_scope_baseline_is_preserved_under_scope_v5(self):
        scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            self.baseline["scopePolicyRevision"],
            "2026-11-02.v5",
        )
        self.assertEqual(scope["policyRevision"], "2026-11-02.v5")


if __name__ == "__main__":
    unittest.main()
