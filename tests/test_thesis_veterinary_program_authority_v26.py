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
    "veterinary_v26_canonical",
    "build_canonical_corpus_v1.py",
)


class VeterinaryProgramAuthorityV26Test(unittest.TestCase):
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
        department: str = "CUCBA",
        title: str = "Trabajo veterinario",
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
                "dc.degree.department": [department],
                "dc.date.accessioned": ["2015-09-09T12:00:00Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload=provider_record_id,
        )

    def test_registry_revision_is_v27(self):
        self.assertEqual(
            self.registry["registryRevision"],
            "2026-11-02.v32",
        )

    def test_historical_cucba_name_resolves_to_v26(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-medicina-veterinaria-zootecnia",
        )
        self.assertEqual(resolved["admissionState"], "exclude")

    def test_cusur_name_resolves_to_same_v26(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN MÉDICO VETERINARIO Y ZOOTECNISTA",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-medicina-veterinaria-zootecnia",
        )
        self.assertEqual(resolved["admissionState"], "exclude")

    def test_current_name_resolves_to_same_v26(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN MEDICINA VETERINARIA Y ZOOTECNIA",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-medicina-veterinaria-zootecnia",
        )
        self.assertEqual(
            resolved["canonicalName"],
            "Licenciatura en Medicina Veterinaria y Zootecnia",
        )

    def test_held_veterinario_y_zootecnista_name_is_not_an_alias(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN VETERINARIO Y ZOOTECNISTA",
            self.registry,
        )
        self.assertEqual(resolved["status"], "unknown")
        self.assertIsNone(resolved["programRef"])
        self.assertIsNone(resolved["canonicalName"])

    def test_conflicted_veterinary_record_remains_quarantine(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/21606",
                "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )

        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-medicina-veterinaria-zootecnia",
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

    def test_unblocked_historical_veterinary_record_is_excluded(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/999999",
                "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(candidate["admission"]["status"], "exclude")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "non-humanities-program",
        )

    def test_cusur_alias_is_excluded(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/888888",
                "LICENCIATURA EN MÉDICO VETERINARIO Y ZOOTECNISTA",
                department="CUSUR",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(candidate["admission"]["status"], "exclude")

    def test_held_group_stays_quarantine_even_with_medical_title(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777777",
                "LICENCIATURA EN VETERINARIO Y ZOOTECNISTA",
                department="CUCS",
                title="Aplicación de dispositivos intrauterinos",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertIsNone(candidate["program"]["programRef"])
        self.assertEqual(candidate["admission"]["status"], "quarantine")

    def test_title_never_changes_v26_scope(self):
        first = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777778",
                "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
                title="Ética, sociedad y animales",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        second = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777779",
                "LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA",
                title="Patología animal",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(first["admission"]["status"], "exclude")
        self.assertEqual(second["admission"]["status"], "exclude")


if __name__ == "__main__":
    unittest.main()
