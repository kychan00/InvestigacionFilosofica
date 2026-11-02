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


lineage = load_module(
    "program_lineage_matrix",
    "build_program_lineage_evidence_matrix_v1.py",
)


class ProgramLineageEvidenceMatrixV1Test(unittest.TestCase):
    def family(self):
        return {
            "familyId": "fixture",
            "programGroups": [
                {
                    "normalizedKey": "program a",
                    "works": 3,
                },
                {
                    "normalizedKey": "program b",
                    "works": 2,
                },
                {
                    "normalizedKey": "program c",
                    "works": 1,
                },
            ],
            "pairs": [
                {
                    "pairId": "pair:1",
                    "sides": [
                        {
                            "programKey": "program a",
                            "providerRecordId": "a",
                        },
                        {
                            "programKey": "program b",
                            "providerRecordId": "b",
                        },
                    ],
                },
                {
                    "pairId": "pair:2",
                    "sides": [
                        {
                            "programKey": "program b",
                            "providerRecordId": "c",
                        },
                        {
                            "programKey": "program c",
                            "providerRecordId": "d",
                        },
                    ],
                },
            ],
        }

    def config(self):
        return {
            "familyId": "fixture",
            "decisionConstraint": (
                "lineage-evidence-does-not-create-program-authority"
            ),
            "candidateAuthorityId": "program:fixture",
            "evidenceClasses": [
                {
                    "id": "confirmed",
                    "authorityRecommendation": "candidate-v27",
                    "evidenceLevel": "direct",
                    "rationale": "fixture",
                    "programKeys": ["program a"],
                },
                {
                    "id": "hold",
                    "authorityRecommendation": "hold",
                    "evidenceLevel": "repository-only",
                    "rationale": "fixture",
                    "programKeys": [
                        "program b",
                        "program c",
                    ],
                },
            ],
        }

    def test_matrix_is_non_admissive_and_complete(self):
        matrix = lineage.build_matrix(
            self.family(),
            self.config(),
        )
        self.assertEqual(
            matrix["decisionConstraint"],
            "lineage-evidence-does-not-create-program-authority",
        )
        self.assertEqual(matrix["authorityDecision"], "hold")
        self.assertEqual(matrix["summary"]["familyGroups"], 3)
        self.assertEqual(matrix["summary"]["familyWorks"], 6)
        self.assertEqual(
            matrix["summary"]["candidateV27"],
            {"groups": 1, "works": 3},
        )
        self.assertEqual(
            matrix["summary"]["hold"],
            {"groups": 2, "works": 3},
        )
        self.assertEqual(
            matrix["summary"]["structuralPairDisposition"],
            {
                "candidate|hold": 1,
                "hold|hold": 1,
            },
        )

    def test_duplicate_classification_is_rejected(self):
        config = self.config()
        config["evidenceClasses"][1]["programKeys"].append(
            "program a"
        )
        with self.assertRaisesRegex(
            ValueError,
            "classified more than once",
        ):
            lineage.build_matrix(self.family(), config)

    def test_missing_classification_is_rejected(self):
        config = self.config()
        config["evidenceClasses"][1]["programKeys"].remove(
            "program c"
        )
        with self.assertRaisesRegex(
            ValueError,
            "missing from lineage config",
        ):
            lineage.build_matrix(self.family(), config)

    def test_unobserved_config_key_is_rejected(self):
        config = self.config()
        config["evidenceClasses"][1]["programKeys"].append(
            "program ghost"
        )
        with self.assertRaisesRegex(
            ValueError,
            "unobserved program keys",
        ):
            lineage.build_matrix(self.family(), config)


if __name__ == "__main__":
    unittest.main()
