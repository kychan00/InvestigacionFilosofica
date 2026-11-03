"""T2BS / V45: historical Didáctica de las Artes — Artes Escénicas."""
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"thesis"))
import build_canonical_corpus_v1 as canonical

class DidacticaArtesEscenicasAuthorityV45Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=canonical.load_program_registry()
        cls.baseline=json.loads(
            (ROOT/"scripts/thesis/config/didactica-artes-escenicas-authority-v45-baseline-v1.json")
            .read_text(encoding="utf-8")
        )
        cls.target=next(p for p in cls.registry["programs"] if p["id"]==cls.baseline["programRef"])

    def test_exact_historical_orientation_excluded(self):
        self.assertEqual(self.registry["registryRevision"],"2026-11-03.v45")
        self.assertEqual(self.target["admissionState"],"exclude")
        self.assertEqual(self.target["lifecycleState"],"historical")
        self.assertEqual(self.target["disciplineFamily"],"educacion-pedagogia-artes-escenicas")
        self.assertEqual(self.target["observedCount"],3)
        self.assertEqual(self.target["observedThesisYears"],{"min":2005,"max":2006})
        self.assertEqual(len(self.target["aliases"]),2)
        for raw in (self.target["canonicalName"],*self.target["aliases"]):
            with self.subTest(raw=raw):
                x=canonical.resolve_program(raw,self.registry)
                self.assertEqual(x["programRef"],self.target["id"])
                self.assertEqual(x["admissionState"],"exclude")

    def test_visuales_is_independent_sibling_already_excluded(self):
        spec=self.baseline["expected"]["siblingVisuales"]
        p=next(p for p in self.registry["programs"] if p["id"]==spec["ref"])
        self.assertEqual(p["admissionState"],spec["state"])
        self.assertEqual(p["observedCount"],spec["works"])

    def test_generic_and_music_are_not_absorbed(self):
        for raw in (
            "Maestría En Didáctica De Las Artes",
            "Maestría En Didácticas De Las Artes",
            "Maestría En Didáctica De Las Artes Orientación En Música",
            "Maestría en Didáctica de las Artes en el Área de Música",
        ):
            x=canonical.resolve_program(raw,self.registry)
            self.assertNotEqual(x.get("programRef"),self.target["id"])

    def test_policies_preserved(self):
        scope=json.loads((ROOT/"scripts/thesis/config/scope-boundary-matrix-v1.json").read_text())
        conf=json.loads((ROOT/"scripts/thesis/config/program-metadata-evidence-confidence-v1.json").read_text())
        work=json.loads((ROOT/"scripts/thesis/config/boundary-work-review-policy-v1.json").read_text())
        self.assertEqual(scope["policyRevision"],"2026-11-02.v5")
        self.assertEqual(scope["targetScope"],"humanities-only")
        self.assertEqual(conf["policyRevision"],"2026-11-02.v5")
        self.assertEqual(work["policyRevision"],"2026-11-03.boundary-v3")

if __name__=="__main__":
    unittest.main()
