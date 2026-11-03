"""T2BK — MCA generic-era authority V41 / Metadata Confidence V5."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))

import build_canonical_corpus_v1 as canonical


class McaGenericEraAuthorityV41Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry()
        cls.policy = canonical.load_program_metadata_evidence_policy()
        cls.baseline = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "mca-generic-era-authority-v41-baseline-v1.json"
            ).read_text(encoding="utf-8")
        )

    def record(self, provider_record_id, issued, submitted=None):
        fields = {
            "dc.title": ["Fixture neutral"],
            "dc.contributor.author": ["Persona, Ejemplo"],
            "dc.degree.name": ["Maestría En Ciencias De La Arquitectura"],
            "dc.degree.grantor": ["Universidad de Guadalajara"],
            "dc.degree.department": ["CUAAD"],
            "dc.date.accessioned": ["2019-06-09T12:00:00Z"],
            "dc.type": ["Tesis de Maestría"],
        }
        if issued is not None:
            fields["dc.date.issued"] = [issued]
        if submitted is not None:
            fields["dc.date.submitted"] = [submitted]
        return canonical.source_record(
            provider="riudg",
            provider_record_id=provider_record_id,
            source_url=None,
            raw_fields=fields,
            raw_payload=provider_record_id,
        )

    def test_active_revisions(self):
        self.assertEqual(self.baseline["registryRevision"], "2026-11-02.v41")
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v", 1)[1]),
            41,
        )
        self.assertEqual(
            self.policy["policyRevision"],
            self.baseline["programMetadataEvidenceRevision"],
        )

    def test_generic_mca_program_authority_is_include(self):
        for raw in (
            "Maestría En Ciencias De La Arquitectura",
            "MAESTRIA EN CIENCIAS DE LA ARQUITECTURA",
        ):
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(resolved["programRef"], self.baseline["programRef"])
                self.assertEqual(resolved["admissionState"], "include")

    def test_every_generic_record_outside_safe_era_fails_closed(self):
        unsafe_issued_values = (
            "1998-00-00",
            "2001-12-10",
            "2006-12-10",
            None,
            "0000-00-00",
            "2018-99-99",
            "2027-01-01",
        )
        for index, issued in enumerate(unsafe_issued_values):
            with self.subTest(issued=issued):
                candidate = canonical.canonical_candidate(
                    self.record(
                        f"oai:riudg.udg.mx:20.500.12104/unsafe-{index}",
                        issued,
                    ),
                    self.registry,
                    reference_year=2026,
                    program_metadata_policy=self.policy,
                )
                self.assertEqual(candidate["program"]["admissionState"], "include")
                self.assertEqual(
                    candidate["programMetadataEvidence"]["matchedRuleId"],
                    self.baseline["blockedEraRuleId"],
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

    def test_known_blocked_provider_ids_remain_quarantine(self):
        for record_id in self.baseline["expected"]["blockedProviderRecordIds"]:
            with self.subTest(record_id=record_id):
                candidate = canonical.canonical_candidate(
                    self.record(record_id, None),
                    self.registry,
                    reference_year=2026,
                    program_metadata_policy=self.policy,
                )
                self.assertEqual(
                    candidate["programMetadataEvidence"]["matchedRuleId"],
                    self.baseline["blockedEraRuleId"],
                )
                self.assertEqual(candidate["admission"]["status"], "quarantine")

    def test_valid_post_2006_generic_record_is_include(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/999999",
                "2018-12-10",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(candidate["program"]["admissionState"], "include")
        self.assertEqual(
            candidate["programMetadataEvidence"]["matchedRuleId"],
            self.baseline["safeEraRuleId"],
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["confidenceState"],
            "unassessed",
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["authorityApplicability"],
            "allowed",
        )
        self.assertEqual(candidate["admission"]["status"], "include")

    def test_valid_submitted_fallback_in_safe_era_is_include(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "oai:riudg.udg.mx:20.500.12104/submitted-safe",
                None,
                submitted="2014-00-00",
            ),
            self.registry,
            reference_year=2026,
            program_metadata_policy=self.policy,
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["matchedRuleId"],
            self.baseline["safeEraRuleId"],
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["authorityApplicability"],
            "allowed",
        )
        self.assertEqual(candidate["admission"]["status"], "include")

    def test_historical_explicit_orientations_are_distinct_review(self):
        fixtures = {
            "Maestría En Arquitectura; Orientacion Arte Y Comunicacion":
                "program:udg:mae-ciencias-arquitectura-arte-comunicacion",
            "Maestría En Arquitectura; Orientacion Urbanismo Y Desarrollo":
                "program:udg:mae-ciencias-arquitectura-urbanismo-desarrollo",
            "Maestría En Arquitectura; Edificacion Arquitectonica":
                "program:udg:mae-ciencias-arquitectura-edificacion-arquitectonica",
            "Maestría En Arquitectura; Orientacion Teoria Y Critica De La Arquitectura":
                "program:udg:mae-ciencias-arquitectura-teoria-critica-arquitectura",
        }
        for raw, expected_ref in fixtures.items():
            with self.subTest(raw=raw):
                resolved = canonical.resolve_program(raw, self.registry)
                self.assertEqual(resolved["programRef"], expected_ref)
                self.assertEqual(
                    resolved["admissionState"],
                    "exclude" if expected_ref in (
                        "program:udg:mae-ciencias-arquitectura-urbanismo-desarrollo",
                        "program:udg:mae-ciencias-arquitectura-edificacion-arquitectonica"
                    ) else "review",
                )

    def test_scope_policy_stays_v5(self):
        scope = json.loads(
            (
                ROOT
                / "scripts/thesis/config/"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            scope["policyRevision"],
            self.baseline["scopePolicyRevision"],
        )


if __name__ == "__main__":
    unittest.main()
