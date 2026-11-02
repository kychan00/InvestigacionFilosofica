from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "audit_program_metadata_provenance_v1.py"
spec = importlib.util.spec_from_file_location("provenance_audit", MODULE_PATH)
audit = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(audit)


def source(
    source_id: str,
    *,
    accession: str,
    degree_name: str = "LICENCIATURA EN PSICOLOGÍA",
    issued: str | None = None,
    abstract: str | None = None,
    submitted: str | None = None,
) -> dict:
    raw = {
        "dc.degree.name": [degree_name],
        "dc.degree.creator": ["LICENCIADA EN PSICOLOGÍA"],
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


class ThesisProgramMetadataProvenanceAuditTest(unittest.TestCase):
    def fixture(self):
        works = [
            work(
                "legacy",
                title="Puentes con Ganchos de una Pieza, Removibles",
                author="Persona A",
                program="LICENCIATURA EN PSICOLOGÍA",
                year=1944,
                source_id="source:legacy",
            ),
            work(
                "later",
                title="Autoconcepto y bienestar subjetivo",
                author="Persona B",
                program="LICENCIATURA EN PSICOLOGÍA",
                year=2017,
                source_id="source:later",
            ),
        ]
        sources = [
            source(
                "source:legacy",
                accession="2015-09-09T18:02:20Z",
                submitted="1944",
            ),
            source(
                "source:later",
                accession="2018-01-16T12:00:00Z",
                issued="2017",
                abstract="Resumen",
            ),
        ]
        return {"works": works}, sources

    def test_separates_legacy_and_post_migration_cohorts(self):
        corpus, sources = self.fixture()
        report = audit.build_provenance_report(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
            legacy_accession_day="2015-09-09",
        )

        legacy = report["cohorts"]["legacy-migration-review"]
        later = report["cohorts"]["post-migration-review"]

        self.assertEqual(legacy["metrics"]["works"], 1)
        self.assertEqual(later["metrics"]["works"], 1)
        self.assertEqual(legacy["provenanceState"], "low-trust-review")
        self.assertEqual(later["provenanceState"], "higher-context-review")

    def test_legacy_structural_anomaly_does_not_change_admission(self):
        corpus, sources = self.fixture()
        report = audit.build_provenance_report(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
            legacy_accession_day="2015-09-09",
        )

        self.assertEqual(
            report["decisionConstraint"],
            "provenance-does-not-change-admission",
        )
        self.assertEqual(report["authorityDecision"], "hold")
        self.assertEqual(
            report["gateRecommendation"],
            "do-not-apply-program-authority-unconditionally",
        )

    def test_metadata_richness_is_measured_not_promoted_to_trust(self):
        corpus, sources = self.fixture()
        report = audit.build_provenance_report(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
            legacy_accession_day="2015-09-09",
        )

        later = report["cohorts"]["post-migration-review"]
        self.assertEqual(later["metrics"]["hasIssuedDate"], 1)
        self.assertEqual(later["metrics"]["hasAbstract"], 1)
        self.assertEqual(later["provenanceState"], "higher-context-review")
        self.assertNotEqual(later["provenanceState"], "trusted")

    def test_known_anomalies_can_concentrate_in_legacy_cohort(self):
        corpus, sources = self.fixture()
        report = audit.build_provenance_report(
            corpus,
            sources,
            target_program_key="Licenciatura en Psicología",
            foundation_year=1975,
            legacy_accession_day="2015-09-09",
        )

        concentration = report["anomalyConcentration"]
        self.assertTrue(concentration["allPreFoundationInLegacy"])
        self.assertTrue(concentration["legacyHasNoIssuedDates"])
        self.assertTrue(concentration["legacyHasNoAbstracts"])


if __name__ == "__main__":
    unittest.main()
