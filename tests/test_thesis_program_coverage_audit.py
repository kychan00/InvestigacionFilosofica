from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "audit_program_coverage_v1.py"
spec = importlib.util.spec_from_file_location("coverage_audit", MODULE_PATH)
audit = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(audit)

canonical = audit.canonical


class ThesisProgramCoverageAuditTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )

    def work(
        self,
        *,
        work_id: str,
        program: str | None,
        institution_ref: str | None,
        admission: str,
        raw_date: str | None = "2024",
        institution_raw: str | None = None,
    ):
        if institution_raw is None and institution_ref == "institution:udg":
            institution_raw = "Universidad de Guadalajara"
        return {
            "id": work_id,
            "title": work_id,
            "programRaw": program,
            "programRef": None,
            "institutionRaw": institution_raw,
            "institutionRef": institution_ref,
            "academicUnitRaw": "CUAAD",
            "thesisTypeRaw": "Thesis",
            "admissionStatus": admission,
            "admissionExplanationCodes": [],
            "date": {
                "raw": raw_date,
                "value": raw_date,
                "precision": "year",
                "quality": "valid",
            },
            "sourceRecordRefs": [f"source:{work_id}"],
            "persistentIdentifiers": [],
        }

    def test_include_program_does_not_override_unresolved_institution(self):
        work = self.work(
            work_id="blocked",
            program="Maestría en Gestión de la Cultura",
            institution_ref=None,
            admission="quarantine",
        )
        projected = audit.project_work_admission(work, self.registry)

        self.assertEqual(
            projected["program"]["programRef"],
            "program:udg:mae-gestion-cultura",
        )
        self.assertEqual(
            projected["program"]["admissionState"],
            "include",
        )
        self.assertEqual(projected["status"], "quarantine")
        self.assertEqual(
            projected["explanationCode"],
            "unresolved-institution",
        )

    def test_review_program_reprojects_to_review_with_udg_institution(self):
        work = self.work(
            work_id="review",
            program="Maestría en Ciencias de la Arquitectura",
            institution_ref="institution:udg",
            admission="quarantine",
        )
        projected = audit.project_work_admission(work, self.registry)

        self.assertEqual(projected["status"], "review")
        self.assertEqual(
            projected["program"]["programRef"],
            "program:udg:mae-ciencias-arquitectura",
        )

    def test_audit_reprojects_current_institution_alias_policy(self):
        typo = self.work(
            work_id="udg-typo",
            program="Programa desconocido",
            institution_ref=None,
            institution_raw="Universidad en Guadalajara",
            admission="exclude",
        )
        external = self.work(
            work_id="external-college",
            program="Doctorado en Antropología Social",
            institution_ref=None,
            institution_raw="El Colegio de Michoacán A.C.",
            admission="quarantine",
        )

        typo_projection = audit.project_work_admission(
            typo,
            self.registry,
        )
        external_projection = audit.project_work_admission(
            external,
            self.registry,
        )

        self.assertEqual(
            typo_projection["institution"]["status"],
            "confirmed",
        )
        self.assertEqual(
            typo_projection["institutionRef"],
            "institution:udg",
        )
        self.assertEqual(typo_projection["status"], "quarantine")
        self.assertEqual(
            typo_projection["explanationCode"],
            "unknown-program",
        )

        self.assertEqual(
            external_projection["institution"]["status"],
            "external",
        )
        self.assertEqual(external_projection["status"], "exclude")
        self.assertEqual(
            external_projection["explanationCode"],
            "external-institution",
        )

    def test_reprojection_updates_date_quality_and_gate_blockers(self):
        corpus = {
            "buildRevision": "fixture",
            "programAuthorityRevision": "old",
            "works": [
                self.work(
                    work_id="include",
                    program="Doctorado Interinstitucional en Arte y Cultura",
                    institution_ref="institution:udg",
                    admission="quarantine",
                    raw_date="2020",
                ),
                self.work(
                    work_id="blocked",
                    program="Maestría en Gestión de la Cultura",
                    institution_ref=None,
                    admission="quarantine",
                    raw_date="1969-12-31",
                ),
                self.work(
                    work_id="review",
                    program="Maestría en Ciencias de la Arquitectura",
                    institution_ref="institution:udg",
                    admission="quarantine",
                    raw_date="2021",
                ),
                self.work(
                    work_id="external",
                    program="Maestría en Gestión de la Cultura",
                    institution_ref=None,
                    institution_raw="El Colegio de Michoacán A.C.",
                    admission="exclude",
                    raw_date="2022",
                ),
                self.work(
                    work_id="reject",
                    program=None,
                    institution_ref=None,
                    admission="reject-source",
                    raw_date=None,
                ),
            ],
        }

        projected, metrics = audit.reproject_corpus(
            corpus,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(
            metrics["projectedAdmission"],
            {
                "exclude": 1,
                "include": 1,
                "quarantine": 1,
                "reject-source": 1,
                "review": 1,
            },
        )
        self.assertEqual(metrics["gateBlockerCount"], 2)
        blockers = {
            item["workId"]: item["explanationCode"]
            for item in metrics["gateBlockers"]
        }
        self.assertEqual(
            blockers,
            {
                "blocked": "unresolved-institution",
                "external": "external-institution",
            },
        )
        self.assertEqual(metrics["dateQuality"]["suspicious"], 1)
        self.assertEqual(
            projected["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

    def test_art_theory_v6_reprojects_to_include(self):
        observed = {
            "schemaVersion": "fixture",
            "programs": [
                {
                    "normalizedKey": "maestria en teoria del arte",
                    "count": 1,
                    "variants": {
                        "Maestría En Teoria Del Arte": 1,
                    },
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"quarantine": 1},
                    "programRefs": {},
                }
            ],
        }
        corpus = {
            "buildRevision": "fixture",
            "programAuthorityRevision": "old",
            "works": [
                self.work(
                    work_id="art-theory",
                    program="Maestría En Teoria Del Arte",
                    institution_ref="institution:udg",
                    admission="quarantine",
                    raw_date="2004-06-00",
                )
            ],
        }

        result = audit.build_audit(
            observed=observed,
            corpus=corpus,
            registry=self.registry,
            reference_year=2026,
            top=10,
        )

        self.assertEqual(
            result["metrics"]["projectedAdmission"],
            {"include": 1},
        )
        self.assertEqual(
            result["metrics"]["programStateWorks"],
            {"include": 1},
        )
        self.assertEqual(
            result["metrics"]["programQueue"]["queueItems"],
            0,
        )
        self.assertEqual(
            result["programAuthorityRevision"],
            "2026-11-01.v6",
        )

    def test_build_audit_separates_resolved_programs_from_gate_admission(self):
        observed = {
            "schemaVersion": "fixture",
            "programs": [
                {
                    "normalizedKey": "maestria en gestion de la cultura",
                    "count": 2,
                    "variants": {
                        "Maestría en Gestión de la Cultura": 2,
                    },
                    "providers": {"udgvirtual": 2},
                    "admissionStatuses": {"quarantine": 2},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "maestria en didactica de las artes",
                    "count": 1,
                    "variants": {
                        "Maestría en Didáctica de las Artes": 1,
                    },
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"quarantine": 1},
                    "programRefs": {},
                },
            ],
        }
        corpus = {
            "buildRevision": "fixture",
            "programAuthorityRevision": "old",
            "works": [
                self.work(
                    work_id="admitted",
                    program="Maestría en Gestión de la Cultura",
                    institution_ref="institution:udg",
                    admission="quarantine",
                ),
                self.work(
                    work_id="blocked",
                    program="Maestría en Gestión de la Cultura",
                    institution_ref=None,
                    admission="quarantine",
                ),
                self.work(
                    work_id="ambiguous",
                    program="Maestría en Didáctica de las Artes",
                    institution_ref="institution:udg",
                    admission="quarantine",
                ),
            ],
        }

        result = audit.build_audit(
            observed=observed,
            corpus=corpus,
            registry=self.registry,
            reference_year=2026,
            top=10,
        )

        self.assertEqual(
            result["institutionAuthorityRevision"],
            self.registry["institutionRevision"],
        )
        self.assertEqual(result["metrics"]["gateBlockerCount"], 1)
        self.assertEqual(
            result["metrics"]["projectedAdmission"],
            {"include": 1, "quarantine": 2},
        )
        self.assertEqual(
            result["metrics"]["programQueue"]["allProgramStates"],
            {"resolved": 1, "unresolved": 1},
        )
        self.assertEqual(len(result["topUnresolved"]), 1)
        self.assertEqual(
            result["topUnresolved"][0]["normalizedKey"],
            "maestria en didactica de las artes",
        )


if __name__ == "__main__":
    unittest.main()
