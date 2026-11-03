"""T2BW: Estudios de Género work 001 primary-source candidate adjudication."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
MODULE = THESIS / "build_boundary_adjudication_ledger_v1.py"
spec = importlib.util.spec_from_file_location("t2bw_ledger", MODULE)
ledger = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(ledger)

BATCH_PATH = THESIS / "config" / "estudios-genero-adjudication-batch-001-v1.json"
BASELINE_PATH = THESIS / "config" / "estudios-genero-adjudication-baseline-v1.json"


class EstudiosGeneroAdjudicationT2BWTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.batch = json.loads(BATCH_PATH.read_text(encoding="utf-8"))
        cls.baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
        cls.work = cls.batch["works"][0]

    def queue(self, status="review"):
        return {
            "schemaVersion": "thesis-boundary-work-review-queue-v1",
            "policyRevision": self.batch["workReviewPolicyRevision"],
            "decisionConstraint": "boundary-work-review-does-not-change-admission",
            "items": [{
                "workId": self.work["workId"],
                "programRef": self.batch["programRef"],
                "title": "El uso del lenguaje incluyente y no sexista en el aula",
                "handle": self.work["handle"],
                "projectedAdmissionStatus": status,
                "workReviewState": "pending-primary-source-review",
            }],
        }

    def test_real_batch_is_fulltext_grounded_and_non_admissive(self):
        self.assertTrue(ledger.validate_batch(self.batch))
        self.assertEqual(self.batch["phase"], "T2BW")
        self.assertEqual(self.batch["programRef"], "program:udg:mae-estudios-genero")
        self.assertEqual(len(self.batch["works"]), 1)
        self.assertEqual(self.work["workId"], "thesis:work:00002062")
        self.assertEqual(self.work["primarySourceAccess"], "available")
        self.assertEqual(self.work["primarySourcePages"], 219)
        self.assertEqual(
            self.work["primarySourceSha256"],
            "8ad834865aa3b34a34dd7cf205b8528d6b7dd6b8a87a1a584d35d84404b2bcd2",
        )
        self.assertEqual(self.work["candidateDecision"], "include-candidate")
        self.assertEqual(
            self.work["candidateDecisionBasis"],
            "official-thesis-fulltext-reviewed",
        )
        self.assertEqual(self.work["humanValidationStatus"], "pending-user-merge")
        self.assertEqual(
            self.batch["decisionConstraint"],
            "batch-does-not-change-admission",
        )

    def test_available_fulltext_can_propose_candidate_without_admission_change(self):
        result = ledger.build_ledger(self.queue(), self.batch)
        self.assertEqual(result["metrics"], self.baseline["expected"]["ledger"])
        entry = result["entries"][0]
        self.assertEqual(entry["adjudicationState"], "candidate-proposed")
        self.assertEqual(entry["candidateDecision"], "include-candidate")
        self.assertEqual(entry["humanValidationStatus"], "pending-user-merge")
        self.assertFalse(entry["admissionChangeRequested"])
        self.assertEqual(entry["projectedAdmissionStatus"], "review")
        self.assertEqual(
            entry["decisionConstraint"], "ledger-does-not-change-admission"
        )

    def test_candidate_cannot_be_created_from_restricted_source(self):
        bad = json.loads(json.dumps(self.batch))
        bad["works"][0]["primarySourceAccess"] = "restricted"
        with self.assertRaisesRegex(
            ValueError, "Candidate decision requires available primary source"
        ):
            ledger.validate_batch(bad)

    def test_candidate_requires_fulltext_basis(self):
        bad = json.loads(json.dumps(self.batch))
        bad["works"][0]["candidateDecisionBasis"] = "abstract-only"
        with self.assertRaisesRegex(
            ValueError, "Candidate decision requires fulltext basis"
        ):
            ledger.validate_batch(bad)

    def test_candidate_cannot_mutate_non_review_input(self):
        with self.assertRaisesRegex(ValueError, "must remain REVIEW"):
            ledger.build_ledger(self.queue(status="include"), self.batch)


if __name__ == "__main__":
    unittest.main()
