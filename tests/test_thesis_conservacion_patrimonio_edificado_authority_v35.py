"""T2BE — Conservación del Patrimonio Edificado Authority V35."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class ConservacionPatrimonioEdificadoAuthorityV35Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "conservacion-patrimonio-edificado-authority-v35-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_active_registry_is_v35(self):
        self.assertEqual(
            self.registry["registryRevision"],
            self.baseline["registryRevision"],
        )

    def test_historical_conservation_is_exact_include(self):
        resolved = canonical.resolve_program(
            "Maestría en Conservación del Patrimonio Edificado",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            self.baseline["programRef"],
        )
        self.assertEqual(resolved["admissionState"], "include")

    def test_base_mca_remains_review_and_separate(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        base = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["baseProgramRef"]
        )
        self.assertEqual(base["admissionState"], "review")
        self.assertEqual(target["possibleSuccessorRef"], base["id"])
        self.assertNotEqual(target["id"], base["id"])
        self.assertNotIn(
            canonical.normalize_key(target["canonicalName"]),
            {
                canonical.normalize_key(alias)
                for alias in base["aliases"]
            },
        )

    def test_historical_history_authority_remains_include(self):
        history = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["historyHistoricalRef"]
        )
        self.assertEqual(history["admissionState"], "include")
        self.assertEqual(history["observedCount"], 4)

    def test_scope_and_metadata_policies_stay_v4(self):
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
