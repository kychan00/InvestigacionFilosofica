"""T2BD work adjudication ledger regression gates."""
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


class BoundaryAdjudicationLedgerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.batch = json.loads(
            (
                THESIS
                / "config"
                / "urban-territory-adjudication-batch-001-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_real_batch_is_non_admissive_and_human_validated(self):
        self.assertTrue(ledger.validate_batch(self.batch))
        self.assertEqual(
            self.batch["decisionConstraint"],
            "batch-does-not-change-admission",
        )
        self.assertTrue(self.batch["humanValidationRequired"])
        self.assertEqual(len(self.batch["works"]), 7)
        self.assertTrue(
            all(
                item["primarySourceAccess"] == "restricted"
                for item in self.batch["works"]
            )
        )

    def test_restricted_primary_source_cannot_create_candidate(self):
        work = self.batch["works"][0]
        queue = {
            "schemaVersion": "thesis-boundary-work-review-queue-v1",
            "policyRevision": self.batch["workReviewPolicyRevision"],
            "decisionConstraint": (
                "boundary-work-review-does-not-change-admission"
            ),
            "items": [
                {
                    "workId": work["workId"],
                    "programRef": self.batch["programRef"],
                    "title": "Example",
                    "handle": work["handle"],
                    "projectedAdmissionStatus": "review",
                    "workReviewState": "pending-primary-source-review",
                }
            ],
        }

        result = ledger.build_ledger(
            queue,
            {
                **self.batch,
                "works": [work],
            },
        )

        self.assertEqual(result["metrics"]["batchWorks"], 1)
        self.assertEqual(
            result["metrics"]["primarySourceAccess"],
            {"restricted": 1},
        )
        self.assertEqual(
            result["metrics"]["adjudicationStates"],
            {"blocked-primary-source-access": 1},
        )
        self.assertEqual(
            result["metrics"]["candidateDecisions"],
            {"none": 1},
        )
        self.assertEqual(result["metrics"]["admissionChanges"], 0)

        entry = result["entries"][0]
        self.assertIsNone(entry["candidateDecision"])
        self.assertEqual(entry["humanValidationStatus"], "required")
        self.assertFalse(entry["admissionChangeRequested"])
        self.assertEqual(entry["projectedAdmissionStatus"], "review")

    def test_non_review_work_is_rejected(self):
        work = self.batch["works"][0]
        queue = {
            "schemaVersion": "thesis-boundary-work-review-queue-v1",
            "policyRevision": self.batch["workReviewPolicyRevision"],
            "decisionConstraint": (
                "boundary-work-review-does-not-change-admission"
            ),
            "items": [
                {
                    "workId": work["workId"],
                    "programRef": self.batch["programRef"],
                    "title": "Example",
                    "handle": work["handle"],
                    "projectedAdmissionStatus": "include",
                    "workReviewState": "pending-primary-source-review",
                }
            ],
        }

        with self.assertRaisesRegex(ValueError, "must remain REVIEW"):
            ledger.build_ledger(
                queue,
                {
                    **self.batch,
                    "works": [work],
                },
            )

    def test_batch_rejects_missing_human_validation_requirement(self):
        batch = json.loads(json.dumps(self.batch))
        batch["humanValidationRequired"] = False
        with self.assertRaisesRegex(
            ValueError,
            "requires explicit human validation",
        ):
            ledger.validate_batch(batch)


if __name__ == "__main__":
    unittest.main()
