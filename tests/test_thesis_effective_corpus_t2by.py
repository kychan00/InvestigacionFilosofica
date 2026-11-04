"""T2BY: effective-corpus integration for approved work-level admission."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS))

import build_canonical_corpus_v1 as canonical
import build_boundary_work_review_queue_v1 as work_review
import build_program_curation_queue_v1 as curation

spec = importlib.util.spec_from_file_location(
    "effective_corpus",
    THESIS / "build_effective_corpus_v1.py",
)
effective = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(effective)


class EffectiveCorpusT2BYTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.decisions = json.loads(
            (THESIS / "config" / "work-admission-decisions-v1.json").read_text()
        )
        cls.candidate = json.loads(
            (
                THESIS
                / "config"
                / "estudios-genero-adjudication-batch-001-v1.json"
            ).read_text()
        )
        cls.policy = json.loads(
            (THESIS / "config" / "boundary-work-review-policy-v1.json").read_text()
        )

    def target_corpus(self):
        return {
            "works": [
                {
                    "id": "thesis:work:00002062",
                    "title": "El uso del lenguaje incluyente y no sexista en el aula",
                    "institutionRaw": "Universidad de Guadalajara",
                    "programRaw": "MAESTRIA EN ESTUDIOS DE GENERO",
                    "academicUnitRaw": "CUCSH",
                    "thesisTypeRaw": "Tesis de Maestría",
                    "date": {
                        "raw": "2026-03-03",
                        "value": "2026-03-03",
                        "quality": "valid",
                    },
                    "admissionStatus": "review",
                    "programMetadataEvidence": {
                        "confidenceState": "unassessed",
                        "authorityApplicability": "allowed",
                        "reasonCode": "no-metadata-confidence-rule",
                        "matchedRuleId": None,
                    },
                    "persistentIdentifiers": [
                        {
                            "scheme": "handle",
                            "normalizedValue": "20.500.12104/112718",
                            "rawValue": "https://hdl.handle.net/20.500.12104/112718",
                        }
                    ],
                    "sourceRecordRefs": [
                        "source:thesis:riudg:18a3cc69072a0c0c8e7f"
                    ],
                    "contributions": [{"role": "thesis-author"}],
                }
            ]
        }

    def test_effective_projection_applies_only_approved_work(self):
        output, report = effective.build_effective_corpus(
            self.target_corpus(),
            self.registry,
            self.decisions,
            self.candidate,
            reference_year=2026,
        )
        self.assertEqual(report["changedWorkIds"], ["thesis:work:00002062"])
        self.assertEqual(report["admissionDelta"], {"include": 1, "review": -1})
        self.assertFalse(report["programAuthorityMutated"])
        work = output["works"][0]
        self.assertEqual(work["admissionStatus"], "include")
        self.assertEqual(
            work["admissionExplanationCodes"],
            ["explicit-work-primary-source-adjudication"],
        )
        self.assertEqual(
            work["programRef"],
            "program:udg:mae-estudios-genero",
        )
        self.assertEqual(
            output["effectiveAdmissionRevision"],
            "2026-11-03.t2bx-v1",
        )

    def test_effective_work_is_removed_from_pending_work_review(self):
        output, _ = effective.build_effective_corpus(
            self.target_corpus(),
            self.registry,
            self.decisions,
            self.candidate,
            reference_year=2026,
        )
        queue = work_review.build_queue(
            output,
            self.registry,
            self.policy,
            reference_year=2026,
        )
        self.assertEqual(queue["metrics"]["workItems"], 0)
        self.assertEqual(queue["metrics"]["pendingPrimarySourceReview"], 0)
        self.assertEqual(queue["metrics"]["resolvedByExplicitWorkDecision"], 1)
        self.assertEqual(queue["metrics"]["projectedAdmission"], {"include": 1})
        gender = next(
            p
            for p in queue["programs"]
            if p["programRef"] == "program:udg:mae-estudios-genero"
        )
        self.assertEqual(gender["works"], 1)
        self.assertEqual(gender["pendingPrimarySourceReview"], 0)
        self.assertEqual(gender["resolvedByExplicitWorkDecision"], 1)
        self.assertEqual(gender["projectedAdmission"], {"include": 1})

    def test_program_stays_review_but_completed_work_lane_is_not_pending(self):
        output, _ = effective.build_effective_corpus(
            self.target_corpus(),
            self.registry,
            self.decisions,
            self.candidate,
            reference_year=2026,
        )
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en estudios de genero",
                    "count": 1,
                    "variants": {"MAESTRIA EN ESTUDIOS DE GENERO": 1},
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"include": 1},
                    "programRefs": {
                        "program:udg:mae-estudios-genero": 1,
                    },
                }
            ]
        }
        queue = curation.build_queue(observed, output, self.registry)
        item = queue["items"][0]
        self.assertEqual(item["authority"]["admissionState"], "review")
        self.assertEqual(item["curationLane"], "work-level-review")
        self.assertEqual(item["workReview"]["pendingWorks"], 0)
        self.assertEqual(item["workReview"]["resolvedWorks"], 1)
        self.assertEqual(
            item["evidenceNeeds"],
            ["work-level-adjudication-complete"],
        )
        self.assertEqual(queue["workReviewItems"], [])
        self.assertEqual(queue["metrics"]["workReviewQueueItems"], 0)
        self.assertEqual(queue["metrics"]["workReviewWorks"], 0)
        self.assertEqual(queue["metrics"]["workReviewCompletedQueueItems"], 1)
        self.assertEqual(queue["metrics"]["workReviewCompletedWorks"], 1)
        self.assertEqual(
            queue["workReviewCompletedItems"][0]["normalizedKey"],
            "maestria en estudios de genero",
        )


if __name__ == "__main__":
    unittest.main()
