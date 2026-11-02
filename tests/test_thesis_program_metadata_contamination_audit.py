from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "audit_program_metadata_contamination_v1.py"
spec = importlib.util.spec_from_file_location("metadata_audit", MODULE_PATH)
audit = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(audit)


def source(
    source_id: str,
    *,
    degree_name: str,
    collection: str = "col_test",
) -> dict:
    return {
        "id": source_id,
        "provider": "riudg",
        "setSpecs": ["com_test", collection],
        "rawFields": {
            "dc.degree.name": [degree_name],
            "dc.degree.creator": ["LICENCIADO EN PSICOLOGÍA"],
        },
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
        "persistentIdentifiers": [
            {
                "scheme": "handle",
                "normalizedValue": f"20.500.12104/{work_id}",
            }
        ],
        "contributions": [
            {
                "role": "thesis-author",
                "rawName": author,
            }
        ],
    }


class ThesisProgramMetadataContaminationAuditTest(unittest.TestCase):
    def fixture(self):
        works = [
            work(
                "pre",
                title="Puentes con Ganchos de una Pieza, Removibles",
                author="Persona A",
                program="LICENCIATURA EN PSICOLOGÍA",
                year=1944,
                source_id="source:pre",
            ),
            work(
                "conflict-psych",
                title="Mismo trabajo",
                author="Persona B",
                program="LICENCIATURA EN PSICOLOGÍA",
                year=1991,
                source_id="source:conflict-psych",
            ),
            work(
                "conflict-medicine",
                title="Mismo trabajo",
                author="Persona B",
                program="LICENCIATURA EN MEDICINA",
                year=1991,
                source_id="source:conflict-medicine",
            ),
            work(
                "warning",
                title="Revisión de Pulpotomias y Pulpectomias",
                author="Persona C",
                program="LICENCIATURA EN PSICOLOGÍA",
                year=1990,
                source_id="source:warning",
            ),
            work(
                "ordinary",
                title="Autoconcepto y bienestar subjetivo",
                author="Persona D",
                program="LICENCIATURA EN PSICOLOGÍA",
                year=2017,
                source_id="source:ordinary",
            ),
        ]
        sources = [
            source(
                "source:pre",
                degree_name="LICENCIATURA EN PSICOLOGÍA",
            ),
            source(
                "source:conflict-psych",
                degree_name="LICENCIATURA EN PSICOLOGÍA",
            ),
            source(
                "source:conflict-medicine",
                degree_name="LICENCIATURA EN MEDICINA",
            ),
            source(
                "source:warning",
                degree_name="LICENCIATURA EN PSICOLOGÍA",
            ),
            source(
                "source:ordinary",
                degree_name="LICENCIATURA EN PSICOLOGÍA",
            ),
        ]
        return {"works": works}, sources

    def test_audit_preserves_hold_and_does_not_decide_admission(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
        )

        self.assertEqual(
            report["decisionConstraint"],
            "audit-does-not-change-admission",
        )
        self.assertEqual(report["authorityDecision"], "hold")
        self.assertEqual(
            report["conclusion"],
            "source-metadata-contamination-confirmed",
        )

    def test_source_degree_name_is_measured_separately_from_local_parser(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
        )

        metrics = report["metrics"]
        self.assertEqual(metrics["observedWorks"], 4)
        self.assertEqual(metrics["sourceProgramAgreementWorks"], 4)
        self.assertEqual(metrics["sourceProgramDisagreementWorks"], 0)

    def test_pre_foundation_and_identity_conflict_are_high_confidence(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
        )
        metrics = report["metrics"]

        self.assertEqual(metrics["preProgramFoundationWorks"], 1)
        self.assertEqual(
            metrics["exactTitleAuthorCrossProgramConflictWorks"],
            1,
        )
        self.assertEqual(metrics["highConfidenceAnomalyWorks"], 2)

    def test_title_domain_signal_is_warning_only(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
        )

        warning = next(
            item
            for item in report["records"]
            if item["workId"] == "warning"
        )
        self.assertEqual(warning["auditClass"], "warning-only")
        self.assertIn(
            "title-domain-warning:dental-procedural",
            warning["flags"],
        )

    def test_no_detected_contradiction_is_not_promoted_to_confirmed(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
        )

        ordinary = next(
            item
            for item in report["records"]
            if item["workId"] == "ordinary"
        )
        self.assertEqual(
            ordinary["auditClass"],
            "no-detected-contradiction",
        )
        self.assertEqual(report["authorityDecision"], "hold")

    def test_collection_context_exposes_degree_program_diversity(self):
        corpus, sources = self.fixture()
        report = audit.build_audit(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
        )

        collection = report["collectionAnalysis"][0]
        self.assertEqual(collection["collectionRecords"], 5)
        self.assertEqual(collection["targetWorks"], 4)
        self.assertEqual(collection["distinctDegreeProgramKeys"], 2)


if __name__ == "__main__":
    unittest.main()
