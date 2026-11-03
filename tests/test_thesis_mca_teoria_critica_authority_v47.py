"""T2BU / V47: historical MCA Teoría y Crítica is a granular Humanities authority."""
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"thesis"))
import build_canonical_corpus_v1 as canonical

class McaTeoriaCriticaAuthorityV47Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=canonical.load_program_registry()
        cls.baseline=json.loads(
            (ROOT/"scripts/thesis/config/mca-teoria-critica-authority-v47-baseline-v1.json")
            .read_text(encoding="utf-8")
        )
        cls.target=next(p for p in cls.registry["programs"] if p["id"]==cls.baseline["programRef"])

    def test_exact_historical_orientation_is_include(self):
        self.assertEqual(self.registry["registryRevision"],"2026-11-03.v47")
        self.assertEqual(self.target["admissionState"],"include")
        self.assertEqual(self.target["lifecycleState"],"historical")
        self.assertEqual(self.target["disciplineFamily"],"historia-teoria-critica-arquitectura-humanidades")
        self.assertEqual(self.target["observedCount"],1)
        self.assertEqual(self.target["observedThesisYears"],{"min":2001,"max":2001})
        self.assertEqual(len(self.target["aliases"]),1)
        for raw in (self.target["canonicalName"],*self.target["aliases"]):
            r=canonical.resolve_program(raw,self.registry)
            self.assertEqual(r["programRef"],self.target["id"])
            self.assertEqual(r["admissionState"],"include")

    def test_neighboring_mca_authorities_remain_independent(self):
        by={p["id"]:p for p in self.registry["programs"]}
        for spec in self.baseline["expected"]["neighbors"].values():
            self.assertEqual(by[spec["ref"]]["admissionState"],spec["state"])
            self.assertEqual(by[spec["ref"]]["observedCount"],spec["works"])

    def test_policies_and_work_review_preserved(self):
        scope=json.loads((ROOT/"scripts/thesis/config/scope-boundary-matrix-v1.json").read_text())
        conf=json.loads((ROOT/"scripts/thesis/config/program-metadata-evidence-confidence-v1.json").read_text())
        work=json.loads((ROOT/"scripts/thesis/config/boundary-work-review-policy-v1.json").read_text())
        self.assertEqual(scope["policyRevision"],"2026-11-02.v5")
        self.assertEqual(scope["targetScope"],"humanities-only")
        self.assertEqual(conf["policyRevision"],"2026-11-02.v5")
        self.assertEqual(work["policyRevision"],"2026-11-03.boundary-v3")
        self.assertEqual(len(work["programs"]),3)

if __name__=="__main__":
    unittest.main()
