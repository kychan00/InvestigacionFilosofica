"""T2BJ — MCA Conservación del Patrimonio Edificado Authority V40."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class McaConservacionAuthorityV40Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "mca-conservacion-authority-v40-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v40_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v40",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            40,
        )

    def test_all_exact_conservation_aliases_resolve_to_granular_include(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(target["admissionState"], "include")
        self.assertEqual(target["observedCount"], 35)
        self.assertEqual(target["academicUnits"], ["CUAAD"])
        self.assertEqual(target["disciplineFamily"], "patrimonio-conservacion")
        self.assertEqual(len(target["aliases"]), 14)

        for raw in target["aliases"]:
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "include")

    def test_base_mca_current_authority_is_include_after_v41(self):
        base = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["baseProgramRef"]
        )
        self.assertEqual(base["admissionState"], "include")
        self.assertEqual(base["observedCount"], 34)
        self.assertFalse(
            any(
                "conserv" in canonical.normalize_key(alias)
                or "patrimonio" in canonical.normalize_key(alias)
                for alias in base["aliases"]
            )
        )

    def test_neighboring_authorities_remain_distinct(self):
        historical = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["historicalStandaloneRef"]
        )
        history_orientation = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["historyOrientationRef"]
        )
        self.assertEqual(historical["admissionState"], "include")
        self.assertEqual(historical["observedCount"], 5)
        self.assertEqual(history_orientation["admissionState"], "include")
        self.assertEqual(history_orientation["observedCount"], 16)
        self.assertNotEqual(historical["id"], self.baseline["programRef"])
        self.assertNotEqual(history_orientation["id"], self.baseline["programRef"])

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
            self.baseline["programMetadataEvidenceRevision"],
            "2026-11-02.v4",
        )
        self.assertEqual(metadata["policyRevision"], "2026-11-02.v5")
        self.assertEqual(
            scope["policyRevision"],
            self.baseline["scopePolicyRevision"],
        )


if __name__ == "__main__":
    unittest.main()
