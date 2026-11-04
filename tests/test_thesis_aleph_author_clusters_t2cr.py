"""T2CR: count sources, not unrelated publications by the same author."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1]/"scripts/thesis/summarize_aleph_author_clusters_t2cr.py"
spec = importlib.util.spec_from_file_location("t2cr",PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)

def cand(sys, same_author=True):
    return {
        "systemNumber":sys, "sameAuthorTokens":same_author,
        "reviewOnly":True,"sameWorkConfirmed":False,
        "physicalLocationConfirmed":False,
        "reviewReasons":["title-not-exact"],
    }

def sample():
    return {
        "schemaVersion":"thesis-philosophy-aleph-discrepancy-review-v1",
        "revision":"test-t2cq","referenceOnly":True,
        "automaticIdentityPromotion":False,"physicalClaimsAdded":False,
        "offset":0,
        "reviews":[
            {"id":"source-silvia", "sourceTitle":"Concepto del hombre en el joven Marx",
            "sourceAuthor":"Silvia Moreno", "status":"unresolved","reason":"no-exact-thesis-identity",
            "reviewCandidates":[cand("000220110")]},
            {"id":"source-francisco", "sourceTitle":"Fidel Castro y el fenómeno religioso",
            "sourceAuthor":"Francisco Salinas","status":"unresolved","reason":"no-exact-thesis-identity",
            "reviewCandidates":[cand(f"{i:09d}") for i in range(5)]},
            {"id":"source-juve","sourceTitle":"Hobbes y epistemología",
            "sourceAuthor":"Juve Prieto","status":"unresolved","reason":"no-exact-thesis-identity",
            "reviewCandidates":[cand("000570466")]},
            {"id":"source-no-results","sourceTitle":"Otra tesis",
            "sourceAuthor":"Persona sin ficha","status":"unresolved","reason":"no-exact-thesis-identity",
            "reviewCandidates":[]},
        ],
    }

class T2CRTests(unittest.TestCase):
    def test_seven_hits_only_three_source_theses(self):
        data=mod.summarize(sample())
        self.assertEqual(data["metrics"]["sourceThesesExamined"],4)
        self.assertEqual(data["metrics"]["sourceThesesWithSameAuthorCandidates"],3)
        self.assertEqual(data["metrics"]["sameAuthorCandidateHits"],7)
        self.assertEqual(data["metrics"]["newThesesConfirmed"],0)
        self.assertEqual(data["metrics"]["newPhysicalLocationsConfirmed"],0)
        self.assertEqual(data["cases"][1]["reviewPriority"],"author-overlap-different-title")
        self.assertFalse(data["autoMerged"])
        self.assertFalse(data["holdingsPromoted"])

    def test_hard_reject_promoted_candidate(self):
        data=sample()
        data["reviews"][0]["reviewCandidates"][0]["sameWorkConfirmed"]=True
        with self.assertRaises(ValueError):
            mod.summarize(data)

    def test_ambiguous_no_candidates_is_preserved(self):
        data=sample()
        data["reviews"][3]["reason"]="candidate-overflow"
        out=mod.summarize(data)
        self.assertEqual(out["cases"][3]["reviewPriority"],"candidate-overflow-or-incomplete")

    def test_refuses_duplicated_source_ids(self):
        data=sample()
        data["reviews"][1]["id"]=data["reviews"][0]["id"]
        with self.assertRaises(ValueError):
            mod.summarize(data)

    def test_refuses_duplicated_sys_within_source(self):
        data=sample()
        data["reviews"][0]["reviewCandidates"].append(cand("000220110"))
        with self.assertRaises(ValueError):
            mod.summarize(data)

    def test_refuses_full_text_or_missing_reference_only_guard(self):
        data=sample()
        data["referenceOnly"]=False
        with self.assertRaises(ValueError):
            mod.summarize(data)

if __name__=="__main__":
    unittest.main()
