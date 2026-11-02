"""T2BA — historical Licenciatura en la Docencia del Inglés Authority V33."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class DocenciaInglesHistoricalAuthorityV33Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "docencia-ingles-historical-authority-v33-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_active_registry_is_v33(self):
        self.assertEqual(
            self.registry["registryRevision"],
            self.baseline["registryRevision"],
        )

    def test_exact_historical_name_resolves_to_historical_include(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN LA DOCENCIA DEL INGLÉS",
            self.registry,
        )
        self.assertEqual(resolved["programRef"], self.baseline["programRef"])
        self.assertEqual(resolved["admissionState"], "include")

    def test_historical_authority_remains_separate_from_current_lidile(self):
        historical = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        current = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["successorProgramRef"]
        )
        self.assertEqual(historical["lifecycleState"], "historical")
        self.assertEqual(
            historical["possibleSuccessorRef"],
            current["id"],
        )
        self.assertNotEqual(historical["id"], current["id"])
        self.assertEqual(current["admissionState"], "include")
        self.assertNotIn(
            canonical.normalize_key(historical["canonicalName"]),
            {
                canonical.normalize_key(alias)
                for alias in current["aliases"]
            },
        )

    def test_semiescolarized_authority_remains_separate(self):
        semiescolarized = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["semiescolarizedProgramRef"]
        )
        self.assertEqual(semiescolarized["admissionState"], "include")
        self.assertNotEqual(
            semiescolarized["id"],
            self.baseline["programRef"],
        )

    def test_historical_authority_keeps_exact_observed_scope(self):
        historical = next(
            p for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(historical["academicUnits"], ["CUCSH"])
        self.assertEqual(historical["observedCount"], 1)
        self.assertEqual(
            historical["observedThesisYears"],
            {"min": 2006, "max": 2006},
        )
        self.assertEqual(
            {
                canonical.normalize_key(alias)
                for alias in historical["aliases"]
            },
            {"licenciatura en la docencia del ingles"},
        )

    def test_metadata_confidence_stays_v4(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(
            policy["policyRevision"],
            self.baseline["programMetadataEvidenceRevision"],
        )

    def test_scope_policy_stays_v4(self):
        scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            scope["policyRevision"],
            self.baseline["scopePolicyRevision"],
        )


if __name__ == "__main__":
    unittest.main()
