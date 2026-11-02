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


class ThesisPoliticalInternationalClosureAuditTest(unittest.TestCase):
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
                / "outside-scope-political-international-development-closure-v1.json"
            ).read_text(encoding="utf-8")
        )

    def empty_scope_report(self, registry=None, config=None):
        return scope.build_report(
            {"programs": []},
            {"works": []},
            registry or self.registry,
            config or self.scope_config,
        )

    def test_contract_is_closed_at_212(self):
        report = self.empty_scope_report()
        audit = closure.build_audit(
            report,
            self.registry,
            self.scope_config,
            self.contract,
        )

        self.assertEqual(
            audit["closureId"],
            "political-international-development-v1",
        )
        self.assertEqual(audit["closureState"], "closed")
        self.assertEqual(audit["metrics"]["contractRows"], 1)
        self.assertEqual(audit["metrics"]["contractProgramKeys"], 4)
        self.assertEqual(audit["metrics"]["confirmedAuthorities"], 4)
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 212)
        self.assertEqual(audit["metrics"]["admissionStates"], {"exclude": 4})
        self.assertEqual(audit["metrics"]["violations"], 0)

    def test_urban_review_authority_does_not_reopen_political_closure(self):
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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 212)

    def test_maestria_derecho_does_not_reopen_political_closure(self):
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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 212)
        self.assertEqual(audit["metrics"]["admissionStates"], {"exclude": 4})

    def test_sample_absence_is_informative_not_failure(self):
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
                "maestria en ciencia politica",
                "maestria en gestion y desarrollo social",
                "licenciatura en relaciones internacionales",
                "maestria en global politics and transpacific studies",
            },
        )
        self.assertEqual(audit["closureState"], "closed")

    def test_new_program_key_reopens_political_closure(self):
        config = copy.deepcopy(self.scope_config)
        row = next(
            item
            for item in config["rows"]
            if item["id"] == "scope:political-international-development"
        )
        row["programKeys"].append("doctorado en politica internacional")

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
        self.assertEqual(audit["metrics"]["contractProgramKeys"], 5)
        self.assertIn(
            "row-program-keys-mismatch",
            {item["code"] for item in audit["violations"]},
        )

    def test_missing_authority_reopens_political_closure(self):
        registry = copy.deepcopy(self.registry)
        registry["programs"] = [
            item
            for item in registry["programs"]
            if item["id"] != "program:udg:mae-global-politics-transpacific"
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

    def test_program_ref_drift_reopens_political_closure(self):
        registry = copy.deepcopy(self.registry)
        item = next(
            entry
            for entry in registry["programs"]
            if entry["id"] == "program:udg:lic-relaciones-internacionales"
        )
        item["id"] = "program:udg:lic-relaciones-internacionales-v2"

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

    def test_curated_count_drift_reopens_political_closure(self):
        registry = copy.deepcopy(self.registry)
        item = next(
            entry
            for entry in registry["programs"]
            if entry["id"] == "program:udg:mae-ciencia-politica"
        )
        item["observedCount"] += 1

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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 213)
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("program-observed-count-mismatch", codes)
        self.assertIn("closure-observed-works-mismatch", codes)

    def test_admission_state_drift_reopens_political_closure(self):
        registry = copy.deepcopy(self.registry)
        item = next(
            entry
            for entry in registry["programs"]
            if entry["id"] == "program:udg:mae-global-politics-transpacific"
        )
        item["admissionState"] = "review"

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
            {"exclude": 3, "review": 1},
        )
        codes = {item["code"] for item in audit["violations"]}
        self.assertIn("program-admission-state-mismatch", codes)
        self.assertIn("closure-admission-states-mismatch", codes)

    def test_social_sciences_drift_does_not_affect_political_closure(self):
        config = copy.deepcopy(self.scope_config)
        row = next(
            item
            for item in config["rows"]
            if item["id"] == "scope:social-sciences"
        )
        row["programKeys"].append("programa social pendiente adicional")

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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 212)

    def test_urban_territory_drift_does_not_affect_political_closure(self):
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
        self.assertEqual(audit["metrics"]["authorityObservedWorks"], 212)

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
