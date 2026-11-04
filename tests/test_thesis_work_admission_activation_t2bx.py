"""T2BX: adversarial tests for exact-work Humanities admission activation."""
from __future__ import annotations
import importlib.util
import copy
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/apply_work_admission_decisions_v1.py"
spec = importlib.util.spec_from_file_location("work_activation", SCRIPT)
activation = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(activation)

def fixture():
    decisions=json.loads((ROOT/"scripts/thesis/config/work-admission-decisions-v1.json").read_text())
    candidate=json.loads((ROOT/"scripts/thesis/config/estudios-genero-adjudication-batch-001-v1.json").read_text())
    registry={
        "registryRevision":"2026-11-03.v47",
        "programs":[{"id":"program:udg:mae-estudios-genero","admissionState":"review"}],
    }
    work={
        "id":"thesis:work:00002062",
        "title":"Language and gender",
        "programRef":"program:udg:mae-estudios-genero",
        "admissionStatus":"review",
        "admissionExplanationCodes":["program-review"],
        "programMetadataEvidence":{"authorityApplicability":"allowed"},
        "persistentIdentifiers":[{"scheme":"handle","normalizedValue":"20.500.12104/112718"}],
        "sourceRecordRefs":["source:thesis:riudg:18a3cc69072a0c0c8e7f"],
    }
    other={"id":"thesis:work:other","programRef":"program:udg:mae-estudios-genero","admissionStatus":"review"}
    return {"works":[work,other]},decisions,candidate,registry

class WorkActivationT2BXTest(unittest.TestCase):
    def test_work_only_changes_and_is_reversible(self):
        corpus,decisions,candidate,registry=fixture()
        original=copy.deepcopy(corpus)
        projected,report=activation.apply_decisions(corpus,decisions,candidate,registry)
        self.assertEqual(original,corpus)
        self.assertEqual(projected["works"][0]["admissionStatus"],"include")
        self.assertEqual(projected["works"][1],original["works"][1])
        self.assertEqual(report["admissionDelta"],{"include":1,"review":-1})
        self.assertEqual(report["sourceWorks"],2)
        self.assertEqual(projected["works"][0]["workAdmissionDecision"]["approvalPullRequest"],158)
        restored,rollback=activation.apply_decisions(
            projected,decisions,candidate,registry,reverse=True
        )
        self.assertEqual(restored["works"],original["works"])
        self.assertEqual(rollback["admissionDelta"],{"include":-1,"review":1})

    def test_refuses_other_work_and_bad_handle(self):
        corpus,decisions,candidate,registry=fixture()
        corpus["works"][0]["id"]="thesis:work:wrong"
        with self.assertRaisesRegex(ValueError,"absent"):
            activation.apply_decisions(corpus,decisions,candidate,registry)
        corpus,decisions,candidate,registry=fixture()
        corpus["works"][0]["persistentIdentifiers"]=[]
        with self.assertRaisesRegex(ValueError,"Handle mismatch"):
            activation.apply_decisions(corpus,decisions,candidate,registry)

    def test_blocks_missing_source_and_confidence_blocker(self):
        corpus,decisions,candidate,registry=fixture()
        corpus["works"][0]["sourceRecordRefs"]=[]
        with self.assertRaisesRegex(ValueError,"Source record mismatch"):
            activation.apply_decisions(corpus,decisions,candidate,registry)
        corpus,decisions,candidate,registry=fixture()
        corpus["works"][0]["programMetadataEvidence"]["authorityApplicability"]="blocked"
        with self.assertRaisesRegex(ValueError,"Blocked program evidence"):
            activation.apply_decisions(corpus,decisions,candidate,registry)

    def test_requires_approved_candidate_source_and_merge(self):
        corpus,decisions,candidate,registry=fixture()
        decisions["approval"]["merged"]=False
        with self.assertRaisesRegex(ValueError,"human merge provenance"):
            activation.apply_decisions(corpus,decisions,candidate,registry)
        corpus,decisions,candidate,registry=fixture()
        candidate["works"][0]["primarySourceSha256"]="wrong"
        with self.assertRaisesRegex(ValueError,"Primary-source identity mismatch"):
            activation.apply_decisions(corpus,decisions,candidate,registry)
        corpus,decisions,candidate,registry=fixture()
        candidate["works"][0]["candidateDecision"]="retain-review"
        with self.assertRaisesRegex(ValueError,"Missing approved INCLUDE candidate"):
            activation.apply_decisions(corpus,decisions,candidate,registry)

    def test_no_program_wide_or_duplicate_application(self):
        corpus,decisions,candidate,registry=fixture()
        registry["programs"][0]["admissionState"]="include"
        with self.assertRaisesRegex(ValueError,"must remain REVIEW"):
            activation.apply_decisions(corpus,decisions,candidate,registry)
        corpus,decisions,candidate,registry=fixture()
        projected,_=activation.apply_decisions(corpus,decisions,candidate,registry)
        with self.assertRaisesRegex(ValueError,"not REVIEW"):
            activation.apply_decisions(projected,decisions,candidate,registry)
        decisions["decisions"].append(copy.deepcopy(decisions["decisions"][0]))
        with self.assertRaisesRegex(ValueError,"Duplicate work decision"):
            activation.apply_decisions(corpus,decisions,candidate,registry)

if __name__=="__main__":
    unittest.main()
