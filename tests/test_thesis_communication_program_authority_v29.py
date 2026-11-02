"""T2AW — Communication Program Authority V29 regression tests."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class CommunicationProgramAuthorityV29Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "communication-program-authority-v29-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )
        cls.scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_active_registry_is_v29(self):
        self.assertEqual(
            self.registry["registryRevision"],
            self.baseline["registryRevision"],
        )

    def test_communication_authority_is_exact_exclude(self):
        matches = [
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        ]
        self.assertEqual(len(matches), 1)
        program = matches[0]
        self.assertEqual(program["canonicalName"], "Maestría en Comunicación")
        self.assertEqual(program["admissionState"], "exclude")
        self.assertEqual(program["level"], "maestria")
        self.assertEqual(program["academicUnits"], ["CUCSH"])
        self.assertEqual(program["observedCount"], 67)
        self.assertEqual(
            {
                canonical.normalize_key(alias)
                for alias in program["aliases"]
            },
            {"maestria en comunicacion"},
        )

    def test_scope_matrix_v3_is_outside_scope(self):
        self.assertEqual(
            self.scope["policyRevision"],
            self.baseline["scopePolicyRevision"],
        )
        row = next(
            row
            for row in self.scope["rows"]
            if row["id"] == "scope:communication-culture"
        )
        self.assertEqual(row["boundaryState"], "outside-scope")
        self.assertEqual(
            row["programKeys"],
            ["maestria en comunicacion"],
        )

    def test_metadata_confidence_policy_stays_v4(self):
        policy = canonical.load_program_metadata_evidence_policy()
        self.assertEqual(policy["policyRevision"], "2026-11-02.v4")


if __name__ == "__main__":
    unittest.main()
