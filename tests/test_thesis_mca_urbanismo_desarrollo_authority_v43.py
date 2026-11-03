"""T2BO / V43: historical MCA Urbanismo y Desarrollo scope decision."""
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"thesis"))
import build_canonical_corpus_v1 as canonical

class McaUrbanismoDesarrolloV43Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=canonical.load_program_registry()
        cls.baseline=json.loads(
            (ROOT/"scripts/thesis/config/mca-urbanismo-desarrollo-authority-v43-baseline-v1.json")
            .read_text(encoding="utf-8")
        )
        cls.target=next(p for p in cls.registry["programs"]
                        if p["id"]==cls.baseline["programRef"])

    def test_exact_historical_identity(self):
        self.assertEqual(self.baseline["registryRevision"],"2026-11-03.v43")
        self.assertGreaterEqual(int(self.registry["registryRevision"].rsplit(".v",1)[1]),43)
        self.assertEqual(self.target["admissionState"],"exclude")
        self.assertEqual(self.target["lifecycleState"],"historical")
        self.assertEqual(self.target["observedCount"],8)
        self.assertEqual(self.target["observedThesisYears"],{"min":2000,"max":2006})
        self.assertEqual(len(self.target["aliases"]),3)
        for raw in (self.target["canonicalName"],*self.target["aliases"]):
            with self.subTest(raw=raw):
                result=canonical.resolve_program(raw,self.registry)
                self.assertEqual(result["programRef"],self.target["id"])
                self.assertEqual(result["admissionState"],"exclude")

    def test_homonymous_standalone_not_automatically_aliased(self):
        for raw in (
            "Maestría en Urbanismo y Desarrollo",
            "MAESTRIA DE URBANISMO Y DESARROLLO",
            "Maestría en Urbanismo y Territorio",
        ):
            r=canonical.resolve_program(raw,self.registry)
            self.assertNotEqual(r.get("programRef"),self.target["id"])

    def test_sibling_eras_and_orientations_do_not_inherit(self):
        sibling={
            "program:udg:mae-ciencias-arquitectura-arte-comunicacion":"review",
            "program:udg:mae-ciencias-arquitectura-teoria-critica-arquitectura":"review",
            "program:udg:mae-ciencias-arquitectura-edificacion-arquitectonica":"exclude",
        }
        for ref,state in sibling.items():
            entry=next(p for p in self.registry["programs"] if p["id"]==ref)
            self.assertEqual(entry["admissionState"],state)
        hold=json.loads((ROOT/"scripts/thesis/config/program-evidence-holds-v1.json")
                        .read_text(encoding="utf-8"))
        self.assertEqual(len(hold["holds"]),1)
        self.assertEqual(
            hold["holds"][0]["programRef"],
            "program:udg:mae-ciencias-arquitectura-arte-comunicacion"
        )

    def test_policy_unmodified(self):
        scope=json.loads((ROOT/"scripts/thesis/config/scope-boundary-matrix-v1.json")
                         .read_text(encoding="utf-8"))
        confidence=json.loads((ROOT/"scripts/thesis/config/program-metadata-evidence-confidence-v1.json")
                              .read_text(encoding="utf-8"))
        self.assertEqual(scope["targetScope"],"humanities-only")
        self.assertEqual(scope["policyRevision"],"2026-11-02.v5")
        self.assertEqual(confidence["policyRevision"],"2026-11-02.v5")

if __name__=="__main__":
    unittest.main()
