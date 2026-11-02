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
