"""T2BI — Licenciatura en Historia del Arte Authority V39."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class HistoriaArteAuthorityV39Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "historia-arte-authority-v39-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_active_registry_is_v39(self):
        self.assertEqual(
            self.registry["registryRevision"],
            self.baseline["registryRevision"],
        )

    def test_historia_arte_variants_are_exact_include(self):
        for raw in (
            "Licenciatura en Historia del Arte",
            "LICENCIATURA EN HISTORIA DEL ARTE",
        ):
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "include")

    def test_target_authority_metadata_is_stable(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(target["observedCount"], 2)
        self.assertEqual(target["academicUnits"], ["CUTONALA"])
        self.assertEqual(target["disciplineFamily"], "historia-arte")
        self.assertEqual(target["lifecycleState"], "active")

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
