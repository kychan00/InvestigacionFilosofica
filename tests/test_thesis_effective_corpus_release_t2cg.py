"""T2CG release and public-consumer regressions."""
from __future__ import annotations

import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
CONTRACT_PATH = THESIS / "config" / "effective-corpus-release-t2cg-v2.json"
ROOT_MANIFEST = ROOT / "release-manifest.json"
ATLAS_CONTRACT = THESIS / "config" / "thesis-atlas-t2cg-v2.json"
DEMO_BUILDER = THESIS / "build_thesis_demo_index_v1.py"
RELEASE_BUILDER = THESIS / "build_effective_corpus_release_manifest_v2.py"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


demo = load_module("t2cg_demo", DEMO_BUILDER)
release = load_module("t2cg_release", RELEASE_BUILDER)


class EffectiveCorpusReleaseT2CGTests(unittest.TestCase):
    def setUp(self):
        self.contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

    def test_v2_contract_pins_exact_candidate(self):
        c = self.contract
        self.assertEqual(c["schemaVersion"], "thesis-effective-corpus-release-contract-v2")
        self.assertEqual(c["releaseTag"], "thesis-effective-corpus-v2")
        self.assertEqual(c["baseRelease"]["tag"], "thesis-effective-corpus-v1")
        self.assertEqual(c["candidate"]["approvedPullRequest"], 170)
        self.assertEqual(
            c["candidate"]["mergeCommitSha"],
            "3f22075bab222d8ac2bec4eaed0c3568a2cdf110",
        )
        self.assertEqual(c["candidate"]["artifactId"], 13335683726)
        self.assertEqual(
            c["effectiveCorpusJsonSha256"],
            "f8792c73471f2a54bb4ec8b38d41f4b366b16caedb4a29286f704e85c8038e13",
        )
        self.assertEqual(
            c["effectiveCorpusGzipSha256"],
            "f3a162b8de5fe371898dcf60afbf2b6383b444d56bd5709a3d4634e813255b01",
        )
        self.assertEqual(c["worksTotal"], 27580)
        self.assertEqual(c["admissionCounts"]["include"], 566)
        self.assertEqual(c["admissionCounts"]["review"], 192)
        self.assertEqual(c["changedExistingWorkIds"], ["thesis:work:00024461"])
        self.assertEqual(len(c["newWorkIds"]), 4)
        self.assertNotEqual(
            c["effectiveAdmissionRevision"],
            c["workAdmissionDecisionRevision"],
        )

    def test_root_manifest_matches_v2_contract(self):
        root = json.loads(ROOT_MANIFEST.read_text(encoding="utf-8"))
        release.validate_root_release_manifest(root, self.contract)

    def test_demo_accepts_distinct_effective_and_work_decision_revisions(self):
        contract = {
            "effectiveCorpusGzipSha256": "",
            "effectiveCorpusJsonSha256": "",
            "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v2",
            "programAuthorityRevision": "pa",
            "metadataConfidenceRevision": "mc",
            "effectiveAdmissionRevision": "effective",
            "workAdmissionDecisionRevision": "work-level",
            "worksTotal": 1,
            "admissionCounts": {"include": 1},
            "releaseTag": "fixture-v2",
        }
        corpus = {
            "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v2",
            "programAuthorityRevision": "pa",
            "programMetadataEvidenceRevision": "mc",
            "effectiveAdmissionRevision": "effective",
            "workAdmissionDecisionRevision": "work-level",
            "works": [{
                "id": "thesis:work:00000001",
                "title": "Prueba",
                "admissionStatus": "include",
                "contributions": [],
                "date": {"quality": "invalid", "value": None},
                "sourceRecordRefs": [],
            }],
            "sourceRecords": [],
            "programAuthorities": [],
        }
        payload = json.dumps(corpus, sort_keys=True).encode("utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.json.gz"
            with path.open("wb") as raw:
                with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as stream:
                    stream.write(payload)
            contract["effectiveCorpusGzipSha256"] = demo.sha256(path.read_bytes())
            contract["effectiveCorpusJsonSha256"] = demo.sha256(payload)
            verified = demo.verified_release(path, contract)
            index = demo.build_index(verified, contract)
        self.assertEqual(index["totalIncluded"], 1)
        self.assertEqual(index["sourceRelease"], "fixture-v2")

    def test_cucsh_reference_query_is_narrowly_allowlisted(self):
        stable = "https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243"
        self.assertEqual(demo.safe_institutional_url(stable), stable)
        self.assertIsNone(
            demo.safe_institutional_url(
                "https://www.biblioteca.cucsh.udg.mx/?session=secret"
            )
        )
        self.assertIsNone(
            demo.safe_institutional_url(
                "https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243&x=1"
            )
        )

    def test_public_consumers_are_migrated_to_566(self):
        atlas = json.loads(ATLAS_CONTRACT.read_text(encoding="utf-8"))
        self.assertEqual(atlas["sourceRelease"], "thesis-effective-corpus-v2")
        self.assertEqual(atlas["expectedNodes"], 566)
        self.assertEqual(
            atlas["sourceContract"],
            "scripts/thesis/config/effective-corpus-release-t2cg-v2.json",
        )
        thesis_html = (ROOT / "tesis.html").read_text(encoding="utf-8")
        atlas_html = (ROOT / "atlas.html").read_text(encoding="utf-8")
        atlas_js = (ROOT / "js/thesis-atlas.js").read_text(encoding="utf-8")
        self.assertIn("thesis-effective-corpus-v2", thesis_html)
        self.assertIn("566 tesis admitidas", thesis_html)
        self.assertNotIn("561 tesis", thesis_html)
        self.assertNotIn("561 tesis", atlas_html)
        self.assertNotIn('"561 tesis', atlas_js)

    def test_deploy_targets_v2_and_preserves_v1_as_base(self):
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        self.assertIn("effective-corpus-release-t2cg-v2.json", deploy)
        self.assertIn("thesis-effective-corpus-v1", deploy)
        self.assertIn("thesis-effective-corpus-v2", deploy)
        self.assertIn("==566", deploy)
        self.assertNotIn("==561", deploy)


if __name__ == "__main__":
    unittest.main()
