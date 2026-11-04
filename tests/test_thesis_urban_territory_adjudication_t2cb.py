"""T2CB full-text grounded DCTS work-level candidate adjudication."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
MODULE = THESIS / "build_boundary_adjudication_ledger_v1.py"
spec = importlib.util.spec_from_file_location("t2cb_ledger", MODULE)
ledger = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(ledger)

BATCH = (
    THESIS
    / "config"
    / "urban-territory-adjudication-batch-002-reviewed-v1.json"
)
BASELINE = (
    THESIS
    / "config"
    / "urban-territory-adjudication-batch-002-reviewed-baseline-v1.json"
)


class UrbanTerritoryAdjudicationT2CBTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.batch = json.loads(BATCH.read_text(encoding="utf-8"))
        cls.baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
        cls.works = {
            item["workId"]: item
            for item in cls.batch["works"]
        }

    def queue(self):
        return {
            "schemaVersion": "thesis-boundary-work-review-queue-v1",
            "policyRevision": self.batch["workReviewPolicyRevision"],
            "decisionConstraint": (
                "boundary-work-review-does-not-change-admission"
            ),
            "items": [
                {
                    "workId": item["workId"],
                    "programRef": self.batch["programRef"],
                    "title": item["workId"],
                    "handle": item["handle"],
                    "projectedAdmissionStatus": "review",
                    "workReviewState": "pending-primary-source-review",
                }
                for item in self.batch["works"]
            ],
        }

    def test_real_batch_is_fulltext_grounded_and_non_admissive(self):
        self.assertTrue(ledger.validate_batch(self.batch))
        self.assertEqual(self.batch["phase"], "T2CB")
        self.assertEqual(
            self.batch["batchId"],
            "urban-territory-002-reviewed",
        )
        self.assertEqual(len(self.batch["works"]), 2)
        self.assertEqual(
            self.batch["decisionConstraint"],
            "batch-does-not-change-admission",
        )
        self.assertTrue(self.batch["humanValidationRequired"])
        self.assertEqual(
            self.batch["sourceCapture"]["artifactId"],
            13286768116,
        )

    def test_include_candidate_matches_captured_366_page_pdf(self):
        item = self.works["thesis:work:00024461"]
        self.assertEqual(item["primarySourceAccess"], "available")
        self.assertEqual(item["primarySourcePages"], 366)
        self.assertEqual(
            item["primarySourceSha256"],
            "b6ae86dfbeec25fc54507e1edb240e155d8f34bbb0c6a46953259064d1c71695",
        )
        self.assertEqual(
            item["candidateDecision"],
            "include-candidate",
        )
        self.assertEqual(
            item["candidateDecisionBasis"],
            "official-thesis-fulltext-reviewed",
        )
        rationale = item["candidateDecisionRationale"].lower()
        self.assertIn("ontology", rationale)
        self.assertIn("epistemology", rationale)
        self.assertIn("metatheoretical", rationale)

    def test_second_work_explicitly_retains_review(self):
        item = self.works["thesis:work:00024462"]
        self.assertEqual(item["primarySourceAccess"], "available")
        self.assertEqual(item["primarySourcePages"], 258)
        self.assertEqual(
            item["primarySourceSha256"],
            "c3df45c25348fa5929d9c170446a110cdf515df1bded228475bdb3c37aacc527",
        )
        self.assertEqual(item["candidateDecision"], "retain-review")
        self.assertEqual(
            item["candidateDecisionBasis"],
            "official-thesis-fulltext-reviewed",
        )
        rationale = item["candidateDecisionRationale"].lower()
        self.assertIn("identity", rationale)
        self.assertIn("urbanism", rationale)
        self.assertIn("public-space", rationale)

    def test_ledger_proposes_two_candidates_without_admission_change(self):
        result = ledger.build_ledger(self.queue(), self.batch)
        self.assertEqual(
            result["metrics"],
            self.baseline["expected"]["ledger"],
        )
        by_id = {
            item["workId"]: item
            for item in result["entries"]
        }
        self.assertEqual(
            by_id["thesis:work:00024461"]["candidateDecision"],
            "include-candidate",
        )
        self.assertEqual(
            by_id["thesis:work:00024462"]["candidateDecision"],
            "retain-review",
        )
        for entry in result["entries"]:
            self.assertEqual(
                entry["adjudicationState"],
                "candidate-proposed",
            )
            self.assertEqual(
                entry["humanValidationStatus"],
                "pending-user-merge",
            )
            self.assertEqual(
                entry["projectedAdmissionStatus"],
                "review",
            )
            self.assertFalse(entry["admissionChangeRequested"])


if __name__ == "__main__":
    unittest.main()
