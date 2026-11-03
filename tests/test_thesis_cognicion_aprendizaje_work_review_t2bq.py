"""T2BQ Doctorado en Cognición y Aprendizaje work-level review gates."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS))

WORK_MODULE = THESIS / "build_boundary_work_review_queue_v1.py"
work_spec = importlib.util.spec_from_file_location("boundary_work_review_t2bq", WORK_MODULE)
work_review = importlib.util.module_from_spec(work_spec)
assert work_spec.loader is not None
work_spec.loader.exec_module(work_review)

QUEUE_MODULE = THESIS / "build_program_curation_queue_v1.py"
queue_spec = importlib.util.spec_from_file_location("program_curation_t2bq", QUEUE_MODULE)
curation = importlib.util.module_from_spec(queue_spec)
assert queue_spec.loader is not None
queue_spec.loader.exec_module(curation)

import build_canonical_corpus_v1 as canonical


class CognicionAprendizajeWorkReviewT2BQTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.policy = json.loads(
            (THESIS / "config" / "boundary-work-review-policy-v1.json").read_text(
                encoding="utf-8"
            )
        )
        cls.ref = "program:udg:doc-cognicion-aprendizaje"

    def target_policy(self):
        return next(
            p for p in self.policy["programs"] if p["programRef"] == self.ref
        )

    def test_program_authority_remains_v44_review(self):
        self.assertEqual(self.registry["registryRevision"], "2026-11-03.v47")
        authority = next(p for p in self.registry["programs"] if p["id"] == self.ref)
        self.assertEqual(authority["admissionState"], "review")
        self.assertEqual(authority["observedCount"], 4)
        self.assertEqual(authority["observedThesisYears"], {"min": 2022, "max": 2022})

    def test_policy_routes_program_to_primary_source_work_review(self):
        self.assertTrue(work_review.validate_policy(self.policy))
        target = self.target_policy()
        self.assertEqual(
            target["resolutionMode"], "work-level-primary-source-adjudication"
        )
        self.assertEqual(
            target["programLevelConclusion"], "program-level-scope-review-exhausted"
        )
        self.assertEqual(
            target["admissionInvariant"], "review-until-explicit-work-decision"
        )
        prohibited = set(target["prohibitedAsSoleDecisionBasis"])
        self.assertTrue(
            {
                "title",
                "abstract",
                "keywords",
                "semantic-similarity",
                "embedding",
                "language-model-classification",
            }.issubset(prohibited)
        )

    def test_program_curation_no_longer_treats_program_as_scope_decision(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en cognicion y aprendizaje",
                    "count": 4,
                    "variants": {"DOCTORADO EN COGNICION Y APRENDIZAJE": 4},
                    "providers": {"riudg": 4},
                    "admissionStatuses": {"review": 4},
                    "programRefs": {self.ref: 4},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "DOCTORADO EN COGNICION Y APRENDIZAJE",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2022-06-29", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Doctorado",
                    "admissionStatus": "review",
                    "programRef": self.ref,
                    "programMetadataEvidence": {
                        "confidenceState": "unassessed",
                        "authorityApplicability": "allowed",
                    },
                }
            ]
        }
        payload = curation.build_queue(observed, corpus, self.registry)
        self.assertEqual(payload["metrics"]["humanitiesActionQueueItems"], 0)
        self.assertEqual(payload["metrics"]["workReviewQueueItems"], 1)
        self.assertEqual(payload["metrics"]["workReviewWorks"], 4)
        item = payload["workReviewItems"][0]
        self.assertEqual(item["authority"]["id"], self.ref)
        self.assertEqual(item["curationLane"], "work-level-review")
        self.assertEqual(
            item["evidenceNeeds"],
            ["work-level-primary-source-adjudication", "explicit-human-validation"],
        )

    def test_work_review_queue_is_non_admissive_for_cognicion(self):
        target_policy = {
            **self.policy,
            "programs": [self.target_policy()],
        }
        corpus = {
            "works": [
                {
                    "id": "thesis:work:test-cognicion",
                    "title": "Ética y juicio moral",
                    "academicUnitRaw": "CUCSH",
                    "institutionRaw": "Universidad de Guadalajara",
                    "programRaw": "DOCTORADO EN COGNICION Y APRENDIZAJE",
                    "date": {"value": "2022-08-15", "quality": "valid"},
                    "persistentIdentifiers": [
                        {
                            "scheme": "handle",
                            "rawValue": "https://hdl.handle.net/20.500.12104/92536",
                            "normalizedValue": "20.500.12104/92536",
                        }
                    ],
                    "sourceRecordRefs": ["source:test-cognicion"],
                    "contributions": [{"role": "author"}],
                    "programMetadataEvidence": {
                        "confidenceState": "unassessed",
                        "authorityApplicability": "allowed",
                    },
                    "admissionStatus": "review",
                }
            ]
        }
        queue = work_review.build_queue(corpus, self.registry, target_policy)
        self.assertEqual(queue["metrics"]["workItems"], 1)
        self.assertEqual(queue["metrics"]["projectedAdmission"], {"review": 1})
        self.assertEqual(queue["metrics"]["automaticAdmissionDecisions"], 0)
        self.assertEqual(queue["metrics"]["admissionChanges"], 0)
        item = queue["items"][0]
        self.assertEqual(item["workReviewState"], "pending-primary-source-review")
        self.assertEqual(item["projectedAdmissionStatus"], "review")


if __name__ == "__main__":
    unittest.main()
