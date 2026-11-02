"""T2AX — DELL Lingüística Aplicada lineage resolution V30."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class DellLinguisticaLineageV30Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "dell-linguistica-lineage-v30-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v30_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v30",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            30,
        )

    def test_orientation_and_base_resolve_to_same_include_authority(self):
        for raw in (
            "Doctorado en Estudios Literarios y Lingüísticos",
            "DOCTORADO EN ESTUDIOS LITERARIOS Y LINGÜISTICOS",
            (
                "Doctorado en Estudios Literarios y Lingüísticos "
                "con Orientación en Lingüística Aplicada"
            ),
            (
                "DOCTORADO EN ESTUDIOS LITERARIOS Y LINGÜÍSTICOS "
                "CON ORIENTACIÓN EN LINGÜÍSTICA APLICADA"
            ),
        ):
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "include")

    def test_provisional_orientation_authority_removed(self):
        self.assertFalse(
            any(
                p["id"] == self.baseline["removedProvisionalProgramRef"]
                for p in self.registry["programs"]
            )
        )

    def test_base_authority_tracks_two_observed_works(self):
        program = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(program["observedCount"], 2)
        self.assertEqual(
            program["observedThesisYears"],
            self.baseline["expected"]["observedYears"],
        )
        self.assertEqual(program["lifecycleState"], "active")
        self.assertEqual(program["academicUnits"], ["CUCSH"])

    def test_metadata_confidence_policy_stays_v4(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(policy["policyRevision"], "2026-11-02.v4")


if __name__ == "__main__":
    unittest.main()
