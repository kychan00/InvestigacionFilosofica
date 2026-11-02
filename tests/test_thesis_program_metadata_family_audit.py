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


family = load_module(
    "agronomy_family_audit",
    "audit_program_metadata_family_v1.py",
)


class AgronomyProgramMetadataFamilyAuditTest(unittest.TestCase):
    def source(self, source_id: str, provider_id: str, program: str):
        return {
            "id": source_id,
            "provider": "riudg",
            "providerRecordId": provider_id,
            "rawFields": {
                "dc.degree.name": [program],
                "dc.date.accessioned": ["2015-09-09T12:00:00Z"],
                "dc.date.submitted": ["1990"],
            },
        }

    def work(
        self,
        work_id: str,
        source_id: str,
        program: str,
        title: str,
        author: str,
    ):
        return {
            "id": work_id,
            "programRaw": program,
            "academicUnitRaw": "CUCBA",
            "title": title,
            "date": {
                "value": "1990",
                "quality": "valid",
            },
            "sourceRecordRefs": [source_id],
            "persistentIdentifiers": [
                {
                    "scheme": "handle",
                    "normalizedValue": work_id,
                }
            ],
            "contributions": [
                {
                    "role": "thesis-author",
                    "rawName": author,
                }
            ],
        }

    def test_structural_pair_is_frozen_without_authority(self):
        a = self.work(
            "a",
            "source-a",
            "LICENCIATURA EN INGENIERO AGRONOMO",
            "Mismo título",
            "Persona Uno",
        )
        b = self.work(
            "b",
            "source-b",
            (
                "LICENCIATURA EN INGENIERO AGRONOMO "
                "ORIENTACION SUELOS"
            ),
            "Mismo título",
            "Persona Uno",
        )
        audit = family.build_family_audit(
            {"works": [a, b]},
            [
                self.source(
                    "source-a",
                    "oai:test:a",
                    "LICENCIATURA EN INGENIERO AGRONOMO",
                ),
                self.source(
                    "source-b",
                    "oai:test:b",
                    (
                        "LICENCIATURA EN INGENIERO AGRONOMO "
                        "ORIENTACION SUELOS"
                    ),
                ),
            ],
            normalized_program_regex=(
                r"^licenciatura en ingeniero agronom"
            ),
            family_id="fixture",
        )

        self.assertEqual(audit["authorityDecision"], "hold")
        self.assertEqual(
            audit["decisionConstraint"],
            "family-audit-does-not-change-admission",
        )
        self.assertEqual(audit["metrics"]["works"], 2)
        self.assertEqual(
            audit["metrics"]["normalizedProgramGroups"],
            2,
        )
        self.assertEqual(
            audit["metrics"]["structuralConflictWorks"],
            2,
        )
        self.assertEqual(
            audit["metrics"]["structuralConflictPairs"],
            1,
        )
        self.assertEqual(
            audit["metrics"]["externalStructuralConflictPairs"],
            0,
        )
        self.assertTrue(
            audit["pairs"][0]["internalToSelectedFamily"]
        )

    def test_same_title_different_author_is_warning_only(self):
        a = self.work(
            "a",
            "source-a",
            "LICENCIATURA EN INGENIERO AGRONOMO",
            "Mismo título",
            "Persona Uno",
        )
        b = self.work(
            "b",
            "source-b",
            (
                "LICENCIATURA EN INGENIERO AGRONOMO "
                "ORIENTACION SUELOS"
            ),
            "Mismo título",
            "Persona Dos",
        )
        audit = family.build_family_audit(
            {"works": [a, b]},
            [
                self.source(
                    "source-a",
                    "oai:test:a",
                    "LICENCIATURA EN INGENIERO AGRONOMO",
                ),
                self.source(
                    "source-b",
                    "oai:test:b",
                    (
                        "LICENCIATURA EN INGENIERO AGRONOMO "
                        "ORIENTACION SUELOS"
                    ),
                ),
            ],
            normalized_program_regex=(
                r"^licenciatura en ingeniero agronom"
            ),
            family_id="fixture",
        )
        self.assertEqual(
            audit["metrics"]["structuralConflictPairs"],
            0,
        )
        self.assertEqual(
            audit["metrics"]["warningOnlyWorks"],
            2,
        )

    def test_regex_does_not_pull_unrelated_program(self):
        agronomy = self.work(
            "a",
            "source-a",
            "LICENCIATURA EN INGENIERO AGRONOMO",
            "A",
            "Persona Uno",
        )
        biology = self.work(
            "b",
            "source-b",
            "LICENCIATURA EN BIOLOGIA",
            "B",
            "Persona Dos",
        )
        audit = family.build_family_audit(
            {"works": [agronomy, biology]},
            [
                self.source(
                    "source-a",
                    "oai:test:a",
                    "LICENCIATURA EN INGENIERO AGRONOMO",
                ),
                self.source(
                    "source-b",
                    "oai:test:b",
                    "LICENCIATURA EN BIOLOGIA",
                ),
            ],
            normalized_program_regex=(
                r"^licenciatura en ingeniero agronom"
            ),
            family_id="fixture",
        )
        self.assertEqual(audit["metrics"]["works"], 1)
        self.assertEqual(
            audit["metrics"]["sourceProgramAgreementWorks"],
            1,
        )


if __name__ == "__main__":
    unittest.main()
