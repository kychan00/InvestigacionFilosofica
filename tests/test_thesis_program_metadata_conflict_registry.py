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


registry = load_module(
    "program_metadata_conflict_registry",
    "build_program_metadata_conflict_registry_v1.py",
)


def source(
    source_id: str,
    provider_record_id: str,
    *,
    accession: str = "2015-09-09T18:00:00Z",
) -> dict:
    return {
        "id": source_id,
        "provider": "riudg",
        "providerRecordId": provider_record_id,
        "setSpecs": ["col_fixture"],
        "rawFields": {
            "dc.date.accessioned": [accession],
        },
    }


def work(
    work_id: str,
    source_id: str,
    *,
    title: str,
    author: str,
    program: str,
    handle: str,
) -> dict:
    return {
        "id": work_id,
        "title": title,
        "programRaw": program,
        "academicUnitRaw": "CUCS",
        "date": {
            "value": "1991",
            "quality": "valid",
        },
        "sourceRecordRefs": [source_id],
        "persistentIdentifiers": [
            {
                "scheme": "handle",
                "normalizedValue": handle,
            }
        ],
        "contributions": [
            {
                "role": "thesis-author",
                "rawName": author,
            }
        ],
    }


class ProgramMetadataConflictRegistryV1Test(unittest.TestCase):
    def fixture(self):
        target = work(
            "work:medicine",
            "source:medicine",
            title="Mismo trabajo",
            author="Persona Ejemplo",
            program="Licenciatura en Medicina",
            handle="20.500.12104/1",
        )
        alternate = work(
            "work:psychology",
            "source:psychology",
            title="Mismo trabajo",
            author="Persona Ejemplo",
            program="Licenciatura en Psicología",
            handle="20.500.12104/2",
        )
        warning = work(
            "work:warning",
            "source:warning",
            title="Otro trabajo",
            author="Otra Persona",
            program="Licenciatura en Medicina",
            handle="20.500.12104/3",
        )
        corpus = {
            "works": [target, alternate, warning],
        }
        sources = [
            source(
                "source:medicine",
                "oai:riudg.udg.mx:20.500.12104/1",
            ),
            source(
                "source:psychology",
                "oai:riudg.udg.mx:20.500.12104/2",
            ),
            source(
                "source:warning",
                "oai:riudg.udg.mx:20.500.12104/3",
            ),
        ]
        audit = {
            "schemaVersion": "thesis-program-metadata-integrity-audit-v2",
            "targetProgramKey": "licenciatura en medicina",
            "records": [
                {
                    "workId": "work:medicine",
                    "auditClass": "structural-conflict",
                },
                {
                    "workId": "work:warning",
                    "auditClass": "cross-program-title-warning",
                },
            ],
        }
        return audit, corpus, sources

    def test_registry_captures_both_sides_of_structural_pair(self):
        audit, corpus, sources = self.fixture()
        payload = registry.build_registry(audit, corpus, sources)

        self.assertEqual(payload["metrics"]["conflictPairs"], 1)
        self.assertEqual(payload["metrics"]["uniqueWorks"], 2)
        self.assertEqual(payload["metrics"]["uniqueSourceRecords"], 2)
        pair = payload["pairs"][0]
        self.assertEqual(
            pair["target"]["programKey"],
            "licenciatura en medicina",
        )
        self.assertEqual(
            pair["alternate"]["programKey"],
            "licenciatura en psicologia",
        )

    def test_pair_id_is_stable_from_provider_record_ids(self):
        first = registry.stable_pair_id(
            "oai:riudg.udg.mx:20.500.12104/1",
            "oai:riudg.udg.mx:20.500.12104/2",
        )
        second = registry.stable_pair_id(
            "oai:riudg.udg.mx:20.500.12104/2",
            "oai:riudg.udg.mx:20.500.12104/1",
        )
        self.assertEqual(first, second)

    def test_registry_recommends_blocking_but_does_not_apply_it(self):
        audit, corpus, sources = self.fixture()
        payload = registry.build_registry(audit, corpus, sources)
        pair = payload["pairs"][0]

        self.assertEqual(
            payload["decisionConstraint"],
            "conflict-registry-does-not-change-admission",
        )
        self.assertEqual(payload["applicationState"], "recommendation-only")
        self.assertEqual(payload["authorityDecision"], "hold")
        self.assertEqual(
            pair["recommendedConfidenceState"],
            "conflicted",
        )
        self.assertEqual(
            pair["recommendedAuthorityApplicability"],
            "blocked",
        )

    def test_warning_only_record_is_not_promoted_to_structural_pair(self):
        audit, corpus, sources = self.fixture()
        payload = registry.build_registry(audit, corpus, sources)

        ids = {
            pair["target"]["workId"]
            for pair in payload["pairs"]
        }
        self.assertNotIn("work:warning", ids)

    def test_empty_sample_is_valid(self):
        payload = registry.build_registry(
            {
                "schemaVersion": "thesis-program-metadata-integrity-audit-v2",
                "targetProgramKey": "licenciatura en medicina",
                "records": [],
            },
            {"works": []},
            [],
        )

        self.assertEqual(payload["metrics"]["conflictPairs"], 0)
        self.assertEqual(payload["pairs"], [])
        self.assertEqual(payload["authorityDecision"], "hold")


if __name__ == "__main__":
    unittest.main()
