"""T2BR: Doctorado en Derechos Humanos has primary-source work review only."""
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
THESIS=ROOT/"scripts"/"thesis"
sys.path.insert(0,str(THESIS))
import build_canonical_corpus_v1 as canonical
import build_program_curation_queue_v1 as curation
import build_boundary_work_review_queue_v1 as work_review

class DerechosHumanosWorkReviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=canonical.load_program_registry()
        cls.policy=json.loads((THESIS/"config"/"boundary-work-review-policy-v1.json").read_text())
        cls.ref="program:udg:doc-derechos-humanos"
    def test_authority_unchanged(self):
        self.assertEqual(self.registry["registryRevision"],"2026-11-03.v47")
        p=next(p for p in self.registry["programs"] if p["id"]==self.ref)
        self.assertEqual(p["admissionState"],"review")
        self.assertEqual(p["observedCount"],24)
        self.assertEqual(p["observedThesisYears"],{"min":2021,"max":2025})
    def test_non_admissive_policy(self):
        work_review.validate_policy(self.policy)
        self.assertEqual(self.policy["policyRevision"],"2026-11-03.boundary-v4")
        p=next(p for p in self.policy["programs"] if p["programRef"]==self.ref)
        self.assertEqual(p["requiredProgramAdmissionState"],"review")
        self.assertEqual(p["programLevelConclusion"],"program-level-scope-review-exhausted")
        self.assertEqual(p["resolutionMode"],"work-level-primary-source-adjudication")
        self.assertEqual(p["admissionInvariant"],"review-until-explicit-work-decision")
        self.assertTrue({"title","abstract","keywords","embedding","language-model-classification"}.issubset(set(p["prohibitedAsSoleDecisionBasis"])))
    def test_program_queue_routes_to_work_review_not_humanities_action(self):
        observed={"programs":[{"normalizedKey":"doctorado en derechos humanos","count":24,
            "variants":{"DOCTORADO EN DERECHOS HUMANOS":24},"providers":{"riudg":24},
            "admissionStatuses":{"review":24},"programRefs":{self.ref:24}}]}
        corpus={"works":[{"programRaw":"DOCTORADO EN DERECHOS HUMANOS","academicUnitRaw":"CUTONALA",
            "date":{"value":"2025","quality":"valid"},"thesisTypeRaw":"Tesis de Doctorado",
            "admissionStatus":"review","programRef":self.ref,
            "programMetadataEvidence":{"confidenceState":"unassessed","authorityApplicability":"allowed"}}]}
        q=curation.build_queue(observed,corpus,self.registry)
        self.assertEqual(q["metrics"]["humanitiesActionQueueItems"],0)
        self.assertEqual(q["metrics"]["workReviewQueueItems"],1)
        self.assertEqual(q["metrics"]["workReviewWorks"],24)
        item=q["workReviewItems"][0]
        self.assertEqual(item["curationLane"],"work-level-review")
        self.assertEqual(item["queueState"],"review")
        self.assertEqual(item["evidenceNeeds"],["work-level-primary-source-adjudication","explicit-human-validation"])
    def test_one_work_produces_no_admission_decision(self):
        subset={**self.policy,"programs":[next(p for p in self.policy["programs"] if p["programRef"]==self.ref)]}
        corpus={"works":[{"id":"thesis:work:t2br-fixture","title":"Teoría y filosofía de los derechos humanos",
            "institutionRaw":"Universidad de Guadalajara","academicUnitRaw":"CUTONALA",
            "programRaw":"DOCTORADO EN DERECHOS HUMANOS","date":{"value":"2024","quality":"valid"},
            "admissionStatus":"review","persistentIdentifiers":[{"scheme":"handle","rawValue":"https://hdl.handle.net/20.500.12104/example"}],
            "programMetadataEvidence":{"confidenceState":"unassessed","authorityApplicability":"allowed"}}]}
        q=work_review.build_queue(corpus,self.registry,subset)
        self.assertEqual(q["metrics"]["projectedAdmission"],{"review":1})
        self.assertEqual(q["metrics"]["automaticAdmissionDecisions"],0)
        self.assertEqual(q["metrics"]["admissionChanges"],0)
        self.assertEqual(q["items"][0]["workReviewState"],"pending-primary-source-review")
if __name__=="__main__":unittest.main()
