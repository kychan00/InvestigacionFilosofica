"""T2CC: exact-work and per-decision provenance regression tests."""
from __future__ import annotations
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts/thesis"
spec = importlib.util.spec_from_file_location(
    "t2cc_activation", THESIS / "apply_work_admission_decisions_v2.py"
)
activation = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(activation)


def fixture():
    contract = json.loads(
        (THESIS / "config/work-admission-decisions-v2.json").read_text()
    )
    contract["expected"].update({
        "sourceWorks": 3,
        "inputAdmission": {"include": 1, "review": 2},
        "outputAdmission": {"include": 2, "review": 1},
    })
    candidates = activation.load_candidates(contract)
    registry = {
        "registryRevision": "2026-11-03.v47",
        "programs": [
            {"id": row["programRef"], "admissionState": "review"}
            for row in contract["decisions"]
        ],
    }
    works = []
    sources = []
    for row in contract["decisions"]:
        is_old = row["activation"] == "preserve-approved"
        work = {
            "id": row["workId"],
            "programRef": row["programRef"],
            "admissionStatus": "include" if is_old else "review",
            "admissionExplanationCodes": [
                activation.DECISION_EXPLANATION if is_old else "program-review"
            ],
            "programMetadataEvidence": {"authorityApplicability": "allowed"},
            "persistentIdentifiers": [
                {"scheme": "handle", "normalizedValue": row["handle"]}
            ],
            "sourceRecordRefs": [row["sourceRecordRef"]],
        }
        if is_old:
            work["workAdmissionDecision"] = {
                "revision": row["decisionRevision"],
                "sourceProgramAuthority": row["programRef"],
                "candidateBatchId": row["candidateBatchId"],
                "sourceSha256": row["primarySourceSha256"],
                "approvalPullRequest": 158,
                "approvalMergeSha": row["approval"]["mergeCommitSha"],
                "previousStatus": "review",
                "newStatus": "include",
            }
        works.append(work)
        sources.append({
            "id": row["sourceRecordRef"],
            "provider": "riudg",
            "providerRecordId": "oai:riudg.udg.mx:" + row["handle"],
        })
    works.append({
        "id": "thesis:work:00024462",
        "programRef": contract["retainReviewGuarantee"]["programRef"],
        "admissionStatus": "review",
    })
    return ({
        "works": works, "sourceRecords": sources,
        "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v1",
        "effectiveAdmissionRevision": "2026-11-03.t2bx-v1",
        "workAdmissionDecisionRevision": "2026-11-03.t2bx-v1",
        "metrics": {"worksByAdmission": {"include": 1, "review": 2}},
    }, contract, registry, candidates)


class T2CCTest(unittest.TestCase):
    def test_exact_delta_and_reversal(self):
        corpus, contract, registry, candidates = fixture()
        old = copy.deepcopy(corpus)
        active, report = activation.apply_decisions_v2(
            corpus, contract, registry, candidates
        )
        self.assertEqual(corpus, old)
        self.assertEqual(report["selectedWorkIds"], ["thesis:work:00024461"])
        self.assertEqual(report["admissionDelta"], {"include": 1, "review": -1})
        self.assertEqual(active["works"][0], old["works"][0])
        self.assertEqual(active["works"][2], old["works"][2])
        self.assertEqual(
            active["works"][1]["workAdmissionDecision"]["approvalPullRequest"], 163
        )
        restored, rollback = activation.apply_decisions_v2(
            active, contract, registry, candidates, reverse=True
        )
        self.assertEqual(restored, old)
        self.assertEqual(rollback["admissionDelta"], {"include": -1, "review": 1})

    def test_double_apply_and_invalid_rollback(self):
        corpus, contract, registry, candidates = fixture()
        active, _ = activation.apply_decisions_v2(
            corpus, contract, registry, candidates
        )
        with self.assertRaisesRegex(ValueError, "unmodified effective corpus V1"):
            activation.apply_decisions_v2(active, contract, registry, candidates)
        active["works"][1]["workAdmissionDecision"]["approvalMergeSha"] = "broken"
        with self.assertRaisesRegex(ValueError, "provenance mismatch"):
            activation.apply_decisions_v2(
                active, contract, registry, candidates, reverse=True
            )

    def test_wrong_source_or_confidence_is_blocked(self):
        for target, expected in (
            ("persistentIdentifiers", "Handle mismatch"),
            ("sourceRecordRefs", "SourceRecordRef mismatch"),
            ("blocked", "Blocked metadata"),
        ):
            corpus, contract, registry, candidates = fixture()
            if target == "blocked":
                corpus["works"][1]["programMetadataEvidence"][
                    "authorityApplicability"
                ] = "blocked"
            else:
                corpus["works"][1][target] = []
            with self.subTest(target=target):
                with self.assertRaisesRegex(ValueError, expected):
                    activation.apply_decisions_v2(
                        corpus, contract, registry, candidates
                    )

    def test_rejects_candidate_or_approval_tampering(self):
        corpus, contract, registry, candidates = fixture()
        contract["decisions"][1]["approval"]["merged"] = False
        with self.assertRaisesRegex(ValueError, "Human merge approval"):
            activation.apply_decisions_v2(corpus, contract, registry, candidates)
        corpus, contract, registry, candidates = fixture()
        cfg = contract["decisions"][1]["candidateConfig"]
        candidates[cfg]["works"][0]["candidateDecision"] = "retain-review"
        with self.assertRaisesRegex(ValueError, "official full-text candidate"):
            activation.apply_decisions_v2(corpus, contract, registry, candidates)

    def test_retained_review_and_program_state_are_immutable(self):
        corpus, contract, registry, candidates = fixture()
        corpus["works"][2]["admissionStatus"] = "include"
        with self.assertRaisesRegex(ValueError, "Retain-review"):
            activation.apply_decisions_v2(corpus, contract, registry, candidates)
        corpus, contract, registry, candidates = fixture()
        registry["programs"][1]["admissionState"] = "include"
        with self.assertRaisesRegex(ValueError, "must remain REVIEW"):
            activation.apply_decisions_v2(corpus, contract, registry, candidates)

    def test_exact_source_record_identity_and_duplicate_decisions(self):
        corpus, contract, registry, candidates = fixture()
        corpus["sourceRecords"][0]["providerRecordId"] = "unverified"
        with self.assertRaisesRegex(ValueError, "institutional SourceRecord"):
            activation.apply_decisions_v2(corpus, contract, registry, candidates)
        corpus, contract, registry, candidates = fixture()
        contract["decisions"].append(copy.deepcopy(contract["decisions"][1]))
        with self.assertRaisesRegex(ValueError, "Duplicate work decision"):
            activation.apply_decisions_v2(corpus, contract, registry, candidates)


if __name__ == "__main__":
    unittest.main()
