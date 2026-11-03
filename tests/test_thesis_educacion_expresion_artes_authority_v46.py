"""T2BT / V46: Educación y Expresión para las Artes is outside strict humanities."""
import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"thesis"))
import build_canonical_corpus_v1 as canonical

class EducacionExpresionArtesV46Test(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.registry=canonical.load_program_registry()
  cls.baseline=json.loads((ROOT/"scripts/thesis/config/educacion-expresion-artes-authority-v46-baseline-v1.json").read_text())
  cls.target=next(p for p in cls.registry["programs"] if p["id"]==cls.baseline["programRef"])
 def test_exact_program_excluded(self):
  self.assertEqual(self.registry["registryRevision"],"2026-11-03.v46")
  self.assertEqual(self.target["admissionState"],"exclude")
  self.assertEqual(self.target["lifecycleState"],"active")
  self.assertEqual(self.target["observedCount"],27)
  self.assertEqual(self.target["observedThesisYears"],{"min":2018,"max":2026})
  for raw in (self.target["canonicalName"],*self.target["aliases"]):
   x=canonical.resolve_program(raw,self.registry)
   self.assertEqual(x["programRef"],self.target["id"])
   self.assertEqual(x["admissionState"],"exclude")
 def test_neighboring_humanities_authorities_unchanged(self):
  expected={
   "program:udg:mae-etnomusicologia":"include",
   "program:udg:mae-gestion-desarrollo-cultural":"include",
   "program:udg:lic-historia-arte":"include",
   "program:udg:mae-didactica-artes-visuales-historica":"exclude",
   "program:udg:mae-didactica-artes-escenicas-historica":"exclude",
  }
  by={p["id"]:p for p in self.registry["programs"]}
  for ref,state in expected.items(): self.assertEqual(by[ref]["admissionState"],state)
 def test_policies_and_work_review_preserved(self):
  scope=json.loads((ROOT/"scripts/thesis/config/scope-boundary-matrix-v1.json").read_text())
  conf=json.loads((ROOT/"scripts/thesis/config/program-metadata-evidence-confidence-v1.json").read_text())
  work=json.loads((ROOT/"scripts/thesis/config/boundary-work-review-policy-v1.json").read_text())
  self.assertEqual(scope["policyRevision"],"2026-11-02.v5")
  self.assertEqual(scope["targetScope"],"humanities-only")
  self.assertEqual(conf["policyRevision"],"2026-11-02.v5")
  self.assertEqual(work["policyRevision"],"2026-11-03.boundary-v3")
  self.assertEqual(len(work["programs"]),3)
if __name__=="__main__": unittest.main()
