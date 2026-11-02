from __future__ import annotations

import importlib.util
import json
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
    "agronomy_v27_canonical",
    "build_canonical_corpus_v1.py",
)


class AgronomyProgramAuthorityV27Test(unittest.TestCase):
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
        cls.lineage = json.loads(
            (
                THESIS_DIR
                / "config"
                / "agronomy-program-lineage-evidence-v1.json"
            ).read_text()
        )
        cls.candidate_keys = {
            key
            for evidence_class in cls.lineage["evidenceClasses"]
            if evidence_class["authorityRecommendation"] == "candidate-v27"
            for key in evidence_class["programKeys"]
        }
        cls.hold_keys = {
            key
            for evidence_class in cls.lineage["evidenceClasses"]
            if evidence_class["authorityRecommendation"] == "hold"
            for key in evidence_class["programKeys"]
        }

    def record(
        self,
        provider_record_id: str,
        program: str,
        *,
        department: str = "CUCBA",
        title: str = "Trabajo agronómico",
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

    def test_v27_authority_is_exactly_lineage_candidate_set(self):
        authority = next(
            program
            for program in self.registry["programs"]
            if program["id"] == "program:udg:ingeniero-agronomo"
        )
        self.assertEqual(authority["canonicalName"], "Ingeniero Agrónomo")
        self.assertEqual(authority["level"], "licenciatura")
        self.assertEqual(
            authority["disciplineFamily"],
            "agronomia-ciencias-biologico-agropecuarias",
        )
        self.assertEqual(authority["admissionState"], "exclude")
        self.assertEqual(authority["observedCount"], 2155)
        self.assertEqual(set(authority["aliases"]), self.candidate_keys)
        self.assertEqual(len(self.candidate_keys), 16)
        self.assertEqual(len(self.hold_keys), 48)

    def test_every_candidate_label_resolves_to_v27(self):
        for raw_program in sorted(self.candidate_keys):
            with self.subTest(raw_program=raw_program):
                resolved = canonical.resolve_program(
                    raw_program,
                    self.registry,
                )
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:ingeniero-agronomo",
                )
                self.assertEqual(resolved["admissionState"], "exclude")

    def test_every_hold_label_remains_unknown(self):
        for raw_program in sorted(self.hold_keys):
            with self.subTest(raw_program=raw_program):
                resolved = canonical.resolve_program(
                    raw_program,
                    self.registry,
                )
                self.assertEqual(resolved["status"], "unknown")
                self.assertIsNone(resolved["programRef"])
                self.assertIsNone(resolved["canonicalName"])

    def test_current_official_name_resolves_to_v27(self):
        resolved = canonical.resolve_program(
            "Ingeniero Agrónomo",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            "program:udg:ingeniero-agronomo",
        )
        self.assertEqual(resolved["canonicalName"], "Ingeniero Agrónomo")

    def test_conflicted_core_candidate_remains_quarantine(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/34304",
                "LICENCIATURA EN INGENIERO AGRÓNOMO",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:ingeniero-agronomo",
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

    def test_candidate_side_of_candidate_hold_pair_is_blocked(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/34293",
                "LICENCIATURA EN INGENIERO AGRÓNOMO",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:ingeniero-agronomo",
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["authorityApplicability"],
            "blocked",
        )
        self.assertEqual(candidate["admission"]["status"], "quarantine")

    def test_hold_side_of_candidate_hold_pair_is_not_absorbed(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/73466",
                "LICENCIATURA EN INGENIERO AGRONOMOORIENTACIONFITOTECNIA",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertIsNone(candidate["program"]["programRef"])
        self.assertEqual(candidate["program"]["status"], "unknown")
        self.assertEqual(candidate["admission"]["status"], "quarantine")

    def test_unblocked_candidate_is_excluded(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/999999",
                "LICENCIATURA EN INGENIERO AGRÓNOMO ORIENTACIÓN ZOOTECNIA",
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

    def test_title_never_changes_v27_scope(self):
        first = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777778",
                "LICENCIATURA EN INGENIERO AGRÓNOMO ORIENTACIÓN BOSQUES",
                title="Filosofía ambiental y comunidad",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        second = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/777779",
                "LICENCIATURA EN INGENIERO AGRÓNOMO ORIENTACIÓN BOSQUES",
                title="Manejo forestal y productividad",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(first["admission"]["status"], "exclude")
        self.assertEqual(second["admission"]["status"], "exclude")


if __name__ == "__main__":
    unittest.main()
