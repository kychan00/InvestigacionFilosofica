"""T2CQ review queue: candidates are never promoted by title similarity."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/"scripts/thesis/audit_philosophy_aleph_discrepancies_t2cq.py"
spec=importlib.util.spec_from_file_location("t2cq",SCRIPT)
mod=importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

SOURCE={
    "id":"cucsh:sample",
    "title":"Feminidad y experiencia",
    "authors":["Guillermo Castillo Ramírez"],
    "year":2004,
    "program":"Licenciatura en Filosofía",
    "whereaboutsStatus":"cataloged-location-unresolved",
    "reviewFlags":[],
}

def fake_query(*args,**kwargs):
    return ["000123456"]

def mismatched_fetch(*args,**kwargs):
    return ({"fields":{
        "título":"Femenidad y experiencia",
        "autor":"Castillo Ramírez, Guillermo",
        "nota de tesis":"Licenciatura en Filosofía",
        "número de sistema":"000123456",
    }},[{"sublibrary":"B.C. CUCSH"}])

class ReviewQueueTests(unittest.TestCase):
    def test_title_typo_is_review_only(self):
        result=mod.audit_one(SOURCE,opener=object(),action="fake",
            query=fake_query,fetch=mismatched_fetch)
        self.assertEqual(result["decision"]["status"],"unresolved")
        candidate=result["candidates"][0]
        self.assertTrue(candidate["sameAuthorTokens"])
        self.assertTrue(candidate["observedThesisEvidence"])
        self.assertIn("title-not-exact",candidate["reviewReasons"])
        self.assertFalse(candidate["sameWorkConfirmed"])
        self.assertFalse(candidate["physicalLocationConfirmed"])
        self.assertNotIn("holdings",candidate)

    def test_exact_match_is_not_review_candidate(self):
        def fetch(*args,**kwargs):
            return ({"fields":{
                "título":"Feminidad y experiencia",
                "autor":"Castillo Ramírez, Guillermo",
                "nota de tesis":"Licenciatura",
                "número de sistema":"000123456",
            }},[])
        result=mod.audit_one(SOURCE,opener=object(),action="fake",
            query=fake_query,fetch=fetch)
        self.assertEqual(result["decision"]["status"],"resolved")
        self.assertEqual(result["candidates"],[])

    def test_no_session_or_unsafe_field_in_metadata(self):
        data=mod.public_metadata({
            "título":"La ética moderna",
            "autor":"Pérez",
            "recordUrl":"http://148.202.248.73/F/SESSION?func=direct",
            "nota de tesis":"Tesis",
            "base lógica":"Tesis",
            "extra":"other",
        })
        self.assertNotIn("recordurl",data)
        self.assertNotIn("extra",data)
        self.assertEqual(data["base lógica"],"Tesis")

    def test_review_pagination_without_network(self):
        records=[
            dict(SOURCE,id="r"+str(i),year=1970+10*(i%2))
            for i in range(5)
        ]
        master={"schemaVersion":"thesis-philosophy-whereabouts-index-v1",
            "revision":"test", "records":records}
        seeds={"schemaVersion":"philosophy-aleph-identity-seeds-v1","records":[]}
        def auditor(row,**kwargs):
            return {"decision":{"status":"unresolved","reason":"no-exact-thesis-identity",
                "attempts":[]},"candidates":[]}
        a=mod.build_review(master,seeds,offset=0,limit=3,opener=object(),action="fake",
            auditor=auditor,sleep_seconds=0)
        b=mod.build_review(master,seeds,offset=3,limit=3,opener=object(),action="fake",
            auditor=auditor,sleep_seconds=0)
        self.assertEqual(a["metrics"]["attempted"],3)
        self.assertEqual(b["metrics"]["attempted"],2)
        self.assertEqual(len({r["id"] for r in a["reviews"]+b["reviews"]}),5)
        self.assertFalse(a["automaticIdentityPromotion"])
        self.assertFalse(a["physicalClaimsAdded"])

    def test_invalid_batch_bound(self):
        master={"schemaVersion":"thesis-philosophy-whereabouts-index-v1","records":[]}
        seeds={"schemaVersion":"philosophy-aleph-identity-seeds-v1","records":[]}
        with self.assertRaises(ValueError):
            mod.build_review(master,seeds,offset=-1,limit=8)
        with self.assertRaises(ValueError):
            mod.build_review(master,seeds,offset=0,limit=41)

if __name__=="__main__":
    unittest.main()
