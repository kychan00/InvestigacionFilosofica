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

MODULE_PATH = THESIS_DIR / "audit_outside_scope_closure_v1.py"
spec = importlib.util.spec_from_file_location("outside_scope_closure", MODULE_PATH)
closure = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(closure)

canonical = closure.canonical
scope = closure.scope_boundary


class ThesisOutsideScopeClosureAuditTest(unittest.TestCase):
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
                / "outside-scope-social-sciences-closure-v1.json"
            ).read_text(encoding="utf-8")
        )

    def empty_scope_report(self, registry=None, config=None):
        return scope.build_report(
            {"programs": []},
            {"works": []},
            registry or self.registry,
            config or self.scope_config,
        )

    def test_social_sciences_contract_is_closed_at_277(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["closureId"], "social-sciences-v1")
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["contractRows"], 1)
        self.assertEqual(audit["metrics"]["contractProgramKeys"], 2)
        self.assertEqual(audit["metrics"]["confirmedAuthorities"], 2)
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 277)
        self.assertEqual(audit["metrics"]["admissionStates"], {"exclude": 2})
        self.assertEqual(audit["metrics"]["violations"], 0)
        self.assertEqual(audit["violations"], [])

    def test_unrelated_political_development_authority_does_not_reopen_social_sciences(self):
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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 277)
        self.assertEqual(audit["metrics"]["admissionStates"], {"exclude": 2})

    def test_ciencia_politica_authority_does_not_reopen_social_sciences(self):
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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 277)
        self.assertEqual(audit["metrics"]["admissionStates"], {"exclude": 2})

    def test_sample_absence_is_informative_not_a_closure_failure(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(audit["metrics"]["sampleObservedWorks"], 0)
        self.assertEqual(
            set(audit["metrics"]["sampleUnobservedProgramKeys"]),
            {
                "doctorado en ciencias sociales",
                "maestria en ciencias sociales",
            },
        )
        self.assertEqual(audit["closureState"], "closed")

    def test_new_program_key_in_social_sciences_reopens_curation(self):
        config = copy.deepcopy(self.scope_config)
        row = next(
            item
            for item in config["rows"]
            if item["id"] == "scope:social-sciences"
        )
        row["programKeys"].append("especialidad en ciencias sociales")

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
        self.assertIn(
            "row-program-keys-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_missing_authority_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        registry["programs"] = [
            item
            for item in registry["programs"]
            if item["id"] != "program:udg:mae-ciencias-sociales"
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
        self.assertIn("closure-observed-works-mismatch", codes)
        self.assertIn("closure-admission-states-mismatch", codes)

    def test_program_ref_drift_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        master = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:mae-ciencias-sociales"
        )
        master["id"] = "program:udg:mae-ciencias-sociales-v2"

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
        self.assertIn(
            "program-ref-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_curated_work_count_drift_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        doctorate = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:doc-ciencias-sociales"
        )
        doctorate["observedCount"] += 1

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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 278)
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("program-observed-count-mismatch", codes)
        self.assertIn("closure-observed-works-mismatch", codes)

    def test_authority_state_drift_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        master = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:mae-ciencias-sociales"
        )
        master["admissionState"] = "review"

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
            {"exclude": 1, "review": 1},
        )
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("program-admission-state-mismatch", codes)
        self.assertIn("closure-admission-states-mismatch", codes)

    def test_scope_report_authority_drift_is_detected(self):
        report = self.empty_scope_report()
        row = next(
            item
            for item in report["rows"]
            if item["id"] == "scope:social-sciences"
        )
        program = next(
            item
            for item in row["programs"]
            if item["normalizedKey"] == "maestria en ciencias sociales"
        )
        program["programAuthority"]["admissionState"] = "review"

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

    def test_unrelated_outside_scope_row_does_not_affect_closure(self):
        config = copy.deepcopy(self.scope_config)
        row = next(
            item
            for item in config["rows"]
            if item["id"] == "scope:urban-territory-sustainability"
        )
        row["programKeys"].append("programa urbano pendiente adicional")

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

        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 277)

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
