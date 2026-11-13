"""Offline tests for the final four Sincronía source-identity investigations."""
import copy
import unittest
from scripts.cucsh.research_sincronia_final_contexts import (
    TARGET_IDS, CANDIDATES, AnchorParser, inspect_candidate, make_report,
)


def fixture():
    target = [{
        "id": rid, "issueNumber": 8 if rid !=
        "cucsh:sincronia-legacy:d578e8ef399dde877feb" else 15,
        "year": 1998, "title": "Original indexed label",
        "originalUrl": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/hyper.html",
        "sourceAvailability": "original-page-unavailable",
    } for rid in sorted(TARGET_IDS)]
    target.extend([
        {"id": "cucsh:sincronia-legacy:91f36da6674c93b19145",
         "issueNumber": 46, "year": 2008, "title": "Editorial Board/Consejo Editorial",
         "originalUrl": "http://sincronia.cucsh.udg.mx/creditos.html",
         "sourceAvailability": "original-page-unavailable"},
        {"id": "cucsh:sincronia-legacy:a2763a903fcca568e32a",
         "issueNumber": 46, "year": 2008, "title": "Further information for contributors.",
         "originalUrl": "http://sincronia.cucsh.udg.mx/info.htm",
         "sourceAvailability": "original-page-archived-only"},
    ])
    return {"totalSincroniaRecords": 1454, "pendingAuthorRecords": 6,
            "highConfidenceEditorialNavigationCount": 2,
            "records": target}


class FinalSincroniaContextTests(unittest.TestCase):
    def test_index_exact_six_records_and_no_mutation(self):
        d=fixture()
        before=copy.deepcopy(d)
        inspected=[]
        def fake(url):
            inspected.append(url)
            return {"candidateUrl":url, "indexErrors":[],
                    "captures":[{"captureStatus":"html",
                                 "visibleText":"Dante Medina biography only"}]}
        report=make_report(d,inspect=fake)
        self.assertEqual(d,before)
        self.assertEqual(report["candidateUrlsInspected"],len(CANDIDATES))
        self.assertEqual(report["inputMissingAuthors"],6)
        self.assertEqual(report["targetUncreditedNonEditorial"],4)
        self.assertEqual(report["editorialNavigationNotAcademicArticles"],2)
        self.assertEqual(report["authorAssignments"],0)
        self.assertFalse(report["corpusModified"])
        self.assertEqual(set(inspected),set(CANDIDATES))
        self.assertEqual([x["candidateUrl"] for x in report["sourceReviews"]],CANDIDATES)

    def test_bad_counts_id_drift_or_duplicate_rejected(self):
        for key,value in (("totalSincroniaRecords",1453),
                          ("pendingAuthorRecords",7),
                          ("highConfidenceEditorialNavigationCount",1)):
            with self.subTest(key=key):
                d=fixture()
                d[key]=value
                with self.assertRaises(ValueError):
                    make_report(d,inspect=lambda url:{"candidateUrl":url})
        d=fixture()
        d["records"].pop()
        with self.assertRaises(ValueError):
            make_report(d,inspect=lambda url:{"candidateUrl":url})
        d=fixture()
        d["records"][0]["id"]=d["records"][1]["id"]
        with self.assertRaises(ValueError):
            make_report(d,inspect=lambda url:{"candidateUrl":url})

    def test_capture_links_preserve_href_and_author_does_not_follow_automatically(self):
        parser=AnchorParser()
        parser.feed(
            '<a href="ana.html">A Ana le gustan los aeropuertos</a>'
            '<a href="hyper.html">Hypertextualizado</a>'
            '<a href="bio.html"><b>Dante Medina</b></a>'
        )
        self.assertEqual(len(parser.links),3)
        self.assertEqual(parser.links[2]["label"],"Dante Medina")
        self.assertEqual(parser.links[1]["href"],"hyper.html")
        self.assertTrue(all("author" not in x for x in parser.links))

    def test_no_capture_returns_no_guessed_authors(self):
        x=inspect_candidate(
            "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/",
            indexer=lambda _: ([],["HTTPError"]),
            fetcher=lambda _: self.fail("No capture must not call fetcher"),
        )
        self.assertEqual(x["captures"],[])
        self.assertEqual(x["indexErrors"],["HTTPError"])

    def test_verified_capture_is_only_evidence_not_catalogue_edit(self):
        called=[]
        def fake_fetch(url):
            called.append(url)
            return {"captureStatus":"html","visibleText":"Dante", "relevantLinks":[]}
        x=inspect_candidate(
            CANDIDATES[0],
            indexer=lambda url: ([{"timestamp":"19980211205946",
                "snapshotUrl":"https://web.archive.org/web/19980211205946/"+url}],[]),
            fetcher=fake_fetch,
        )
        self.assertEqual(len(x["captures"]),1)
        self.assertEqual(x["captures"][0]["captureStatus"],"html")
        self.assertEqual(len(called),1)
        self.assertNotIn("author",x)


if __name__ == "__main__":
    unittest.main()
