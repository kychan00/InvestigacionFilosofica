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
                / "boundary-closure-contract-v1.json"
            ).read_text(encoding="utf-8")
        )

    def empty_scope_report(self, registry=None, config=None):
        return scope.build_report(
            {"programs": []},
            {"works": []},
            registry or self.registry,
            config or self.scope_config,
        )

    def test_real_boundary_contract_is_closed_at_179(self):
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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 179)
        self.assertEqual(audit["metrics"]["admissionStates"], {"review": 5})
        self.assertEqual(audit["metrics"]["violations"], 0)
        self.assertEqual(audit["violations"], [])
        self.assertEqual(
            set(audit["metrics"]["sampleUnobservedProgramKeys"]),
            {
                "maestria en comunicacion",
                "doctorado en educacion",
                "maestria en investigacion educativa",
                "doctorado en cognicion y aprendizaje",
                "maestria en estudios de genero",
            },
        )

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
        communication = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:mae-comunicacion"
        )
        communication["observedCount"] += 1

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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 180)
        self.assertIn(
            "boundary-observed-works-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_authority_state_drift_reopens_curation(self):
        registry = copy.deepcopy(self.registry)
        communication = next(
            item
            for item in registry["programs"]
            if item["id"] == "program:udg:mae-comunicacion"
        )
        communication["admissionState"] = "include"

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
            if row["id"] == "scope:communication-culture"
            for item in row["programs"]
            if item["normalizedKey"] == "maestria en comunicacion"
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
