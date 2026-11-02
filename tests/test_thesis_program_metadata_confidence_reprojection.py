from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))


def load_module(name: str, filename: str):
    path = THESIS_DIR / filename
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


canonical = load_module(
    "confidence_reprojection_canonical",
    "build_canonical_corpus_v1.py",
)
reprojection = load_module(
    "confidence_reprojection",
    "reproject_program_metadata_confidence_snapshot_v1.py",
)


class ProgramMetadataConfidenceReprojectionTest(unittest.TestCase):
    def source(self, provider_record_id: str, program: str):
        return canonical.source_record(
            provider="riudg",
            provider_record_id=provider_record_id,
            source_url=None,
            raw_fields={
                "dc.degree.name": [program],
                "dc.date.accessioned": ["2015-09-09T12:00:00Z"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload=provider_record_id,
        )

    def test_reprojection_applies_current_policy_to_frozen_work(self):
        source = self.source(
            "oai:riudg.udg.mx:20.500.12104/32360",
            "LICENCIATURA EN MEDICINA",
        )
        corpus = {
            "works": [
                {
                    "id": "work:1",
                    "programRaw": "LICENCIATURA EN MEDICINA",
                    "sourceRecordRefs": [source["id"]],
                    "programMetadataEvidence": {
                        "confidenceState": "unassessed",
                        "authorityApplicability": "allowed",
                    },
                }
            ],
            "metrics": {},
        }

        policy = canonical.load_program_metadata_evidence_policy(
            THESIS_DIR
            / "config"
            / "program-metadata-evidence-confidence-v1.json"
        )
        projected, report = reprojection.reproject(
            corpus,
            [source],
            policy,
        )

        evidence = projected["works"][0]["programMetadataEvidence"]
        self.assertEqual(evidence["confidenceState"], "conflicted")
        self.assertEqual(evidence["authorityApplicability"], "blocked")
        self.assertEqual(
            report["metrics"]["confidenceStates"],
            {"conflicted": 1},
        )

    def test_reprojection_rejects_missing_source_record(self):
        policy = canonical.load_program_metadata_evidence_policy(
            THESIS_DIR
            / "config"
            / "program-metadata-evidence-confidence-v1.json"
        )
        with self.assertRaises(ValueError):
            reprojection.reproject(
                {
                    "works": [
                        {
                            "id": "work:missing",
                            "programRaw": "X",
                            "sourceRecordRefs": ["source:missing"],
                        }
                    ]
                },
                [],
                policy,
            )


if __name__ == "__main__":
    unittest.main()
