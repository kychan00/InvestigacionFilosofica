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
    "agronomy_confidence_canonical",
    "build_canonical_corpus_v1.py",
)


class AgronomyMetadataConflictProtectionV4Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = canonical.load_program_metadata_evidence_policy(
            THESIS_DIR
            / "config"
            / "program-metadata-evidence-confidence-v1.json"
        )

    def record(self, provider_id: str, program: str):
        return canonical.source_record(
            provider="riudg",
            provider_record_id=provider_id,
            source_url=None,
            raw_fields={
                "dc.title": ["Fixture"],
                "dc.degree.name": [program],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCBA"],
                "dc.date.accessioned": ["2015-09-09T12:00:00Z"],
                "dc.date.submitted": ["1990"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload=provider_id,
        )

    def evidence(self, provider_id: str, program: str):
        return canonical.evaluate_program_metadata_evidence(
            self.record(provider_id, program),
            program,
            self.policy,
        )

    def test_active_policy_revision_is_v5(self):
        self.assertEqual(
            self.policy["policyRevision"],
            "2026-11-02.v4",
        )

    def test_all_ten_agronomy_records_are_conflicted_and_blocked(self):
        ids = [
            "oai:riudg.udg.mx:20.500.12104/22430",
            "oai:riudg.udg.mx:20.500.12104/22565",
            "oai:riudg.udg.mx:20.500.12104/23366",
            "oai:riudg.udg.mx:20.500.12104/23825",
            "oai:riudg.udg.mx:20.500.12104/23902",
            "oai:riudg.udg.mx:20.500.12104/34293",
            "oai:riudg.udg.mx:20.500.12104/34304",
            "oai:riudg.udg.mx:20.500.12104/34356",
            "oai:riudg.udg.mx:20.500.12104/73463",
            "oai:riudg.udg.mx:20.500.12104/73466",
        ]
        for provider_id in ids:
            evidence = self.evidence(
                provider_id,
                "LICENCIATURA EN INGENIERO AGRONOMO",
            )
            self.assertEqual(
                evidence["confidenceState"],
                "conflicted",
            )
            self.assertEqual(
                evidence["authorityApplicability"],
                "blocked",
            )
            self.assertEqual(
                evidence["matchedRuleId"],
                "riudg-structural-program-metadata-conflicts-v1",
            )

    def test_unlisted_agronomy_record_remains_unassessed(self):
        evidence = self.evidence(
            "oai:riudg.udg.mx:20.500.12104/999999",
            "LICENCIATURA EN INGENIERO AGRONOMO",
        )
        self.assertEqual(
            evidence["confidenceState"],
            "unassessed",
        )
        self.assertEqual(
            evidence["authorityApplicability"],
            "allowed",
        )


if __name__ == "__main__":
    unittest.main()
