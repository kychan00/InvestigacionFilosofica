import unittest
from scripts.cucsh.stage_sincronia_46_50 import stage, source_rows


def sample(issue, n, protect=False):
    name=f"Martínez, María Elena {n}"
    code=f"{issue}123{n}"
    local_id=f"legacy:{issue}:{n}"
    row={
        "id": local_id, "journal": "Sincronía", "issueNumber": issue,
        "legacyOriginal": True, "title": name, "titleVariants": [name],
        "authors": [], "urls": {
            "canonical": f"http://sincronia.cucsh.udg.mx/article{issue}{n}.htm",
        },
    }
    if protect:
        row["legacyTitleEncodingEvidence"]={"kind":"prior-correction"}
    evidence={
        "localId":local_id, "localTitle":name, "localUrl":row["urls"]["canonical"],
        "status":"author_label_needs_title_reconstruction",
        "method":"index_author_label_to_article", "confidence":1.0,
        "source":{
            "sourceId":f"dialnet:{code}", "title":f"An original article about philosophy {n}",
            "authors":[f"María Elena Martínez {n}"],
            "url":f"https://dialnet.unirioja.es/servlet/articulo?codigo={code}",
        },
    }
    return row,evidence


def fixture():
    rows=[sample(46,i,protect=(i==0)) for i in range(14)]
    rows +=[sample(50,i,protect=(i==1)) for i in range(4)]
    extra={
        "id":"navigation","journal":"Sincronía","issueNumber":46,
        "title":"Editorial Board/Consejo Editorial",
        "urls":{"canonical":"http://sincronia.cucsh.udg.mx/creditos.html"},
    }
    snapshot={"records":[pair[0] for pair in rows]+[extra]}
    report={
        "status":"review_ready", "issuesRetrieved":[46,47,48,50],
        "issuesUnavailable":[],
        "issues":[{
            "issue":issue, "status":"needs_review",
            "articleMatches":[pair[1] for pair in rows if pair[0]["issueNumber"]==issue],
        } for issue in (46,50)],
    }
    return snapshot,report


class StageIssue4650Tests(unittest.TestCase):
    def test_exact_match_stage_and_preserve_provenance(self):
        baseline,evidence=fixture()
        after,report=stage(baseline,evidence,run_id=999)
        self.assertEqual(report["changedRecords"],18)
        self.assertEqual(report["authorsRestored"],18)
        self.assertEqual(report["reconstructedTitles"],16)
        self.assertEqual(report["priorTitleEvidencePreserved"],2)
        self.assertEqual(after["records"][-1],baseline["records"][-1])
        self.assertEqual(after["records"][0]["title"],baseline["records"][0]["title"])
        self.assertEqual(after["records"][0]["legacyTitleEncodingEvidence"],
                         baseline["records"][0]["legacyTitleEncodingEvidence"])
        self.assertNotIn("legacyIndexMislabelEvidence",after["records"][0])
        self.assertEqual(after["records"][1]["title"],
                         "An original article about philosophy 1")
        self.assertEqual(after["records"][1]["urls"],baseline["records"][1]["urls"])

    def test_wrong_label_source_fails(self):
        baseline,evidence=fixture()
        evidence["issues"][0]["articleMatches"][0]["source"]["authors"]=["Other Person"]
        with self.assertRaisesRegex(ValueError,"does not independently match"):
            stage(baseline,evidence)

    def test_duplicate_source_id_fails(self):
        baseline,evidence=fixture()
        evidence["issues"][0]["articleMatches"][1]["source"]["sourceId"]=(
            evidence["issues"][0]["articleMatches"][0]["source"]["sourceId"]
        )
        evidence["issues"][0]["articleMatches"][1]["source"]["url"]=(
            evidence["issues"][0]["articleMatches"][0]["source"]["url"]
        )
        with self.assertRaisesRegex(ValueError,"duplicate"):
            stage(baseline,evidence)

    def test_existing_author_fails(self):
        baseline,evidence=fixture()
        baseline["records"][2]["authors"]=[{"name":"Existing"}]
        with self.assertRaisesRegex(ValueError,"changed since prior audit"):
            stage(baseline,evidence)

    def test_missing_evidence_fails(self):
        baseline,evidence=fixture()
        evidence["issues"][0]["articleMatches"].pop()
        with self.assertRaisesRegex(ValueError,"expected 14"):
            stage(baseline,evidence)

    def test_unavailable_issue_fails(self):
        baseline,evidence=fixture()
        evidence["issuesUnavailable"]=[46]
        with self.assertRaisesRegex(ValueError,"source audit was incomplete"):
            stage(baseline,evidence)


if __name__=="__main__":
    unittest.main()
