from __future__ import annotations

import copy
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
    "metadata_confidence_canonical",
    "build_canonical_corpus_v1.py",
)
coverage = load_module(
    "metadata_confidence_coverage",
    "audit_program_coverage_v1.py",
)
queue = load_module(
    "metadata_confidence_queue",
    "build_program_curation_queue_v1.py",
)
confidence_audit = load_module(
    "metadata_confidence_audit",
    "audit_program_metadata_evidence_confidence_v1.py",
)


class ThesisProgramMetadataEvidenceConfidenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )
        cls.default_policy = canonical.load_program_metadata_evidence_policy(
            THESIS_DIR
            / "config"
            / "program-metadata-evidence-confidence-v1.json"
        )

    def synthetic_registry(self):
        registry = copy.deepcopy(self.base_registry)
        registry["programs"].append(
            {
                "id": "program:fixture:synthetic-sensitive",
                "canonicalName": "Programa Sintético Sensible",
                "aliases": [],
                "level": "maestria",
                "disciplineFamily": "fixture",
                "admissionState": "include",
                "evidence": ["fixture://program-authority"],
            }
        )
        return registry

    def synthetic_policy(self):
        return {
            "schemaVersion": "thesis-program-metadata-evidence-confidence-v1",
            "policyRevision": "fixture.v1",
            "decisionConstraint": (
                "metadata-confidence-does-not-create-program-authority"
            ),
            "defaultResult": {
                "confidenceState": "unassessed",
                "authorityApplicability": "allowed",
                "reasonCode": "no-metadata-confidence-rule",
            },
            "rules": [
                {
                    "id": "fixture-low-trust",
                    "priority": 100,
                    "match": {
                        "providers": ["riudg"],
                        "programKeys": ["programa sintetico sensible"],
                        "accessionDays": ["2015-09-09"],
                        "allFieldsMissing": [
                            "dc.date.issued",
                            "dc.description.abstract",
                        ],
                    },
                    "result": {
                        "confidenceState": "low-trust",
                        "authorityApplicability": "blocked",
                        "reasonCode": "fixture-low-trust",
                    },
                }
            ],
        }

    def record(
        self,
        record_id: str,
        *,
        title: str = "Un título cualquiera",
        accession: str = "2015-09-09T10:00:00Z",
        issued: str | None = None,
        abstract: str | None = None,
    ):
        fields = {
            "dc.title": [title],
            "dc.contributor.author": ["Persona, Ejemplo"],
            "dc.degree.name": ["Programa Sintético Sensible"],
            "dc.degree.grantor": ["Universidad de Guadalajara"],
            "dc.degree.department": ["CUCS"],
            "dc.date.accessioned": [accession],
            "dc.date.submitted": ["2010"],
            "dc.type": ["Tesis de Maestría"],
        }
        if issued:
            fields["dc.date.issued"] = [issued]
        if abstract:
            fields["dc.description.abstract"] = [abstract]

        return canonical.source_record(
            provider="riudg",
            provider_record_id=record_id,
            source_url=None,
            raw_fields=fields,
            raw_payload=record_id,
        )

    def test_default_policy_marks_structural_conflict_record_as_conflicted(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id=(
                "oai:riudg.udg.mx:20.500.12104/32360"
            ),
            source_url=None,
            raw_fields={
                "dc.title": ["Ejemplo conflicted"],
                "dc.degree.name": ["LICENCIATURA EN MEDICINA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.accessioned": ["2015-09-09T18:02:20Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="medicine-conflict",
        )

        evidence = canonical.evaluate_program_metadata_evidence(
            record,
            "LICENCIATURA EN MEDICINA",
            self.default_policy,
        )

        self.assertEqual(evidence["confidenceState"], "conflicted")
        self.assertEqual(evidence["authorityApplicability"], "blocked")
        self.assertEqual(
            evidence["matchedRuleId"],
            "riudg-structural-program-metadata-conflicts-v1",
        )
        self.assertEqual(
            evidence["evidence"]["providerRecordId"],
            "oai:riudg.udg.mx:20.500.12104/32360",
        )

    def test_item_level_conflict_rule_outranks_psychology_legacy_rule(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id=(
                "oai:riudg.udg.mx:20.500.12104/33719"
            ),
            source_url=None,
            raw_fields={
                "dc.title": ["Ejemplo psychology conflicted"],
                "dc.degree.name": ["LICENCIATURA EN PSICOLOGÍA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.accessioned": ["2015-09-09T18:02:20Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="psychology-conflict",
        )

        evidence = canonical.evaluate_program_metadata_evidence(
            record,
            "LICENCIATURA EN PSICOLOGÍA",
            self.default_policy,
        )

        self.assertEqual(evidence["confidenceState"], "conflicted")
        self.assertEqual(evidence["authorityApplicability"], "blocked")
        self.assertEqual(
            evidence["matchedRuleId"],
            "riudg-structural-program-metadata-conflicts-v1",
        )

    def test_non_conflicted_medicine_record_remains_unassessed(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id=(
                "oai:riudg.udg.mx:20.500.12104/999999"
            ),
            source_url=None,
            raw_fields={
                "dc.title": ["Medicina no conflictiva"],
                "dc.degree.name": ["LICENCIATURA EN MEDICINA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.accessioned": ["2015-09-09T18:02:20Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="medicine-unassessed",
        )

        evidence = canonical.evaluate_program_metadata_evidence(
            record,
            "LICENCIATURA EN MEDICINA",
            self.default_policy,
        )

        self.assertEqual(evidence["confidenceState"], "unassessed")
        self.assertEqual(evidence["authorityApplicability"], "allowed")
        self.assertIsNone(evidence["matchedRuleId"])

    def test_default_policy_marks_legacy_psychology_cohort_low_trust(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id="psychology-legacy",
            source_url=None,
            raw_fields={
                "dc.title": ["Ejemplo"],
                "dc.degree.name": ["LICENCIATURA EN PSICOLOGÍA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.accessioned": ["2015-09-09T18:02:20Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="psychology-legacy",
        )

        evidence = canonical.evaluate_program_metadata_evidence(
            record,
            "LICENCIATURA EN PSICOLOGÍA",
            self.default_policy,
        )

        self.assertEqual(evidence["confidenceState"], "low-trust")
        self.assertEqual(evidence["authorityApplicability"], "blocked")
        self.assertEqual(
            evidence["matchedRuleId"],
            "riudg-psychology-legacy-migration-2015-09-09",
        )

    def test_post_migration_psychology_is_unassessed_not_trusted(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id="psychology-later",
            source_url=None,
            raw_fields={
                "dc.title": ["Ejemplo posterior"],
                "dc.degree.name": ["LICENCIATURA EN PSICOLOGÍA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.date.accessioned": ["2018-01-16T12:00:00Z"],
                "dc.date.issued": ["2017"],
                "dc.description.abstract": ["Resumen"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="psychology-later",
        )

        evidence = canonical.evaluate_program_metadata_evidence(
            record,
            "LICENCIATURA EN PSICOLOGÍA",
            self.default_policy,
        )

        self.assertEqual(evidence["confidenceState"], "unassessed")
        self.assertEqual(evidence["authorityApplicability"], "allowed")
        self.assertIsNone(evidence["matchedRuleId"])

    def test_psychology_v24_resolves_as_exclude_authority(self):
        resolved = canonical.resolve_program(
            "LICENCIATURA EN PSICOLOGÍA",
            self.base_registry,
        )

        self.assertEqual(
            resolved["programRef"],
            "program:udg:lic-psicologia",
        )
        self.assertEqual(resolved["admissionState"], "exclude")
        self.assertEqual(
            self.base_registry["registryRevision"],
            "2026-11-02.v24",
        )

    def test_psychology_v24_legacy_low_trust_remains_quarantine(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id="psychology-v24-legacy",
            source_url=None,
            raw_fields={
                "dc.title": ["Registro legado"],
                "dc.contributor.author": ["Persona, Ejemplo"],
                "dc.degree.name": ["LICENCIATURA EN PSICOLOGÍA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCS"],
                "dc.date.accessioned": ["2015-09-09T18:02:20Z"],
                "dc.date.submitted": ["1991"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="psychology-v24-legacy",
        )

        candidate = canonical.canonical_candidate(
            record,
            self.base_registry,
            reference_year=2026,
            program_metadata_policy=self.default_policy,
        )

        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-psicologia",
        )
        self.assertEqual(
            candidate["program"]["admissionState"],
            "exclude",
        )
        self.assertEqual(
            candidate["programMetadataEvidence"]["confidenceState"],
            "low-trust",
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

    def test_psychology_v24_post_migration_unassessed_is_excluded(self):
        record = canonical.source_record(
            provider="riudg",
            provider_record_id="psychology-v24-later",
            source_url=None,
            raw_fields={
                "dc.title": ["Registro posterior"],
                "dc.contributor.author": ["Persona, Ejemplo"],
                "dc.degree.name": ["LICENCIATURA EN PSICOLOGÍA"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUVALLES"],
                "dc.date.accessioned": ["2018-01-16T12:00:00Z"],
                "dc.date.issued": ["2017"],
                "dc.description.abstract": ["Resumen"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="psychology-v24-later",
        )

        candidate = canonical.canonical_candidate(
            record,
            self.base_registry,
            reference_year=2026,
            program_metadata_policy=self.default_policy,
        )

        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-psicologia",
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

    def test_low_trust_metadata_blocks_future_include_authority(self):
        candidate = canonical.canonical_candidate(
            self.record("blocked"),
            self.synthetic_registry(),
            reference_year=2026,
            program_metadata_policy=self.synthetic_policy(),
        )

        self.assertEqual(candidate["program"]["status"], "confirmed")
        self.assertEqual(candidate["program"]["admissionState"], "include")
        self.assertEqual(
            candidate["programMetadataEvidence"]["confidenceState"],
            "low-trust",
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

    def test_unassessed_default_preserves_existing_authority_behavior(self):
        candidate = canonical.canonical_candidate(
            self.record(
                "allowed",
                accession="2018-01-16T12:00:00Z",
                issued="2017",
                abstract="Resumen",
            ),
            self.synthetic_registry(),
            reference_year=2026,
            program_metadata_policy=self.synthetic_policy(),
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

    def test_title_never_controls_metadata_confidence(self):
        policy = self.synthetic_policy()
        first = canonical.evaluate_program_metadata_evidence(
            self.record("title-a", title="Odontología y prótesis"),
            "Programa Sintético Sensible",
            policy,
        )
        second = canonical.evaluate_program_metadata_evidence(
            self.record("title-b", title="Filosofía y subjetividad"),
            "Programa Sintético Sensible",
            policy,
        )

        self.assertEqual(first["confidenceState"], second["confidenceState"])
        self.assertEqual(
            first["authorityApplicability"],
            second["authorityApplicability"],
        )

    def test_corpus_pins_policy_revision_and_metrics(self):
        corpus = canonical.build_corpus(
            [
                self.record("blocked-corpus"),
                self.record(
                    "allowed-corpus",
                    accession="2018-01-16T12:00:00Z",
                    issued="2017",
                    abstract="Resumen",
                ),
            ],
            self.synthetic_registry(),
            reference_year=2026,
            program_metadata_policy=self.synthetic_policy(),
        )

        self.assertEqual(corpus["programMetadataEvidenceRevision"], "fixture.v1")
        self.assertEqual(
            corpus["metrics"]["programMetadataConfidenceStates"],
            {"low-trust": 1, "unassessed": 1},
        )
        self.assertEqual(
            corpus["metrics"]["programAuthorityApplicability"],
            {"blocked": 1, "allowed": 1},
        )
        self.assertEqual(
            corpus["metrics"]["worksByAdmission"],
            {"quarantine": 1, "include": 1},
        )

    def test_coverage_reprojection_respects_blocked_evidence(self):
        work = {
            "id": "coverage-blocked",
            "title": "Coverage blocked",
            "programRaw": "Programa Sintético Sensible",
            "programRef": None,
            "institutionRaw": "Universidad de Guadalajara",
            "institutionRef": "institution:udg",
            "academicUnitRaw": "CUCS",
            "thesisTypeRaw": "Tesis",
            "admissionStatus": "quarantine",
            "admissionExplanationCodes": [],
            "date": {
                "raw": "2010",
                "value": "2010",
                "precision": "year",
                "quality": "valid",
            },
            "sourceRecordRefs": ["source:coverage-blocked"],
            "persistentIdentifiers": [],
            "programMetadataEvidence": {
                "policyRevision": "fixture.v1",
                "confidenceState": "low-trust",
                "authorityApplicability": "blocked",
                "reasonCode": "fixture-low-trust",
                "matchedRuleId": "fixture-low-trust",
            },
        }

        projection = coverage.project_work_admission(
            work,
            self.synthetic_registry(),
        )

        self.assertEqual(projection["status"], "quarantine")
        self.assertEqual(
            projection["explanationCode"],
            "program-authority-blocked-by-metadata-confidence",
        )

    def test_confidence_audit_surfaces_blocked_rule_and_queue_item(self):
        corpus = {
            "programMetadataEvidenceRevision": "fixture.v1",
            "programAuthorityRevision": "fixture-authority",
            "works": [
                {
                    "id": "audit-blocked",
                    "programRaw": "Programa Sintético Sensible",
                    "programRef": "program:fixture:synthetic-sensitive",
                    "admissionStatus": "quarantine",
                    "programMetadataEvidence": {
                        "confidenceState": "low-trust",
                        "authorityApplicability": "blocked",
                        "matchedRuleId": "fixture-low-trust",
                    },
                }
            ],
        }
        queue_payload = {
            "items": [
                {
                    "rank": 1,
                    "normalizedKey": "programa sintetico sensible",
                    "count": 1,
                    "queueState": "metadata-review",
                    "curationLane": "metadata-confidence-review",
                    "authority": {
                        "id": "program:fixture:synthetic-sensitive"
                    },
                    "programMetadataEvidence": {
                        "confidenceStates": {"low-trust": 1},
                        "authorityApplicability": {"blocked": 1},
                        "blockedWorks": 1,
                    },
                }
            ]
        }

        report = confidence_audit.build_audit(corpus, queue_payload)

        self.assertEqual(report["metrics"]["blockedWorks"], 1)
        self.assertEqual(report["metrics"]["metadataReviewQueueItems"], 1)
        self.assertEqual(
            report["metrics"]["ruleMatches"],
            {"fixture-low-trust": 1},
        )
        self.assertEqual(report["metrics"]["violations"], 0)

    def test_queue_keeps_metadata_blocked_program_visible(self):
        registry = self.synthetic_registry()
        observed = {
            "programs": [
                {
                    "normalizedKey": "programa sintetico sensible",
                    "count": 1,
                    "variants": {"Programa Sintético Sensible": 1},
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"quarantine": 1},
                    "programRefs": {
                        "program:fixture:synthetic-sensitive": 1
                    },
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Programa Sintético Sensible",
                    "academicUnitRaw": "CUCS",
                    "date": {"value": "2010", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                    "programMetadataEvidence": {
                        "confidenceState": "low-trust",
                        "authorityApplicability": "blocked",
                        "matchedRuleId": "fixture-low-trust",
                    },
                }
            ]
        }

        payload = queue.build_queue(observed, corpus, registry)
        item = payload["items"][0]

        self.assertEqual(item["queueState"], "metadata-review")
        self.assertEqual(
            item["curationLane"],
            "metadata-confidence-review",
        )
        self.assertEqual(
            item["programMetadataEvidence"]["blockedWorks"],
            1,
        )
        self.assertIn(
            "program-metadata-confidence-evidence",
            item["evidenceNeeds"],
        )


if __name__ == "__main__":
    unittest.main()
