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

MODULE_PATH = THESIS_DIR / "audit_boundary_closure_v1.py"
spec = importlib.util.spec_from_file_location("boundary_closure", MODULE_PATH)
closure = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(closure)

canonical = closure.canonical
scope = closure.scope_boundary


class ThesisBoundaryClosureAuditTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )
        cls.scope_config = json.loads(
            (
                THESIS_DIR
                / "config"
                / "scope-boundary-matrix-v1.json"
            ).read_text(encoding="utf-8")
        )
        cls.contract = json.loads(
            (
                THESIS_DIR
                / "config"
                / "boundary-closure-contract-v3.json"
            ).read_text(encoding="utf-8")
        )

    def empty_scope_report(self, registry=None, config=None):
        return scope.build_report(
            {"programs": []},
            {"works": []},
            registry or self.registry,
            config or self.scope_config,
        )

    def test_real_boundary_contract_v3_is_closed_at_264(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["boundaryRows"], 3)
        self.assertEqual(audit["metrics"]["boundaryProgramKeys"], 5)
        self.assertEqual(audit["metrics"]["confirmedAuthorities"], 5)
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})
        self.assertEqual(audit["metrics"]["violations"], 0)
        self.assertEqual(audit["violations"], [])
        self.assertEqual(
            set(audit["metrics"]["sampleUnobservedProgramKeys"]),
            {
                "doctorado en educacion",
                "maestria en investigacion educativa",
                "doctorado en cognicion y aprendizaje",
                "maestria en estudios de genero",
                "doctorado en ciudad territorio y sustentabilidad",
            },
        )

    def test_outside_scope_exclude_authority_does_not_reopen_review_boundary(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        excluded = canonical.resolve_program(
            "Doctorado en Ciencias Sociales",
            self.registry,
        )
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_social_sciences_outside_scope_closure_does_not_reopen_review_boundary(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        for raw in (
            "Doctorado en Ciencias Sociales",
            "Maestría en Ciencias Sociales",
        ):
            with self.subTest(raw=raw):
                excluded = canonical.resolve_program(raw, self.registry)
                self.assertEqual(excluded["status"], "confirmed")
                self.assertEqual(excluded["admissionState"], "exclude")

        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})
        self.assertEqual(audit["metrics"]["violations"], 0)

    def test_gestion_desarrollo_social_exclude_does_not_reopen_review_boundary(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program(
            "Maestría en Gestión y Desarrollo Social",
            self.registry,
        )
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_ciencia_politica_exclude_does_not_reopen_review_boundary(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program(
            "Maestría en Ciencia Política",
            self.registry,
        )
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_relaciones_internacionales_exclude_does_not_reopen_review_boundary(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program(
            "Licenciatura en Relaciones Internacionales",
            self.registry,
        )
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)

    def test_global_politics_exclude_does_not_reopen_review_boundary(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program(
            "Maestría en Global Politics and Transpacific Studies",
            self.registry,
        )
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)

    def test_urban_review_authority_is_part_of_boundary_contract_v3(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        reviewed = canonical.resolve_program(
            "Doctorado en Ciudad, Territorio y Sustentabilidad",
            self.registry,
        )
        self.assertEqual(reviewed["status"], "confirmed")
        self.assertEqual(reviewed["admissionState"], "review")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})
        urban = next(
            item
            for item in audit["programs"]
            if item["normalizedKey"] == "doctorado en ciudad territorio y sustentabilidad"
        )
        self.assertEqual(
            urban["programRef"],
            "program:udg:doc-ciudad-territorio-sustentabilidad",
        )
        self.assertEqual(urban["authorityObservedCount"], 152)

    def test_historical_v1_contract_is_open_under_scope_policy_v3(self):
        report = self.empty_scope_report()
        historical = json.loads(
            (
                THESIS_DIR
                / "config"
                / "boundary-closure-contract-v1.json"
            ).read_text(encoding="utf-8")
        )

        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            historical,
        )

        self.assertEqual(audit["closureState"], "open")
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("policy-revision-mismatch", codes)
        self.assertIn("boundary-row-count-mismatch", codes)
        self.assertIn("boundary-program-key-count-mismatch", codes)
        self.assertIn("boundary-observed-works-mismatch", codes)
        self.assertIn("boundary-admission-state-mismatch", codes)

    def test_moving_urban_row_back_outside_scope_reopens_v3(self):
        config = copy.deepcopy(self.scope_config)
        row = next(
            item
            for item in config["rows"]
            if item["id"] == "scope:urban-territory-sustainability"
        )
        row["boundaryState"] = "outside-scope"

        report = scope.build_report(
            {"programs": []},
            {"works": []},
            self.registry,
            config,
        )
        audit = closure.build_audit(
            report,
            self.registry,
            config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "open")
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("boundary-row-count-mismatch", codes)
        self.assertIn("boundary-program-key-count-mismatch", codes)
        self.assertIn("boundary-observed-works-mismatch", codes)
        self.assertIn("boundary-admission-state-mismatch", codes)

    def test_maestria_derecho_exclude_does_not_reopen_boundary_v3(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program("Maestría en Derecho", self.registry)
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_licenciatura_derecho_exclude_does_not_reopen_boundary_v3(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program("Licenciatura en Derecho", self.registry)
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_doctorado_derechos_humanos_review_does_not_reopen_boundary_v3(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        reviewed = canonical.resolve_program(
            "Doctorado en Derechos Humanos",
            self.registry,
        )
        self.assertEqual(reviewed["status"], "confirmed")
        self.assertEqual(reviewed["admissionState"], "review")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_doctorado_derecho_exclude_does_not_reopen_boundary_v3(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        excluded = canonical.resolve_program("Doctorado en Derecho", self.registry)
        self.assertEqual(excluded["status"], "confirmed")
        self.assertEqual(excluded["admissionState"], "exclude")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_tecnologias_aprendizaje_review_does_not_reopen_boundary_v3(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )
        reviewed = canonical.resolve_program(
            "Maestría en Tecnologías para el Aprendizaje",
            self.registry,
        )
        self.assertEqual(reviewed["status"], "confirmed")
        self.assertEqual(reviewed["admissionState"], "review")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 264)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})

    def test_sample_absence_is_informative_not_a_closure_failure(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["metrics"]["sampleObservedWorks"], 0)
        self.assertEqual(audit["closureState"], "closed")

    def test_new_boundary_program_key_reopens_curation(self):
        config = copy.deepcopy(self.scope_config)
        target = next(
            row
            for row in config["rows"]
            if row["id"] == "scope:gender-studies"
        )
        target["programKeys"].append("maestria en frontera nueva")

        report = scope.build_report(
            {"programs": []},
            {"works": []},
            self.registry,
            config,
        )
        audit = closure.build_audit(
            report,
            self.registry,
            config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "open")
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("boundary-program-key-count-mismatch", codes)
        self.assertIn("unresolved-program-authority", codes)

    def test_missing_confirmed_authority_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        registry["programs"] = [
            item
            for item in registry["programs"]
            if item["id"] != "program:udg:mae-estudios-genero"
        ]

        report = scope.build_report(
            {"programs": []},
            {"works": []},
            registry,
            self.scope_config,
        )
        audit = closure.build_audit(
            report,
            registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "open")
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("unresolved-program-authority", codes)
        self.assertIn("boundary-admission-state-mismatch", codes)
        self.assertIn("boundary-observed-works-mismatch", codes)

    def test_curated_work_count_drift_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        education = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:doc-educacion"
        )
        education["observedCount"] += 1

        report = scope.build_report(
            {"programs": []},
            {"works": []},
            registry,
            self.scope_config,
        )
        audit = closure.build_audit(
            report,
            registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "open")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 332)
        self.assertIn(
            "boundary-observed-works-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_authority_state_drift_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        education = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:doc-educacion"
        )
        education["admissionState"] = "include"

        report = scope.build_report(
            {"programs": []},
            {"works": []},
            registry,
            self.scope_config,
        )
        audit = closure.build_audit(
            report,
            registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "open")
        self.assertEqual(
            audit["metrics"]["admissionStates"],
            {"include": 1, "review": 4},
        )
        self.assertIn(
            "boundary-admission-state-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_scope_report_authority_drift_is_detected(self):
        report = self.empty_scope_report()
        program = next(
            item
            for row in report["rows"]
            if row["id"] == "scope:education-research"
            for item in row["programs"]
            if item["normalizedKey"] == "doctorado en educacion"
        )
        program["programAuthority"]["admissionState"] = "include"

        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["closureState"], "open")
        self.assertIn(
            "scope-report-authority-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_audit_does_not_mutate_inputs(self):
        report = self.empty_scope_report()
        registry = copy.deepcopy(self.registry)
        config = copy.deepcopy(self.scope_config)
        contract = copy.deepcopy(self.contract)

        before = (
            copy.deepcopy(report),
            copy.deepcopy(registry),
            copy.deepcopy(config),
            copy.deepcopy(contract),
        )

        closure.build_audit(report, registry, config, contract)

        self.assertEqual(report, before[0])
        self.assertEqual(registry, before[1])
        self.assertEqual(config, before[2])
        self.assertEqual(contract, before[3])


if __name__ == "__main__":
    unittest.main()
