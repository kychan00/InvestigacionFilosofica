"""T2CA DCTS accessible primary-source batch 002 regression gates."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
MODULE = THESIS / "build_boundary_adjudication_ledger_v1.py"
spec = importlib.util.spec_from_file_location("adjudication_ledger", MODULE)
ledger = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(ledger)


class UrbanTerritoryBatch002T2CATest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.batch = json.loads(
            (
                THESIS
                / "config"
                / "urban-territory-adjudication-batch-002-v1.json"
            ).read_text(encoding="utf-8")
        )
        cls.baseline = json.loads(
            (
                THESIS
                / "config"
                / "urban-territory-adjudication-batch-002-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_real_batch_is_available_but_non_admissive(self):
        self.assertTrue(ledger.validate_batch(self.batch))
        self.assertEqual(self.batch["phase"], "T2CA")
        self.assertEqual(self.batch["batchId"], "urban-territory-002")
        self.assertEqual(len(self.batch["works"]), 2)
        self.assertTrue(
            all(
                item["primarySourceAccess"] == "available"
                for item in self.batch["works"]
            )
        )
        self.assertTrue(
            all(item.get("candidateDecision") is None for item in self.batch["works"])
        )
        self.assertTrue(
            all(
                item["humanValidationStatus"] == "required"
                for item in self.batch["works"]
            )
        )

    def test_available_source_without_fulltext_decision_is_evidence_ready(self):
        queue = {
            "schemaVersion": "thesis-boundary-work-review-queue-v1",
            "policyRevision": self.batch["workReviewPolicyRevision"],
            "decisionConstraint": (
                "boundary-work-review-does-not-change-admission"
            ),
            "items": [
                {
                    "workId": item["workId"],
                    "programRef": self.batch["programRef"],
                    "title": f"Fixture {index}",
                    "handle": item["handle"],
                    "projectedAdmissionStatus": "review",
                    "workReviewState": "pending-primary-source-review",
                }
                for index, item in enumerate(self.batch["works"])
            ],
        }

        result = ledger.build_ledger(queue, self.batch)
        expected = self.baseline["expected"]["batchLedger"]
        metrics = result["metrics"]

        self.assertEqual(metrics["batchWorks"], expected["works"])
        self.assertEqual(
            metrics["primarySourceAccess"],
            expected["primarySourceAccess"],
        )
        self.assertEqual(
            metrics["adjudicationStates"],
            expected["adjudicationStates"],
        )
        self.assertEqual(
            metrics["candidateDecisions"],
            expected["candidateDecisions"],
        )
        self.assertEqual(
            metrics["humanValidation"],
            expected["humanValidation"],
        )
        self.assertEqual(metrics["admissionChanges"], 0)
        for entry in result["entries"]:
            self.assertEqual(
                entry["adjudicationState"],
                "candidate-evidence-ready",
            )
            self.assertIsNone(entry["candidateDecision"])
            self.assertEqual(entry["projectedAdmissionStatus"], "review")
            self.assertFalse(entry["admissionChangeRequested"])

    def test_password_protected_probe_is_not_in_batch(self):
        excluded = self.batch["excludedAccessProbe"]
        work_ids = {item["workId"] for item in self.batch["works"]}
        self.assertEqual(excluded["workId"], "thesis:work:00024463")
        self.assertNotIn(excluded["workId"], work_ids)
        self.assertIn("password", excluded["reason"].lower())


if __name__ == "__main__":
    unittest.main()
