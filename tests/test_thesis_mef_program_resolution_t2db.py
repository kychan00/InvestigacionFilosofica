"""T2DB: programme confirmation must remain separate from thesis work identity."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/validate_mef_program_resolution_t2db.py"
LEDGER = ROOT / "scripts/thesis/config/mef-program-resolution-t2db.json"
T2DA = ROOT / "scripts/thesis/config/mef-post-aleph-corroboration-t2da.json"
spec = importlib.util.spec_from_file_location("t2db", SCRIPT)
mod = importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class T2DBTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(LEDGER.read_text(encoding="utf-8"))
        self.t2da = json.loads(T2DA.read_text(encoding="utf-8"))

    def validate(self, data=None):
        return mod.validate(data or self.data, self.t2da)

    def row(self, name):
        return next(r for r in self.data["priorityCases"] if r["author"] == name)

    def test_real_metrics(self):
        m = self.validate()
        self.assertEqual(m["priorityCases"], 3)
        self.assertEqual(m["mefProgramsInstitutionallyConfirmed"], 2)
        self.assertEqual(m["programsUpgradedFromNoninstitutionalToInstitutional"], 1)
        self.assertEqual(m["programsStillUnresolved"], 1)
        self.assertEqual(m["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertEqual(m["physicalHoldingsConfirmed"], 0)
        self.assertEqual(m["publicRecordsAdded"], 0)

    def test_adriel_program_is_upgraded_but_work_identity_is_not(self):
        row = self.row("Adriel Manuel Hernández Guzmán")
        self.assertTrue(row["mefProgramInstitutionallyConfirmed"])
        self.assertEqual(row["upgradedFromT2DA"], "mef-author-controlled-corroboration")
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])
        self.assertIsNone(row["thesisSpecificHandle"])

    def test_mario_remains_program_confirmed_without_work_id(self):
        row = self.row("Mario Damián Del Muro Silva")
        self.assertTrue(row["mefProgramInstitutionallyConfirmed"])
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])
        self.assertIsNone(row["thesisSpecificHandle"])
        self.assertIsNone(row["alephSystemNumber"])

    def test_jesus_program_remains_unresolved(self):
        row = self.row("Jesús Octavio Campos Ramos")
        self.assertFalse(row["mefProgramInstitutionallyConfirmed"])
        self.assertEqual(row["programStatus"], "unresolved")
        self.assertEqual(row["decision"], "master-thesis-program-still-unresolved")

    def test_adriel_title_variants_are_not_auto_merged(self):
        row = self.data["titleVariantAdjudications"][0]
        self.assertFalse(row["sameWorkConfirmed"])
        self.assertEqual(row["decision"], "preserve-both-forms-until-work-level-source")

    def test_program_confirmation_cannot_invent_handle(self):
        bad = json.loads(json.dumps(self.data))
        bad["priorityCases"][0]["thesisSpecificHandle"] = "https://hdl.handle.net/20.500.12104/999999"
        with self.assertRaises(ValueError):
            self.validate(bad)

    def test_negative_search_cannot_be_recast_as_absence(self):
        self.assertTrue(self.data["policy"]["negativeRepositorySearchDoesNotProveAbsence"])
        self.assertIn(
            "not evidence of nonexistence",
            self.data["workLevelSearchClosure"]["interpretation"],
        )


if __name__ == "__main__":
    unittest.main()
