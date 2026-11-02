from __future__ import annotations

import copy
import importlib.util
import json
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "build_scope_boundary_matrix_v1.py"
spec = importlib.util.spec_from_file_location("scope_boundary", MODULE_PATH)
scope = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(scope)

canonical = scope.canonical


class ThesisScopeBoundaryMatrixTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )
        cls.config = json.loads(
            (
                THESIS_DIR
                / "config"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )

    def test_real_config_validates_and_has_expected_boundary_contract(self):
        self.assertTrue(scope.validate_config(self.config))
        self.assertEqual(
            self.config["decisionConstraint"],
            "scope-matrix-does-not-change-admission",
        )
        self.assertEqual(self.config["targetScope"], "humanities-only")
        self.assertEqual(
            set(self.config["states"]),
            {
                "core-humanities",
                "boundary-review",
                "outside-scope",
                "unresolved-evidence",
            },
        )

        states = {
            row["id"]: row["boundaryState"]
            for row in self.config["rows"]
        }
        self.assertEqual(
            states["scope:communication-culture"],
            "boundary-review",
        )
        self.assertEqual(
            states["scope:education-research"],
            "boundary-review",
        )
        self.assertEqual(
            states["scope:gender-studies"],
            "boundary-review",
        )
        self.assertEqual(
            states["scope:social-sciences"],
            "outside-scope",
        )
        self.assertEqual(
            states["scope:political-international-development"],
            "outside-scope",
        )
        self.assertEqual(
            states["scope:urban-territory-sustainability"],
            "outside-scope",
        )

    def test_program_keys_are_unique_across_rows(self):
        keys = [
            key
            for row in self.config["rows"]
            for key in row["programKeys"]
        ]
        self.assertEqual(len(keys), len(set(keys)))

    def test_duplicate_program_key_is_rejected(self):
        config = copy.deepcopy(self.config)
        duplicate = config["rows"][0]["programKeys"][0]
        config["rows"][1]["programKeys"].append(duplicate)

        with self.assertRaisesRegex(
            ValueError,
            "Duplicate programKey across rows",
        ):
            scope.validate_config(config)

    def test_build_report_aggregates_exact_program_groups_without_admission(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en comunicacion",
                    "count": 2,
                    "variants": {"Maestría en Comunicación": 2},
                    "providers": {"riudg": 2},
                },
                {
                    "normalizedKey": "doctorado en educacion",
                    "count": 3,
                    "variants": {"DOCTORADO EN EDUCACION": 3},
                    "providers": {"riudg": 3},
                },
                {
                    "normalizedKey": "maestria en ciencias sociales",
                    "count": 4,
                    "variants": {"Maestría en Ciencias Sociales": 4},
                    "providers": {"riudg": 4},
                },
                {
                    "normalizedKey": "maestria en ciencia politica",
                    "count": 5,
                    "variants": {"Maestría en Ciencia Política": 5},
                    "providers": {"riudg": 5},
                },
                {
                    "normalizedKey": "doctorado en ciudad territorio y sustentabilidad",
                    "count": 6,
                    "variants": {
                        "DOCTORADO EN CIUDAD, TERRITORIO Y SUSTENTABILIDAD": 6
                    },
                    "providers": {"riudg": 6},
                },
            ]
        }

        works = []
        for index, (program, count, unit) in enumerate(
            [
                ("Maestría en Comunicación", 2, "CUCSH"),
                ("Doctorado en Educación", 3, "CUCSH"),
                ("Maestría en Ciencias Sociales", 4, "CUCSH"),
                ("Maestría en Ciencia Política", 5, "CUCSH"),
                (
                    "Doctorado en Ciudad, Territorio y Sustentabilidad",
                    6,
                    "CUAAD",
                ),
            ]
        ):
            for offset in range(count):
                works.append(
                    {
                        "id": f"work:{index}:{offset}",
                        "programRaw": program,
                        "academicUnitRaw": unit,
                        "date": {
                            "value": str(2010 + index),
                            "quality": "valid",
                        },
                        "admissionStatus": "quarantine",
                        "institutionRef": "institution:udg",
                    }
                )

        corpus = {"works": works}
        report = scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        self.assertEqual(report["metrics"]["observedProgramGroups"], 5)
        self.assertEqual(report["metrics"]["observedWorks"], 20)
        self.assertEqual(
            report["metrics"]["worksByBoundaryState"],
            {
                "boundary-review": 5,
                "outside-scope": 15,
            },
        )

        rows = {row["id"]: row for row in report["rows"]}
        self.assertEqual(
            rows["scope:communication-culture"]["observedWorks"],
            2,
        )
        self.assertEqual(
            rows["scope:education-research"]["observedWorks"],
            3,
        )
        self.assertEqual(
            rows["scope:social-sciences"]["observedWorks"],
            4,
        )
        self.assertEqual(
            rows["scope:political-international-development"][
                "observedWorks"
            ],
            5,
        )
        self.assertEqual(
            rows["scope:urban-territory-sustainability"][
                "observedWorks"
            ],
            6,
        )

        communication_program = rows[
            "scope:communication-culture"
        ]["programs"][0]
        self.assertEqual(
            communication_program["programAuthority"]["status"],
            "confirmed",
        )
        self.assertEqual(
            communication_program["programAuthority"]["programRef"],
            "program:udg:mae-comunicacion",
        )
        self.assertEqual(
            communication_program["programAuthority"]["admissionState"],
            "review",
        )
        self.assertEqual(
            communication_program["currentAdmissionStatuses"],
            {"quarantine": 2},
        )

    def test_communication_boundary_row_matches_program_authority_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en comunicacion",
                    "count": 67,
                    "variants": {
                        "Maestría en Comunicación": 52,
                        "MAESTRIA EN COMUNICACION": 15,
                    },
                    "providers": {"riudg": 67},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "id": "work:communication",
                    "programRaw": "Maestría en Comunicación",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2018", "quality": "valid"},
                    "admissionStatus": "review",
                    "institutionRef": "institution:udg",
                }
            ]
        }

        report = scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        row = next(
            item
            for item in report["rows"]
            if item["id"] == "scope:communication-culture"
        )
        self.assertEqual(row["boundaryState"], "boundary-review")
        program = next(
            item
            for item in row["programs"]
            if item["normalizedKey"] == "maestria en comunicacion"
        )
        self.assertEqual(
            program["programAuthority"]["status"],
            "confirmed",
        )
        self.assertEqual(
            program["programAuthority"]["programRef"],
            "program:udg:mae-comunicacion",
        )
        self.assertEqual(
            program["programAuthority"]["admissionState"],
            "review",
        )
        self.assertEqual(
            program["currentAdmissionStatuses"],
            {"review": 1},
        )

    def test_doctorado_educacion_boundary_row_matches_program_authority_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en educacion",
                    "count": 73,
                    "variants": {
                        "Doctorado en Educación": 73,
                    },
                    "providers": {"riudg": 73},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "id": "work:doctorado-educacion",
                    "programRaw": "Doctorado en Educación",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2020", "quality": "valid"},
                    "admissionStatus": "review",
                    "institutionRef": "institution:udg",
                }
            ]
        }

        report = scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        row = next(
            item
            for item in report["rows"]
            if item["id"] == "scope:education-research"
        )
        self.assertEqual(row["boundaryState"], "boundary-review")
        program = row["programs"][0]
        self.assertEqual(
            program["programAuthority"]["status"],
            "confirmed",
        )
        self.assertEqual(
            program["programAuthority"]["programRef"],
            "program:udg:doc-educacion",
        )
        self.assertEqual(
            program["programAuthority"]["admissionState"],
            "review",
        )
        self.assertEqual(
            program["currentAdmissionStatuses"],
            {"review": 1},
        )

    def test_maestria_investigacion_educativa_boundary_row_matches_program_authority_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en investigacion educativa",
                    "count": 34,
                    "variants": {
                        "Maestría en Investigación Educativa": 34,
                    },
                    "providers": {"riudg": 34},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "id": "work:maestria-investigacion-educativa",
                    "programRaw": "Maestría en Investigación Educativa",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2021", "quality": "valid"},
                    "admissionStatus": "review",
                    "institutionRef": "institution:udg",
                }
            ]
        }

        report = scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        row = next(
            item
            for item in report["rows"]
            if item["id"] == "scope:education-research"
        )
        self.assertEqual(row["boundaryState"], "boundary-review")
        program = next(
            item
            for item in row["programs"]
            if item["normalizedKey"]
            == "maestria en investigacion educativa"
        )
        self.assertEqual(
            program["programAuthority"]["status"],
            "confirmed",
        )
        self.assertEqual(
            program["programAuthority"]["programRef"],
            "program:udg:mae-investigacion-educativa",
        )
        self.assertEqual(
            program["programAuthority"]["admissionState"],
            "review",
        )
        self.assertEqual(
            program["currentAdmissionStatuses"],
            {"review": 1},
        )

    def test_doctorado_cognicion_aprendizaje_boundary_row_matches_program_authority_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en cognicion y aprendizaje",
                    "count": 4,
                    "variants": {
                        "Doctorado en Cognición y Aprendizaje": 4,
                    },
                    "providers": {"riudg": 4},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "id": "work:doctorado-cognicion-aprendizaje",
                    "programRaw": "Doctorado en Cognición y Aprendizaje",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2022", "quality": "valid"},
                    "admissionStatus": "review",
                    "institutionRef": "institution:udg",
                }
            ]
        }

        report = scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        row = next(
            item
            for item in report["rows"]
            if item["id"] == "scope:education-research"
        )
        self.assertEqual(row["boundaryState"], "boundary-review")
        program = next(
            item
            for item in row["programs"]
            if item["normalizedKey"]
            == "doctorado en cognicion y aprendizaje"
        )
        self.assertEqual(
            program["programAuthority"]["status"],
            "confirmed",
        )
        self.assertEqual(
            program["programAuthority"]["programRef"],
            "program:udg:doc-cognicion-aprendizaje",
        )
        self.assertEqual(
            program["programAuthority"]["admissionState"],
            "review",
        )
        self.assertEqual(
            program["currentAdmissionStatuses"],
            {"review": 1},
        )

    def test_maestria_estudios_genero_boundary_row_matches_program_authority_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en estudios de genero",
                    "count": 1,
                    "variants": {
                        "Maestría en Estudios de Género": 1,
                    },
                    "providers": {"riudg": 1},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "id": "work:maestria-estudios-genero",
                    "programRaw": "Maestría en Estudios de Género",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2026", "quality": "valid"},
                    "admissionStatus": "review",
                    "institutionRef": "institution:udg",
                }
            ]
        }

        report = scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        row = next(
            item
            for item in report["rows"]
            if item["id"] == "scope:gender-studies"
        )
        self.assertEqual(row["boundaryState"], "boundary-review")
        program = next(
            item
            for item in row["programs"]
            if item["normalizedKey"]
            == "maestria en estudios de genero"
        )
        self.assertEqual(
            program["programAuthority"]["status"],
            "confirmed",
        )
        self.assertEqual(
            program["programAuthority"]["programRef"],
            "program:udg:mae-estudios-genero",
        )
        self.assertEqual(
            program["programAuthority"]["admissionState"],
            "review",
        )
        self.assertEqual(
            program["currentAdmissionStatuses"],
            {"review": 1},
        )

    def test_matrix_does_not_mutate_input_corpus_or_registry(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en comunicacion",
                    "count": 1,
                    "variants": {"Maestría en Comunicación": 1},
                    "providers": {"riudg": 1},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "id": "work:communication",
                    "programRaw": "Maestría en Comunicación",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2020", "quality": "valid"},
                    "admissionStatus": "quarantine",
                    "institutionRef": "institution:udg",
                }
            ]
        }

        original_corpus = copy.deepcopy(corpus)
        original_registry = copy.deepcopy(self.registry)

        scope.build_report(
            observed,
            corpus,
            self.registry,
            self.config,
        )

        self.assertEqual(corpus, original_corpus)
        self.assertEqual(self.registry, original_registry)

    def test_policy_revisions_are_reported_separately(self):
        report = scope.build_report(
            {"programs": []},
            {"works": []},
            self.registry,
            self.config,
        )

        self.assertEqual(
            report["policyRevision"],
            "2026-11-01.v1",
        )
        self.assertEqual(
            report["programAuthorityRevision"],
            self.registry["registryRevision"],
        )
        self.assertEqual(
            report["institutionAuthorityRevision"],
            self.registry["institutionRevision"],
        )


if __name__ == "__main__":
    unittest.main()
