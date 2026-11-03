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
    "medicine_v25_canonical",
    "build_canonical_corpus_v1.py",
)


class MedicineProgramAuthorityV25Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )
        cls.policy = canonical.load_program_metadata_evidence_policy(
            THESIS_DIR
            / "config"
            / "program-metadata-evidence-confidence-v1.json"
        )

    def record(
        self,
        provider_record_id: str,
        program: str,
        *,
        title: str = "Trabajo de medicina",
    ):
        return canonical.source_record(
            provider="riudg",
            provider_record_id=provider_record_id,
            source_url=None,
            raw_fields={
                "dc.title": [title],
                "dc.contributor.author": ["Persona, Ejemplo"],
                "dc.degree.name": [program],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCS"],
                "dc.date.accessioned": ["2015-09-09T18:02:20Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload=provider_record_id,
        )

    def test_global_registry_revision_is_v27(self):
        self.assertEqual(
            self.registry["registryRevision"],
            "2026-11-02.v40",
        )

    def test_historical_medicine_name_resolves_to_v25(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN MEDICINA",
            self.registry,
        )

        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-medico-cirujano-partero",
        )
        self.assertEqual(
            resolved["canonicalName"],
            "Licenciatura en Médico Cirujano y Partero",
        )
        self.assertEqual(resolved["admissionState"], "exclude")

    def test_medico_cirujano_y_partero_name_resolves_to_same_v25(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN MÉDICO CIRUJANO Y PARTERO",
            self.registry,
        )

        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-medico-cirujano-partero",
        )
        self.assertEqual(resolved["admissionState"], "exclude")

    def test_current_short_name_resolves_to_same_v25(self):
        resolved = canonical.resolve_program(
            "Médico Cirujano y Partero",
            self.registry,
        )

        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-medico-cirujano-partero",
        )

    def test_conflicted_medicine_record_remains_quarantine(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/32360",
                "LICENCIATURA EN MEDICINA",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )

        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-medico-cirujano-partero",
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["confidenceState"],
            "conflicted",
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["authorityApplicability"],
            "blocked",
        )
        self.assertEqual(candidate["admission"]["status"], "quarantine")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "program-authority-blocked-by-metadata-confidence",
        )

    def test_unblocked_medicine_record_is_excluded(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/999999",
                "LICENCIATURA EN MEDICINA",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )

        self.assertEqual(
            candidate["programMetadataEvidence"]["confidenceState"],
            "unassessed",
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["authorityApplicability"],
            "allowed",
        )
        self.assertEqual(candidate["admission"]["status"], "exclude")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "non-humanities-program",
        )

    def test_medico_cirujano_y_partero_alias_is_excluded(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/888888",
                "LICENCIATURA EN MÉDICO CIRUJANO Y PARTERO",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )

        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-medico-cirujano-partero",
        )
        self.assertEqual(candidate["admission"]["status"], "exclude")

    def test_title_never_changes_medicine_authority(self):
        first = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777777",
                "LICENCIATURA EN MEDICINA",
                title="Filosofía y subjetividad",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        second = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777778",
                "LICENCIATURA EN MEDICINA",
                title="Cirugía cardiovascular",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )

        self.assertEqual(first["admission"]["status"], "exclude")
        self.assertEqual(second["admission"]["status"], "exclude")


if __name__ == "__main__":
    unittest.main()
