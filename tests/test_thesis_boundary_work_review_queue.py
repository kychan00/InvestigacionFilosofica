"""T2BC boundary work review queue regression gates."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS))

MODULE = THESIS / "build_boundary_work_review_queue_v1.py"
spec = importlib.util.spec_from_file_location("boundary_work_review", MODULE)
review = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(review)

import build_canonical_corpus_v1 as canonical


class BoundaryWorkReviewQueueTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.policy = json.loads(
            (
                THESIS
                / "config"
                / "boundary-work-review-policy-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_real_policy_is_non_admissive_and_targets_review_authority(self):
        self.assertTrue(review.validate_policy(self.policy))
        self.assertEqual(
            self.policy["decisionConstraint"],
            "boundary-work-review-does-not-change-admission",
        )
        item = self.policy["programs"][0]
        self.assertEqual(
            item["programRef"],
            "program:udg:doc-ciudad-territorio-sustentabilidad",
        )
        self.assertEqual(item["requiredProgramAdmissionState"], "review")

        authority = next(
            p
            for p in self.registry["programs"]
            if p["id"] == item["programRef"]
        )
        self.assertEqual(authority["admissionState"], "review")
        self.assertEqual(authority["observedCount"], 152)

    def test_unsafe_supporting_signals_are_prohibited_as_sole_basis(self):
        item = self.policy["programs"][0]
        prohibited = set(item["prohibitedAsSoleDecisionBasis"])
        self.assertTrue(
            {
                "title",
                "abstract",
                "keywords",
                "language-model-classification",
                "embedding",
                "semantic-similarity",
            }.issubset(prohibited)
        )

    def test_queue_keeps_review_and_creates_no_auto_decisions(self):
        corpus = {
            "works": [
                {
                    "id": "thesis:work:test-urban",
                    "title": "Cultura y espacio público",
                    "abstract": "Resumen disponible.",
                    "keywords": ["cultura", "espacio público"],
                    "academicUnitRaw": "CUAAD",
                    "institutionRaw": "Universidad de Guadalajara",
                    "programRaw": (
                        "Doctorado en Ciudad, Territorio y Sustentabilidad"
                    ),
                    "programMetadataEvidence": {
                        "confidenceState": "unassessed",
                        "authorityApplicability": "allowed",
                        "reasonCode": "no-metadata-confidence-evidence",
                        "matchedRuleId": None,
                    },
                    "date": {"value": "2021", "quality": "valid"},
                    "persistentIdentifiers": [
                        {
                            "scheme": "handle",
                            "normalizedValue": "20.500.12104/test",
                            "rawValue": "https://hdl.handle.net/20.500.12104/test",
                        }
                    ],
                    "sourceRecordRefs": ["source:test"],
                    "contributions": [{"role": "author"}],
                    "admissionStatus": "review",
                }
            ]
        }

        queue = review.build_queue(
            corpus,
            self.registry,
            self.policy,
        )

        self.assertEqual(queue["metrics"]["workItems"], 1)
        self.assertEqual(
            queue["metrics"]["projectedAdmission"],
            {"review": 1},
        )
        self.assertEqual(
            queue["metrics"]["pendingPrimarySourceReview"],
            1,
        )
        self.assertEqual(queue["metrics"]["automaticAdmissionDecisions"], 0)
        self.assertEqual(queue["metrics"]["admissionChanges"], 0)

        item = queue["items"][0]
        self.assertEqual(
            item["workReviewState"],
            "pending-primary-source-review",
        )
        self.assertEqual(item["projectedAdmissionStatus"], "review")
        self.assertTrue(
            item["supportingEvidenceAvailability"]["abstract"]
        )
        self.assertTrue(
            item["supportingEvidenceAvailability"]["keywords"]
        )
        self.assertEqual(
            item["decisionConstraint"],
            "boundary-work-review-does-not-change-admission",
        )

    def test_policy_rejects_llm_as_decision_basis_if_not_prohibited(self):
        policy = json.loads(json.dumps(self.policy))
        policy["programs"][0]["prohibitedAsSoleDecisionBasis"].remove(
            "language-model-classification"
        )
        with self.assertRaisesRegex(
            ValueError,
            "Unsafe sole-decision signal not prohibited",
        ):
            review.validate_policy(policy)


if __name__ == "__main__":
    unittest.main()
