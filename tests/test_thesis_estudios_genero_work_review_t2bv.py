"""T2BV: gender studies is a genuine humanities/social-sciences boundary."""
import json
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS))
import build_canonical_corpus_v1 as canonical
import build_program_curation_queue_v1 as curation
import build_boundary_work_review_queue_v1 as work_review

REF = "program:udg:mae-estudios-genero"
POLICY = THESIS / "config" / "boundary-work-review-policy-v1.json"

class EstudiosGeneroWorkReviewT2BVTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.policy = json.loads(POLICY.read_text(encoding="utf-8"))
        cls.target = next(x for x in cls.policy["programs"] if x["programRef"] == REF)
        cls.authority = next(x for x in cls.registry["programs"] if x["id"] == REF)

    def test_no_program_authority_change(self):
        self.assertEqual(self.registry["registryRevision"], "2026-11-03.v47")
        self.assertEqual(self.authority["admissionState"], "review")
        self.assertEqual(self.authority["observedCount"], 1)
        self.assertEqual(self.authority["observedThesisYears"], {"min":2026,"max":2026})
        self.assertEqual(self.authority["academicUnits"], ["CUCSH"])

    def test_policy_is_nonadmissive_and_primary_source_based(self):
        self.assertTrue(work_review.validate_policy(self.policy))
        self.assertEqual(self.policy["policyRevision"], "2026-11-03.boundary-v4")
        self.assertEqual(self.policy["decisionConstraint"], "boundary-work-review-does-not-change-admission")
        self.assertEqual(self.target["requiredProgramAdmissionState"], "review")
        self.assertEqual(self.target["resolutionMode"], "work-level-primary-source-adjudication")
        self.assertEqual(self.target["admissionInvariant"], "review-until-explicit-work-decision")
        self.assertEqual(self.target["programLevelConclusion"], "program-level-scope-review-exhausted")
        prohibited = set(self.target["prohibitedAsSoleDecisionBasis"])
        self.assertTrue({"title","abstract","keywords","embedding","language-model-classification","program-name-alone","academic-unit-alone"}.issubset(prohibited))

    def test_queue_lane_without_promotion(self):
        observed = {"programs":[{"normalizedKey":"maestria en estudios de genero","count":1,"variants":{"MAESTRIA EN ESTUDIOS DE GENERO":1},"providers":{"riudg":1},"admissionStatuses":{"review":1},"programRefs":{REF:1}}]}
        corpus = {"works":[{"id":"thesis:test-estudios-genero","programRaw":"MAESTRIA EN ESTUDIOS DE GENERO","academicUnitRaw":"CUCSH","date":{"value":"2026-01-01","quality":"valid"},"thesisTypeRaw":"Tesis de Maestría","admissionStatus":"review","programRef":REF,"programMetadataEvidence":{"confidenceState":"unassessed","authorityApplicability":"allowed"}}]}
        queue = curation.build_queue(observed,corpus,self.registry,work_review_policy=self.policy)
        m = queue["metrics"]
        self.assertEqual(m["humanitiesActionQueueItems"],0)
        self.assertEqual(m["workReviewQueueItems"],1)
        self.assertEqual(m["workReviewWorks"],1)
        self.assertEqual(queue["workReviewItems"][0]["curationLane"],"work-level-review")

if __name__ == "__main__":
    unittest.main()
