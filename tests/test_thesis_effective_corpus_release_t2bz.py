import gzip
import importlib.util
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = (
    ROOT
    / "scripts"
    / "thesis"
    / "build_effective_corpus_release_manifest_v1.py"
)
spec = importlib.util.spec_from_file_location("release_manifest", MODULE_PATH)
release_manifest = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(release_manifest)


class EffectiveCorpusReleaseT2BZTests(unittest.TestCase):
    def make_fixture(self, root: Path):
        corpus = {
            "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v1",
            "programAuthorityRevision": "pa-v1",
            "effectiveAdmissionRevision": "wa-v1",
            "works": [
                {"id": "w1", "admissionStatus": "include"},
                {"id": "w2", "admissionStatus": "review"},
            ],
        }
        corpus_path = root / "effective-corpus.json"
        corpus_path.write_text(
            json.dumps(corpus, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        gzip_path = root / "effective-corpus.json.gz"
        with gzip_path.open("wb") as raw:
            with gzip.GzipFile(
                fileobj=raw,
                mode="wb",
                filename="",
                mtime=0,
            ) as stream:
                stream.write(corpus_path.read_bytes())

        report = {
            "programMetadataEvidenceRevision": "mc-v1",
            "changedWorkIds": ["w1"],
        }
        report_path = root / "report.json"
        report_path.write_text(
            json.dumps(report) + "\n",
            encoding="utf-8",
        )

        contract = {
            "schemaVersion": "thesis-effective-corpus-release-contract-v1",
            "revision": "release-v1",
            "phase": "T2BZ",
            "releaseTag": "thesis-effective-corpus-v1",
            "releaseTitle": "Fixture",
            "sourceArtifactId": 7,
            "sourceCanonicalCorpusSha256": "a" * 64,
            "t2byEvidenceArtifactId": 8,
            "t2byEvidenceArchiveSha256": "b" * 64,
            "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v1",
            "programAuthorityRevision": "pa-v1",
            "metadataConfidenceRevision": "mc-v1",
            "workAdmissionDecisionRevision": "wa-v1",
            "effectiveCorpusJsonSha256": release_manifest.sha256_file(
                corpus_path
            ),
            "effectiveCorpusGzipSha256": release_manifest.sha256_file(
                gzip_path
            ),
            "worksTotal": 2,
            "admissionCounts": {"include": 1, "review": 1},
            "changedWorkIds": ["w1"],
            "assets": {
                "corpusGzip": "effective-corpus.json.gz",
                "corpusJsonSha256": "effective-corpus.json.sha256",
                "corpusGzipSha256": "effective-corpus.json.gz.sha256",
                "report": "effective-corpus-report.json",
                "manifest": "manifest.json",
            },
            "publicBasePath": "data/theses/effective-corpus-v1",
            "publicManifestPath": (
                "data/theses/effective-corpus-v1/manifest.json"
            ),
            "publicCorpusPath": (
                "data/theses/effective-corpus-v1/"
                "effective-corpus.json.gz"
            ),
        }
        contract_path = root / "contract.json"
        contract_path.write_text(
            json.dumps(contract) + "\n",
            encoding="utf-8",
        )
        return (
            contract,
            contract_path,
            corpus_path,
            gzip_path,
            report_path,
        )

    def test_build_and_verify_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (
                contract,
                contract_path,
                corpus_path,
                gzip_path,
                report_path,
            ) = self.make_fixture(root)
            release_dir = root / "release"
            release_dir.mkdir()
            (release_dir / "effective-corpus.json.gz").write_bytes(
                gzip_path.read_bytes()
            )
            (
                release_dir / "effective-corpus-report.json"
            ).write_text(
                report_path.read_text(encoding="utf-8"),
                encoding="utf-8",
            )

            args = Namespace(
                contract=contract_path,
                corpus_json=corpus_path,
                corpus_gzip=gzip_path,
                report=report_path,
                repository="owner/repo",
                generated_from_sha="c" * 40,
                workflow_run="123",
                created_at="2026-11-03T00:00:00Z",
                output_manifest=release_dir / "manifest.json",
                output_json_sha=(
                    release_dir / "effective-corpus.json.sha256"
                ),
                output_gzip_sha=(
                    release_dir / "effective-corpus.json.gz.sha256"
                ),
            )
            release_manifest.build_manifest(args)

            root_manifest = {
                "corpora": {
                    "thesesHumanities": {
                        "releaseTag": contract["releaseTag"],
                        "corpusRevision": contract["revision"],
                        "effectiveCorpusSchemaVersion": contract[
                            "effectiveCorpusSchemaVersion"
                        ],
                        "programAuthorityRevision": contract[
                            "programAuthorityRevision"
                        ],
                        "metadataConfidenceRevision": contract[
                            "metadataConfidenceRevision"
                        ],
                        "workAdmissionDecisionRevision": contract[
                            "workAdmissionDecisionRevision"
                        ],
                        "effectiveCorpusJsonSha256": contract[
                            "effectiveCorpusJsonSha256"
                        ],
                        "effectiveCorpusGzipSha256": contract[
                            "effectiveCorpusGzipSha256"
                        ],
                        "records": contract["worksTotal"],
                        "admissionCounts": contract["admissionCounts"],
                        "publicManifest": contract[
                            "publicManifestPath"
                        ],
                        "publicCorpus": contract["publicCorpusPath"],
                    }
                }
            }
            root_manifest_path = root / "release-manifest.json"
            root_manifest_path.write_text(
                json.dumps(root_manifest) + "\n",
                encoding="utf-8",
            )
            release_manifest.verify_release(
                Namespace(
                    contract=contract_path,
                    release_dir=release_dir,
                    root_release_manifest=root_manifest_path,
                )
            )

    def test_build_fails_closed_on_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (
                contract,
                contract_path,
                corpus_path,
                gzip_path,
                report_path,
            ) = self.make_fixture(root)
            contract["effectiveCorpusGzipSha256"] = "0" * 64
            contract_path.write_text(
                json.dumps(contract) + "\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                ValueError,
                "gzip SHA-256 mismatch",
            ):
                release_manifest.build_manifest(
                    Namespace(
                        contract=contract_path,
                        corpus_json=corpus_path,
                        corpus_gzip=gzip_path,
                        report=report_path,
                        repository="owner/repo",
                        generated_from_sha="c" * 40,
                        workflow_run="123",
                        created_at="2026-11-03T00:00:00Z",
                        output_manifest=root / "manifest.json",
                        output_json_sha=root / "json.sha256",
                        output_gzip_sha=root / "gzip.sha256",
                    )
                )


if __name__ == "__main__":
    unittest.main()
