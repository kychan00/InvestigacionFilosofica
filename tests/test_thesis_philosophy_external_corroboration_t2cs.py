"""T2CS validation: external corroboration never becomes physical identity."""
from __future__ import annotations
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/validate_philosophy_external_corroboration_v1.py"
CONFIG=ROOT/"scripts/thesis/config/philosophy-external-corroboration-v1.json"
spec=importlib.util.spec_from_file_location("t2cs",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)

class T2CSTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads(CONFIG.read_text(encoding="utf-8"))

    def test_real_ledger_is_reference_only(self):
        metrics=mod.validate(self.data)
        self.assertEqual(metrics["records"],4)
        self.assertEqual(metrics["physicalLocationsConfirmed"],0)
        self.assertEqual(metrics["automaticIdentityMerges"],0)
        self.assertEqual(metrics["evidenceReferences"],6)

    def test_external_evidence_cannot_confirm_physical_location(self):
        bad=json.loads(json.dumps(self.data))
        bad["records"][0]["claims"]["physicalLocation"]="corroborated"
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_lineage_cannot_be_upgraded_to_exact_identity(self):
        bad=json.loads(json.dumps(self.data))
        row=next(r for r in bad["records"] if "lineage" in r["corroborationStatus"])
        row["claims"]["workExistence"]="corroborated"
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_duplicate_source_identity_rejected(self):
        bad=json.loads(json.dumps(self.data))
        bad["records"].append(json.loads(json.dumps(bad["records"][0])))
        with self.assertRaises(ValueError):
            mod.validate(bad)

    def test_download_and_local_paths_rejected(self):
        for url in ["file:///tmp/evidence.pdf","sandbox:/mnt/data/x","https://example.org/bitstream/123"]:
            bad=json.loads(json.dumps(self.data))
            bad["records"][0]["evidence"][0]["url"]=url
            with self.subTest(url=url), self.assertRaises(ValueError):
                mod.validate(bad)

    def test_all_supports_are_nonphysical_claims(self):
        for row in self.data["records"]:
            for evidence in row["evidence"]:
                self.assertNotIn("physicalLocation",evidence["supports"])

if __name__=="__main__":
    unittest.main()
