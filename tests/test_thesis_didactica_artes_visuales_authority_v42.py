"""T2BN/V42: exclude only historical Didáctica Artes Visuales."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"thesis"))
import build_canonical_corpus_v1 as canonical


class DidacticaArtesVisualesAuthorityV42Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=canonical.load_program_registry()
        cls.baseline=json.loads(
            (ROOT/"scripts/thesis/config/didactica-artes-visuales-authority-v42-baseline-v1.json")
            .read_text(encoding="utf-8")
        )
        cls.target=next(p for p in cls.registry["programs"]
                        if p["id"]==cls.baseline["programRef"])

    def test_exact_identity_excluded(self):
        self.assertEqual(self.baseline["registryRevision"],"2026-11-03.v42")
        self.assertGreaterEqual(
            int(self.registry["registryRevision"].rsplit(".v",1)[1]),42
        )
        self.assertEqual(self.target["admissionState"],"exclude")
        self.assertEqual(self.target["lifecycleState"],"historical")
        self.assertEqual(self.target["observedCount"],16)
        self.assertEqual(self.target["observedThesisYears"],{"min":2003,"max":2006})
        self.assertEqual(len(self.target["aliases"]),5)
        for raw in (self.target["canonicalName"],*self.target["aliases"]):
            with self.subTest(raw=raw):
                resolved=canonical.resolve_program(raw,self.registry)
                self.assertEqual(resolved["programRef"],self.target["id"])
                self.assertEqual(resolved["admissionState"],"exclude")

    def test_independent_terminal_areas_are_not_inherited(self):
        # V42 intentionally left Escénicas REVIEW. T2BS/V45 later resolved it
        # independently; this regression must preserve that chronology.
        self.assertEqual(
            self.baseline["expected"]["siblingEscenicas"]["admission"],
            "review",
        )
        esc=next(p for p in self.registry["programs"]
                 if p["id"]=="program:udg:mae-didactica-artes-escenicas-historica")
        self.assertEqual(esc["admissionState"],"exclude")
        self.assertEqual(esc["observedCount"],3)
        self.assertIn("T2BS/V45",esc["decisionNote"])
        for alias in esc["aliases"]:
            r=canonical.resolve_program(alias,self.registry)
            self.assertEqual(r["programRef"],esc["id"])
            self.assertEqual(r["admissionState"],"exclude")
        for raw in ("Maestría En Didáctica De Las Artes",
                    "Maestría En Didácticas De Las Artes",
                    "Maestría En Didáctica De Las Artes Orientación En Música"):
            r=canonical.resolve_program(raw,self.registry)
            self.assertNotEqual(r.get("programRef"),self.target["id"])
            self.assertNotEqual(r.get("admissionState"),"exclude")

    def test_mca_historical_evidence_hold_still_review(self):
        h=next(p for p in self.registry["programs"]
               if p["id"]=="program:udg:mae-ciencias-arquitectura-arte-comunicacion")
        self.assertEqual(h["admissionState"],"review")
        hold=json.loads(
            (ROOT/"scripts/thesis/config/program-evidence-holds-v1.json")
            .read_text(encoding="utf-8")
        )
        self.assertEqual(len(hold["holds"]),1)
        self.assertEqual(hold["holds"][0]["programRef"],h["id"])

    def test_scope_and_metadata_policy_unchanged(self):
        scope=json.loads((ROOT/"scripts/thesis/config/scope-boundary-matrix-v1.json")
                         .read_text(encoding="utf-8"))
        confidence=json.loads((ROOT/"scripts/thesis/config/program-metadata-evidence-confidence-v1.json")
                              .read_text(encoding="utf-8"))
        self.assertEqual(scope["targetScope"],"humanities-only")
        self.assertEqual(scope["policyRevision"],"2026-11-02.v5")
        self.assertEqual(confidence["policyRevision"],"2026-11-02.v5")


if __name__=="__main__":
    unittest.main()
