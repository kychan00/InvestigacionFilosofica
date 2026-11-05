"""T2CW: graduate evidence tiers remain separate from thesis identity and holdings."""
from __future__ import annotations
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/validate_mef_graduate_evidence_t2cw.py"
LEDGER=ROOT/"scripts/thesis/config/mef-graduate-evidence-ledger-t2cw.json"
spec=importlib.util.spec_from_file_location("t2cw",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)

class T2CWTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads(LEDGER.read_text(encoding="utf-8"))

    def test_real_ledger_metrics(self):
        m=mod.validate(self.data)
        self.assertEqual(m["records"],9)
        self.assertEqual(m["exactThesisTitlesRecovered"],1)
        self.assertEqual(m["thesisTopicsWithoutExactTitle"],1)
        self.assertEqual(m["graduateOnlyWithoutThesisIdentity"],7)
        self.assertEqual(m["publicRecordsAdded"],0)
        self.assertEqual(m["physicalHoldingsAdded"],0)

    def test_degree_count_cannot_become_thesis_identity_count(self):
        bad=json.loads(json.dumps(self.data))
        bad["coverage"]["knownGraduateIdentities"]=45
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_graduate_only_cannot_gain_unverified_title(self):
        bad=json.loads(json.dumps(self.data))
        row=next(r for r in bad["records"] if r["evidenceLevel"]=="graduate-confirmed")
        row["thesis"]["title"]="Título supuesto"
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_topic_only_cannot_be_relabelled_as_exact_title(self):
        bad=json.loads(json.dumps(self.data))
        row=next(r for r in bad["records"] if r["evidenceLevel"]=="thesis-topic-confirmed")
        row["thesis"]["title"]="Argumentos trascendentales y lógicas modales"
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_local_or_download_evidence_is_rejected(self):
        for url in ["file:///tmp/x","sandbox:/mnt/data/x","https://example.org/bitstream/x","https://example.org/download/x"]:
            bad=json.loads(json.dumps(self.data))
            bad["records"][0]["evidence"][0]["url"]=url
            with self.subTest(url=url), self.assertRaises(ValueError):
                mod.validate(bad)

if __name__=="__main__":
    unittest.main()
