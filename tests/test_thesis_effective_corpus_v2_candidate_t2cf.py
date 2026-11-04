"""Regression tests for T2CF Effective Corpus V2 candidate composition."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS))

BUILDER = THESIS / "build_effective_corpus_v2_candidate_t2cf.py"
CONTRACT = THESIS / "config" / "effective-corpus-v2-candidate-t2cf.json"
DCTS = THESIS / "config" / "work-admission-decisions-v2.json"
PHILOSOPHY = THESIS / "config" / "philosophy-official-supplement-v1.json"
CURATED = THESIS / "config" / "philosophy-curated-content-v1.json"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


builder = load_module("t2cf_builder", BUILDER)


class EffectiveCorpusV2CandidateT2CFTest(unittest.TestCase):
    def setUp(self):
        self.contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
        self.dcts = json.loads(DCTS.read_text(encoding="utf-8"))
        self.philosophy = json.loads(PHILOSOPHY.read_text(encoding="utf-8"))

    def test_candidate_is_explicitly_not_a_release(self):
        self.assertEqual(
            self.contract["schemaVersion"],
            "thesis-effective-corpus-v2-candidate-contract-v1",
        )
        self.assertEqual(
            self.contract["publicationState"],
            "candidate-not-release",
        )
        invariants = self.contract["invariants"]
        self.assertTrue(invariants["noReleasePublication"])
        self.assertTrue(invariants["noPagesPublication"])
        self.assertTrue(invariants["immutableV1NotMutated"])

    def test_exact_v1_base_identity_is_pinned(self):
        base = self.contract["baseEffectiveRelease"]
        self.assertEqual(base["tag"], "thesis-effective-corpus-v1")
        self.assertEqual(base["works"], 27576)
        self.assertEqual(
            base["jsonSha256"],
            "0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892",
        )
        self.assertEqual(
            base["gzipSha256"],
            "4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3",
        )

    def test_expected_combined_delta_is_dcts_plus_four_philosophy_works(self):
        before = self.contract["baseEffectiveRelease"]["admission"]
        after = self.contract["expected"]["admission"]
        self.assertEqual(self.contract["expected"]["works"], 27580)
        self.assertEqual(after["include"] - before["include"], 5)
        self.assertEqual(after["review"] - before["review"], -1)
        for key in ("quarantine", "exclude", "reject-source"):
            self.assertEqual(after[key], before[key])
        self.assertEqual(
            self.contract["expected"]["dctsExistingWorkChanges"],
            ["thesis:work:00024461"],
        )
        self.assertEqual(
            self.contract["expected"]["newWorkIds"],
            [
                "thesis:work:00027577",
                "thesis:work:00027578",
                "thesis:work:00027579",
                "thesis:work:00027580",
            ],
        )

    def test_dcts_contract_is_reused_not_redefined(self):
        spec = self.contract["dcts"]
        self.assertEqual(spec["decisionRevision"], self.dcts["revision"])
        self.assertEqual(spec["activatedWorkId"], "thesis:work:00024461")
        self.assertEqual(spec["retainReviewWorkId"], "thesis:work:00024462")
        self.assertEqual(
            spec["preservedApprovedWorkId"],
            "thesis:work:00002062",
        )
        self.assertEqual(
            self.dcts["expected"]["outputAdmission"]["include"],
            562,
        )
        self.assertEqual(
            self.dcts["expected"]["outputAdmission"]["review"],
            192,
        )

    def test_philosophy_approval_and_exact_seed_set_are_pinned(self):
        spec = self.contract["philosophy"]
        approval = spec["approval"]
        self.assertEqual(approval["pullRequest"], 169)
        self.assertEqual(
            approval["approvedHeadSha"],
            "802775b5c568a7c7f93ec7eca9bef97c0f01a198",
        )
        self.assertEqual(
            approval["mergeCommitSha"],
            "90a41c625ce4643e0707b95a999f5aeebfe4e4f2",
        )
        self.assertEqual(spec["expectedSeedRecords"], 4)
        self.assertEqual(spec["expectedNewWorks"], 4)
        observed = sorted(
            row["providerRecordId"]
            for row in self.philosophy["seedRecords"]
        )
        self.assertEqual(
            observed,
            sorted(spec["expectedProviderRecordIds"]),
        )

    def test_curated_interdisciplinary_view_is_not_a_composition_input(self):
        content = BUILDER.read_text(encoding="utf-8")
        self.assertNotIn("philosophy-curated-content-v1.json", content)
        self.assertTrue(CURATED.is_file())
        curated = json.loads(CURATED.read_text(encoding="utf-8"))
        self.assertGreater(len(curated["records"]), 0)
        self.assertTrue(
            self.contract["invariants"][
                "curatedInterdisciplinaryViewNotCanonicalized"
            ]
        )

    def test_new_philosophy_references_are_reference_only(self):
        for seed in self.philosophy["seedRecords"]:
            url = seed["recordUrl"]
            self.assertTrue(builder.validate_reference_only(
                builder.philosophy_source.seed_to_source(seed)
            ) is None)
            lower = url.lower()
            self.assertNotIn(".pdf", lower)
            self.assertNotIn("/bitstream", lower)
            self.assertNotIn("/download", lower)


if __name__ == "__main__":
    unittest.main()
