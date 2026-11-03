"""T2BF — Maestría en Investigación Educativa Authority V36."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class InvestigacionEducativaAuthorityV36Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "investigacion-educativa-authority-v36-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_v36_baseline_remains_valid_under_later_registry(self):
        self.assertEqual(
            self.baseline["registryRevision"],
            "2026-11-02.v36",
        )
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            36,
        )

    def test_maestria_investigacion_educativa_is_exact_exclude(self):
        for raw in (
            "Maestría en Investigación Educativa",
            "MAESTRIA EN INVESTIGACION EDUCATIVA",
        ):
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    self.baseline["programRef"],
                )
                self.assertEqual(resolved["admissionState"], "exclude")

    def test_target_authority_metadata_is_stable(self):
        target = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["programRef"]
        )
        self.assertEqual(target["observedCount"], 34)
        self.assertEqual(target["academicUnits"], ["CUCSH"])
        self.assertEqual(
            target["disciplineFamily"],
            "investigacion-educativa-ciencias-sociales-humanidades",
        )
        self.assertEqual(target["lifecycleState"], "active")
        self.assertIsNone(target.get("possibleSuccessorRef"))

    def test_cognicion_aprendizaje_remains_review(self):
        sibling = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["expected"]["siblingCognicionRef"]
        )
        self.assertEqual(
            sibling["admissionState"],
            self.baseline["expected"]["siblingCognicionAdmissionState"],
        )
        self.assertEqual(
            sibling["observedCount"],
            self.baseline["expected"]["siblingCognicionWorks"],
        )

    def test_doctorado_educacion_remains_exclude(self):
        sibling = next(
            p
            for p in self.registry["programs"]
            if p["id"] == self.baseline["expected"]["doctoradoEducacionRef"]
        )
        self.assertEqual(
            sibling["admissionState"],
            self.baseline["expected"]["doctoradoEducacionAdmissionState"],
        )
        self.assertEqual(
            sibling["observedCount"],
            self.baseline["expected"]["doctoradoEducacionWorks"],
        )

    def test_scope_and_metadata_revisions(self):
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

        education = next(
            row for row in scope["rows"]
            if row["id"] == "scope:education-research"
        )
        self.assertEqual(
            education["programKeys"],
            ["doctorado en cognicion y aprendizaje"],
        )

        outside = next(
            row for row in scope["rows"]
            if row["id"] == "scope:education-investigacion-maestria"
        )
        self.assertEqual(outside["boundaryState"], "outside-scope")
        self.assertEqual(
            outside["programKeys"],
            ["maestria en investigacion educativa"],
        )


if __name__ == "__main__":
    unittest.main()
