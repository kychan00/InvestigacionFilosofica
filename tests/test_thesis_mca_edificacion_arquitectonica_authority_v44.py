"""T2BP / V44: strict historical MCA Edificación identity and scoped exclusion."""
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"thesis"))
import build_canonical_corpus_v1 as canonical

class McaEdificacionV44Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=canonical.load_program_registry()
        cls.baseline=json.loads((ROOT/"scripts/thesis/config/mca-edificacion-arquitectonica-authority-v44-baseline-v1.json").read_text(encoding="utf-8"))
        cls.target=next(p for p in cls.registry["programs"] if p["id"]==cls.baseline["programRef"])
    def test_exact_oriented_program_only(self):
        self.assertEqual(self.registry["registryRevision"],"2026-11-03.v44")
        self.assertEqual(self.target["admissionState"],"exclude")
        self.assertEqual(self.target["lifecycleState"],"historical")
        self.assertEqual(self.target["observedCount"],5)
        self.assertEqual(self.target["observedThesisYears"],{"min":1998,"max":2006})
        self.assertEqual(len(self.target["aliases"]),4)
        for raw in (self.target["canonicalName"],*self.target["aliases"]):
            with self.subTest(raw=raw):
                x=canonical.resolve_program(raw,self.registry)
                self.assertEqual(x["programRef"],self.target["id"])
                self.assertEqual(x["admissionState"],"exclude")
    def test_homonyms_not_absorbed(self):
        for raw in ("Maestría en Edificación Arquitectónica",
                    "Maestría en Construcción Arquitectónica",
                    "Maestría en Arquitectura",
                    "Maestría En Arquitectura; Orientacion Historia De La Arquitectura Mexicana"):
            self.assertNotEqual(canonical.resolve_program(raw,self.registry).get("programRef"),self.target["id"])
    def test_siblings_stay_distinct(self):
        siblings=self.baseline["expected"]["siblings"]
        for spec in siblings.values():
            p=next(p for p in self.registry["programs"] if p["id"]==spec["ref"])
            self.assertEqual(p["admissionState"],spec["state"])
            self.assertEqual(p["observedCount"],spec["works"])
        holds=json.loads((ROOT/"scripts/thesis/config/program-evidence-holds-v1.json").read_text())
        self.assertEqual(len(holds["holds"]),1)
        self.assertEqual(holds["holds"][0]["programRef"],siblings["arteComunicacion"]["ref"])
    def test_policies_preserved(self):
        scope=json.loads((ROOT/"scripts/thesis/config/scope-boundary-matrix-v1.json").read_text())
        conf=json.loads((ROOT/"scripts/thesis/config/program-metadata-evidence-confidence-v1.json").read_text())
        self.assertEqual(scope["policyRevision"],"2026-11-02.v5")
        self.assertEqual(scope["targetScope"],"humanities-only")
        self.assertEqual(conf["policyRevision"],"2026-11-02.v5")

if __name__=="__main__": unittest.main()
