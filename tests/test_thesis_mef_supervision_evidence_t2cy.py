"""T2CY: completed MEF supervision records stay separate from institutional work identity."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/validate_mef_supervision_evidence_t2cy.py"
LEDGER = ROOT / "scripts/thesis/config/mef-supervision-evidence-t2cy.json"
T2CX = ROOT / "scripts/thesis/config/mef-thesis-title-recovery-t2cx.json"
spec = importlib.util.spec_from_file_location("t2cy", SCRIPT)
mod = importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class T2CYTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(LEDGER.read_text(encoding="utf-8"))
        self.t2cx = json.loads(T2CX.read_text(encoding="utf-8"))

    def test_real_ledger_metrics(self):
        m = mod.validate(self.data, self.t2cx)
        self.assertEqual(m["completedMefEntriesInSource"], 11)
        self.assertEqual(m["overlapWithT2CX"], 1)
        self.assertEqual(m["newNominalCandidates"], 10)
        self.assertEqual(m["exactTitleCandidates"], 11)
        self.assertEqual(m["authorVariantReview"], 1)
        self.assertEqual(m["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertEqual(m["physicalHoldingsConfirmed"], 0)
        self.assertEqual(m["publicRecordsAdded"], 0)

    def test_joaquin_is_the_only_t2cx_overlap(self):
        overlaps = [r for r in self.data["records"] if r["overlapsT2CX"]]
        self.assertEqual(len(overlaps), 1)
        self.assertEqual(overlaps[0]["sourceAuthor"], "Joaquín Galindo Castañeda")
        self.assertEqual(overlaps[0]["exactTitleCandidate"], "Argumentos transcendentales y lógica modal")

    def test_romulo_variant_is_not_silently_canonicalized(self):
        row = next(r for r in self.data["records"] if r["sourceAuthor"] == "Rómulo Daza y García")
        self.assertEqual(row["authorIdentityStatus"], "variant-review")
        self.assertIsNone(row["canonicalName"])
        self.assertEqual(row["canonicalCandidate"], "Rómulo Ramírez Daza y García")
        self.assertEqual(row["decision"], "author-variant-review")

    def test_suspended_mef_thesis_is_not_in_completed_ledger(self):
        names = {r["sourceAuthor"] for r in self.data["records"]}
        self.assertNotIn("Miguel Ángel Carrillo", names)

    def test_supervision_entry_cannot_be_promoted_to_institutional_identity(self):
        bad = json.loads(json.dumps(self.data))
        bad["records"][0]["institutionalWorkIdentityConfirmed"] = True
        with self.assertRaises(ValueError):
            mod.validate(bad, self.t2cx)

    def test_supervision_entry_cannot_claim_physical_holding(self):
        bad = json.loads(json.dumps(self.data))
        bad["records"][1]["physicalHoldingConfirmed"] = True
        with self.assertRaises(ValueError):
            mod.validate(bad, self.t2cx)

    def test_existing_t2cx_identity_must_be_marked_overlap(self):
        bad = json.loads(json.dumps(self.data))
        row = next(r for r in bad["records"] if r["sourceAuthor"] == "Joaquín Galindo Castañeda")
        row["overlapsT2CX"] = False
        row["decision"] = "exact-title-candidate"
        with self.assertRaises(ValueError):
            mod.validate(bad, self.t2cx)

    def test_local_or_download_corroboration_is_rejected(self):
        for url in [
            "file:///tmp/x",
            "sandbox:/mnt/data/x",
            "https://example.org/bitstream/x",
            "https://example.org/download/x",
        ]:
            bad = json.loads(json.dumps(self.data))
            row = next(r for r in bad["records"] if r["corroboration"])
            row["corroboration"][0]["url"] = url
            with self.subTest(url=url), self.assertRaises(ValueError):
                mod.validate(bad, self.t2cx)


if __name__ == "__main__":
    unittest.main()
