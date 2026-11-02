from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "audit_program_metadata_integrity_v2.py"
spec = importlib.util.spec_from_file_location(
    "program_metadata_integrity_v2",
    MODULE_PATH,
)
audit = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(audit)


def source(
    source_id: str,
    *,
    program: str,
    accession: str,
    issued: str | None = None,
    abstract: str | None = None,
    submitted: str | None = None,
) -> dict:
    raw = {
        "dc.degree.name": [program],
        "dc.date.accessioned": [accession],
    }
    if issued:
        raw["dc.date.issued"] = [issued]
    if abstract:
        raw["dc.description.abstract"] = [abstract]
    if submitted:
        raw["dc.date.submitted"] = [submitted]
    return {
        "id": source_id,
        "provider": "riudg",
        "setSpecs": ["com_test", "col_test"],
        "rawFields": raw,
    }


def work(
    work_id: str,
    *,
    title: str,
    author: str,
    program: str,
    year: int,
    source_id: str,
) -> dict:
    return {
        "id": work_id,
        "title": title,
        "programRaw": program,
        "academicUnitRaw": "CUCS",
        "date": {
            "raw": str(year),
            "value": str(year),
            "precision": "year",
            "quality": "valid",
        },
        "sourceRecordRefs": [source_id],
        "persistentIdentifiers": [],
        "contributions": [
            {
                "role": "thesis-author",
                "rawName": author,
            }
        ],
    }


class ProgramMetadataIntegrityAuditV2Test(unittest.TestCase):
    def fixture(self):
        target = "Licenciatura en Medicina"
        works = [
            work(
                "structural",
                title="Trabajo duplicado",
                author="Persona A",
                program=target,
                year=1991,
                source_id="source:structural",
            ),
            work(
                "warning",
                title="Título compartido",
                author="Persona B",
                program=target,
                year=1992,
                source_id="source:warning",
            ),
            work(
                "clean",
                title="Trabajo distinto",
                author="Persona C",
                program=target,
                year=2017,
                source_id="source:clean",
            ),
            work(
                "other-structural",
                title="Trabajo duplicado",
                author="Persona A",
                program="Licenciatura en Psicología",
                year=1991,
                source_id="source:other-structural",
            ),
            work(
                "other-warning",
                title="Título compartido",
                author="Otra Persona",
                program="Licenciatura en Odontología",
                year=1992,
                source_id="source:other-warning",
            ),
        ]
        sources = [
            source(
                "source:structural",
                program=target,
                accession="2015-09-09T10:00:00Z",
                submitted="1991",
            ),
            source(
                "source:warning",
                program=target,
                accession="2015-09-09T10:00:00Z",
                submitted="1992",
            ),
            source(
                "source:clean",
                program=target,
                accession="2018-01-01T10:00:00Z",
                issued="2017",
                abstract="Resumen",
            ),
            source(
                "source:other-structural",
                program="Licenciatura en Psicología",
                accession="2015-09-09T10:00:00Z",
            ),
            source(
                "source:other-warning",
                program="Licenciatura en Odontología",
                accession="2015-09-09T10:00:00Z",
            ),
        ]
        return {"works": works}, sources

    def test_same_title_and_author_is_structural_conflict(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Medicina",
            legacy_accession_day="2015-09-09",
        )

        self.assertEqual(
            report["metrics"][
                "exactTitleAuthorCrossProgramConflictWorks"
            ],
            1,
        )
        self.assertEqual(report["metrics"]["structuralConflictWorks"], 1)
        self.assertEqual(
            report["conclusion"],
            "source-program-metadata-conflict-confirmed",
        )

    def test_same_title_different_author_is_warning_only(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Medicina",
            legacy_accession_day="2015-09-09",
        )

        self.assertEqual(
            report["metrics"]["exactTitleCrossProgramConflictWorks"],
            2,
        )
        self.assertEqual(report["metrics"]["warningOnlyWorks"], 1)

    def test_source_program_agreement_proves_conflict_is_upstream(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Medicina",
            legacy_accession_day="2015-09-09",
        )

        self.assertEqual(
            report["metrics"]["sourceProgramAgreementWorks"],
            3,
        )
        self.assertEqual(
            report["metrics"]["sourceProgramDisagreementWorks"],
            0,
        )

    def test_legacy_cohort_is_measured_without_blanket_low_trust(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Medicina",
            legacy_accession_day="2015-09-09",
        )

        self.assertEqual(report["cohortAnalysis"]["legacy"]["works"], 2)
        self.assertEqual(
            report["cohortAnalysis"]["legacy"][
                "structuralConflictWorks"
            ],
            1,
        )
        self.assertEqual(report["cohortAnalysis"]["other"]["works"], 1)
        self.assertNotIn("authorityApplicability", report)
        self.assertEqual(report["authorityDecision"], "hold")

    def test_title_topic_is_not_an_integrity_signal(self):
        corpus, sources = self.fixture()
        target = next(
            item
            for item in corpus["works"]
            if item["id"] == "clean"
        )
        target["title"] = "Filosofía odontología veterinaria medicina"

        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Medicina",
            legacy_accession_day="2015-09-09",
        )

        record = next(
            item
            for item in report["records"]
            if item["workId"] == "clean"
        )
        self.assertEqual(record["auditClass"], "no-detected-conflict")

    def test_audit_never_changes_admission_or_creates_authority(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Medicina",
            legacy_accession_day="2015-09-09",
        )

        self.assertEqual(
            report["decisionConstraint"],
            "metadata-integrity-audit-does-not-change-admission",
        )
        self.assertEqual(report["authorityDecision"], "hold")


if __name__ == "__main__":
    unittest.main()
