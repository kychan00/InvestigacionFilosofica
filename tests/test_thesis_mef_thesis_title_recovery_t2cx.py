"""T2CX: exact-title recovery stays separate from institutional identity and holdings."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/thesis/validate_mef_thesis_title_recovery_t2cx.py"
LEDGER = ROOT / "scripts/thesis/config/mef-thesis-title-recovery-t2cx.json"
spec = importlib.util.spec_from_file_location("t2cx", SCRIPT)
mod = importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class T2CXTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(LEDGER.read_text(encoding="utf-8"))

    def test_real_ledger_metrics(self):
        m = mod.validate(self.data)
        self.assertEqual(m["records"], 9)
        self.assertEqual(m["exactThesisTitlesRecovered"], 2)
        self.assertEqual(m["thesisTopicsWithoutExactTitle"], 0)
        self.assertEqual(m["graduateOnlyWithoutExactTitle"], 7)
        self.assertEqual(m["institutionalWorkIdentitiesConfirmed"], 0)
        self.assertEqual(m["physicalHoldingsConfirmed"], 0)
        self.assertEqual(m["publicRecordsAdded"], 0)

    def test_joaquin_exact_title_is_not_the_topic_phrase(self):
        row = next(r for r in self.data["records"] if r["name"] == "Joaquín Galindo Castañeda")
        self.assertEqual(row["exactThesisTitle"], "Argumentos transcendentales y lógica modal")
        self.assertEqual(row["graduationYear"], 2013)
        self.assertFalse(row["institutionalWorkIdentityConfirmed"])
        self.assertEqual(row["decision"], "exact-title-pending-institutional")

    def test_exact_title_does_not_confirm_institutional_identity(self):
        bad = json.loads(json.dumps(self.data))
        row = next(r for r in bad["records"] if r["name"] == "Joaquín Galindo Castañeda")
        row["institutionalWorkIdentityConfirmed"] = True
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_exact_title_does_not_confirm_physical_holding(self):
        bad = json.loads(json.dumps(self.data))
        row = next(r for r in bad["records"] if r["name"] == "Ángel Adrián González Delgado")
        row["physicalHoldingConfirmed"] = True
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_graduate_only_cannot_gain_title_from_publication_candidate(self):
        bad = json.loads(json.dumps(self.data))
        row = next(r for r in bad["records"] if r["name"] == "Dinora Hernández López")
        row["exactThesisTitle"] = "Elementos de filosofía moral negativa: violencia, vulnerabilidad y diferencia"
        row["decision"] = "exact-title-pending-institutional"
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_unconfirmed_identity_cannot_persist_identifier(self):
        bad = json.loads(json.dumps(self.data))
        bad["records"][0]["alephSystemNumber"] = "000000001"
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_degree_count_cannot_become_identity_count(self):
        bad = json.loads(json.dumps(self.data))
        bad["coverage"]["knownGraduateIdentities"] = 45
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_local_or_download_evidence_is_rejected(self):
        for url in [
            "file:///tmp/x",
            "sandbox:/mnt/data/x",
            "https://example.org/bitstream/x",
            "https://example.org/download/x",
        ]:
            bad = json.loads(json.dumps(self.data))
            bad["records"][0]["exactTitleEvidence"][0]["url"] = url
            with self.subTest(url=url), self.assertRaises(ValueError):
                mod.validate(bad)


if __name__ == "__main__":
    unittest.main()
