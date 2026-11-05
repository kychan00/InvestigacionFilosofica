"""T2CZ: live Aleph adjudication keeps programme identity and holdings separate."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/resolve_mef_aleph_t2cz.py"
T2CY = ROOT / "scripts/thesis/config/mef-supervision-evidence-t2cy.json"
BASELINE = ROOT / "scripts/thesis/config/mef-aleph-resolution-t2cz-baseline.json"
spec = importlib.util.spec_from_file_location("t2cz", SCRIPT)
mod = importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class T2CZTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(T2CY.read_text(encoding="utf-8"))
        self.baseline = json.loads(BASELINE.read_text(encoding="utf-8"))

    def row(self, name):
        return next(r for r in self.data["records"] if r["sourceAuthor"] == name)

    def test_marcela_institutional_alias_is_allowed(self):
        forms = mod.expected_author_forms(self.row("Marcela Castillo"))
        self.assertIn(("Marcela Castillo", "canonical"), forms)
        self.assertIn(("Marcela Castillo Villegas", "institutional-corroborated-alias"), forms)

    def test_romulo_variant_is_never_auto_promoted(self):
        row = self.row("Rómulo Daza y García")
        fields = {
            "título": row["exactTitleCandidate"],
            "autor": "Rómulo Daza y García",
            "base lógica": "Tesis",
            "nota de tesis": "Tesis (Maestría en Estudios Filosóficos)--Universidad de Guadalajara",
            "número de sistema": "000000111",
        }
        out = mod.adjudicate_candidate(row, "000000111", fields, [{"sublibrary": "CUCSH"}])
        self.assertTrue(out["titleExact"])
        self.assertTrue(out["authorExact"])
        self.assertTrue(out["programEvidence"])
        self.assertFalse(out["institutionalWorkIdentityConfirmed"])
        self.assertFalse(out["physicalHoldingConfirmed"])

    def test_exact_work_without_program_stays_unresolved(self):
        row = self.row("Joaquín Galindo Castañeda")
        fields = {
            "título": row["exactTitleCandidate"],
            "autor": "Joaquín Galindo Castañeda",
            "base lógica": "Tesis",
            "nota de tesis": "Tesis presentada en la Universidad de Guadalajara",
            "número de sistema": "000000222",
        }
        out = mod.adjudicate_candidate(row, "000000222", fields, [])
        self.assertEqual(out["status"], "exact-work-program-unresolved")
        self.assertFalse(out["institutionalWorkIdentityConfirmed"])

    def test_program_confirmed_work_can_become_institutional_identity(self):
        row = self.row("Joaquín Galindo Castañeda")
        fields = {
            "título": row["exactTitleCandidate"],
            "autor": "Galindo Castañeda, Joaquín",
            "base lógica": "Tesis",
            "nota de tesis": "Tesis (Maestría en Estudios Filosóficos)--Universidad de Guadalajara",
            "número de sistema": "000000333",
        }
        out = mod.adjudicate_candidate(row, "000000333", fields, [])
        self.assertTrue(out["institutionalWorkIdentityConfirmed"])
        self.assertFalse(out["physicalHoldingConfirmed"])
        self.assertEqual(out["status"], "institutional-work-confirmed")

    def test_holdings_require_confirmed_institutional_identity(self):
        row = self.row("Joaquín Galindo Castañeda")
        fields = {
            "título": row["exactTitleCandidate"],
            "autor": "Joaquín Galindo Castañeda",
            "base lógica": "Tesis",
            "nota de tesis": "Tesis (Maestría en Estudios Filosóficos)--Universidad de Guadalajara",
            "número de sistema": "000000444",
        }
        holdings = [{"sublibrary": "B.C. CUCSH", "collection": "Tesis", "barcode": "X"}]
        out = mod.adjudicate_candidate(row, "000000444", fields, holdings)
        self.assertTrue(out["institutionalWorkIdentityConfirmed"])
        self.assertTrue(out["physicalHoldingConfirmed"])
        self.assertEqual(out["holdings"], holdings)

    def test_real_ledger_can_build_offline_unresolved_report(self):
        def resolver(row, **kwargs):
            return {
                "status": "unresolved",
                "reason": "fixture",
                "attempts": [],
                "candidateRecordsChecked": 0,
                "recordFetchErrors": 0,
                "candidates": [],
            }

        result = mod.build(
            self.data,
            opener=object(),
            action="fixture",
            resolver=resolver,
            sleep_seconds=0,
        )
        mod.validate_output(result)
        self.assertEqual(result["metrics"]["inputRecords"], 11)
        self.assertEqual(result["metrics"]["unresolved"], 11)
        self.assertEqual(result["metrics"]["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertEqual(result["metrics"]["physicalHoldingsConfirmed"], 0)
        self.assertEqual(result["metrics"]["publicRecordsAdded"], 0)

    def test_frozen_live_baseline_records_zero_confirmed_identities(self):
        mod.validate_output(self.baseline)
        self.assertEqual(self.baseline["provenance"]["workflowRunId"], 42095008520)
        self.assertEqual(self.baseline["provenance"]["artifactId"], 13445819877)
        self.assertEqual(self.baseline["metrics"]["resolved"], 0)
        self.assertEqual(self.baseline["metrics"]["unresolved"], 11)
        self.assertEqual(self.baseline["metrics"]["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertEqual(self.baseline["metrics"]["physicalHoldingsConfirmed"], 0)
        self.assertTrue(self.baseline["interpretation"]["zeroAlephHitsDoNotMeanZeroTheses"])

    def test_live_false_positive_sys_are_preserved_as_other_works(self):
        by_name = {r["sourceAuthor"]: r for r in self.baseline["results"]}
        mauricio = by_name["Mauricio Morales Díaz"]
        iker = by_name["Íker Javier Pulido Rodríguez"]
        self.assertEqual(
            [x["systemNumber"] for x in mauricio["candidates"]],
            ["000361121", "000539900"],
        )
        self.assertTrue(all(x["baseLogica"] == "Libros" for x in mauricio["candidates"]))
        self.assertEqual(iker["candidates"][0]["systemNumber"], "000594609")
        self.assertEqual(iker["candidates"][0]["baseLogica"], "Libros")
        self.assertTrue(
            all(
                not x.get("sameWorkConfirmed", False)
                for row in self.baseline["results"]
                for x in row.get("candidates", [])
            )
        )


if __name__ == "__main__":
    unittest.main()
