"""Final Sincronía audit: evidence-backed non-article records and one true case."""
import copy
import unittest

from scripts.cucsh.audit_sincronia_pending_authors import (
    audit_pending_authors,
    exact_biographical_non_article_records,
    exact_campos_identity_conflicts,
)


def fixture():
    return [
        {
            "id": "cucsh:sincronia-legacy:a9b2551729fe0893d5e3",
            "journal": "Sincronía", "issueNumber": 8, "year": 1998,
            "title": "Dante Medina", "authors": [],
            "urls": {"canonical": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/bio.html"
            )},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyOriginal": True,
        },
        {
            "id": "cucsh:sincronia-legacy:d578e8ef399dde877feb",
            "journal": "Sincronía", "issueNumber": 15, "year": 2000,
            "title": "de Campos,Jorge Lucio", "authors": [],
            "urls": {"canonical": "http://sincronia.cucsh.udg.mx/campos.htm"},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyOriginal": True,
        },
        {
            "id": "cucsh:sincronia-legacy:91f36da6674c93b19145",
            "journal": "Sincronía", "issueNumber": 46, "year": 2008,
            "title": "Editorial Board/Consejo Editorial", "authors": [],
            "urls": {"canonical": "http://sincronia.cucsh.udg.mx/creditos.html"},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
            "legacyOriginal": True,
        },
        {
            "id": "cucsh:sincronia-legacy:a2763a903fcca568e32a",
            "journal": "Sincronía", "issueNumber": 46, "year": 2008,
            "title": "Further information for contributors.", "authors": [],
            "urls": {"canonical": "http://sincronia.cucsh.udg.mx/info.htm"},
            "legacyAccessStatus": {"status": "original-page-archived-only"},
            "legacyOriginal": True,
        },
    ]


class FinalMissingAuthorTriageTests(unittest.TestCase):
    def test_distinguishes_three_non_articles_from_one_unresolved_work(self):
        data=fixture()
        old=copy.deepcopy(data)
        report=audit_pending_authors(data)
        self.assertEqual(data,old)
        self.assertEqual(report["totalSincroniaRecords"],4)
        self.assertEqual(report["pendingAuthorRecords"],4)
        self.assertEqual(report["highConfidenceEditorialNavigationCount"],2)
        self.assertEqual(report["highConfidenceBiographicalNonArticleCount"],1)
        self.assertEqual(report["highConfidenceNonArticleCount"],3)
        self.assertEqual(report["pendingNonArticleRecordsNoBylineRequired"],3)
        self.assertEqual(report["pendingAuthorshipCasesExcludingVerifiedNonArticles"],1)
        self.assertEqual(report["unresolvedOriginalWorkIdentityConflictCount"],1)
        self.assertEqual(report["authorlessArticleCandidatesExcludingEditorialNavigation"],2)
        self.assertEqual(
            {r["id"] for r in report["highConfidenceNonArticleRecords"]},
            {data[0]["id"],data[2]["id"],data[3]["id"]},
        )
        self.assertEqual(report["unresolvedOriginalWorkIdentityConflicts"][0]["id"],
                         data[1]["id"])
        self.assertNotIn("authors",report["unresolvedOriginalWorkIdentityConflicts"][0])

    def test_biography_classification_requires_exact_url_year_issue_and_unsigned(self):
        base=fixture()
        self.assertEqual(len(exact_biographical_non_article_records(base)),1)
        for field,bad in (
            ("issueNumber",7), ("year",1997), ("title","Dante"),
            ("journal","Protrepsis"), ("authors",[{"name":"Dante Medina"}]),
            ("urls",{"canonical":"http://invented.invalid/bio.html"}),
            ("legacyAccessStatus",{"status":"original-page-archived-only"}),
        ):
            with self.subTest(field=field):
                records=fixture()
                records[0][field]=bad
                self.assertEqual(exact_biographical_non_article_records(records),[])

    def test_biography_evidence_does_not_invent_an_author(self):
        results=exact_biographical_non_article_records(fixture())
        self.assertEqual(len(results),1)
        item=results[0]
        self.assertEqual(item["classification"],
                         "author_biographical_profile_not_scholarly_work")
        self.assertIn("19980211205946",item["sourceCapture"])
        self.assertTrue(item["originalAvailabilityPreserved"])
        self.assertIn("do not assign Dante Medina",item["preservationPolicy"])

    def test_campos_never_inherits_later_2001_interview_credit(self):
        result=exact_campos_identity_conflicts(fixture())
        self.assertEqual(len(result),1)
        item=result[0]
        self.assertEqual(item["indexedYear"],2000)
        self.assertEqual(item["indexedIssue"],15)
        self.assertEqual(item["laterPageInternalIssueYear"],2001)
        self.assertIn("UMA SITUAÇÃO DE PALAVRAS",item["laterPageTitle"])
        self.assertIn("Floriano Martins",item["laterPageSubtitle"])
        self.assertIn("20020607092529",item["laterArchivedSameUrl"])
        self.assertIn("professionalBibliographyUrl",item)
        independently_cited=item["separateDeleuzeEssayLaterCitation"]
        self.assertEqual(independently_cited["documentYear"],2007)
        self.assertEqual(independently_cited["citedHistoricalUrl"],
                         "http://sincronia.cucsh.udg.mx/campos2.htm")
        self.assertIn("does not identify the 2000",independently_cited["caution"])
        self.assertNotEqual(independently_cited["citedHistoricalUrl"],
                            item["originalUrl"])
        self.assertEqual(item["status"],"original_2000_work_identity_unverified")

    def test_campos_original_identity_protects_against_wrong_issue_and_url(self):
        for field,bad in (
            ("issueNumber",21), ("year",2001),
            ("title","Uma situação de palavras"),
            ("journal","Quadripartita"),
            ("urls",{"canonical":"https://example.invalid/campos.htm"}),
            ("authors",[{"name":"Jorge Lucio de Campos"}]),
        ):
            with self.subTest(field=field):
                rows=fixture()
                rows[1][field]=bad
                self.assertEqual(exact_campos_identity_conflicts(rows),[])

    def test_dante_and_gilbert_signed_texts_are_not_reclassified_as_bios(self):
        rows=fixture()
        rows.extend([
            {"id":"cucsh:sincronia-legacy:4800ef829bfca4e699cb",
             "journal":"Sincronía", "issueNumber":8, "year":1998,
             "title":"Atreverse",
             "authors":[{"name":"Dante Medina"}],
             "urls":{"canonical":"http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/ana.html"}},
            {"id":"cucsh:sincronia-legacy:582537d89e07194c5970",
             "journal":"Sincronía", "issueNumber":8, "year":1998,
             "title":"Hypertextualizado",
             "authors":[{"name":"Stephen W. Gilbert"}],
             "urls":{"canonical":"http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/hyper.html"}},
        ])
        r=audit_pending_authors(rows)
        self.assertEqual(r["pendingAuthorRecords"],4)
        self.assertEqual(r["pendingAuthorshipCasesExcludingVerifiedNonArticles"],1)
        self.assertEqual(r["highConfidenceNonArticleCount"],3)
        self.assertEqual(r["totalSincroniaRecords"],6)


if __name__ == "__main__":
    unittest.main()
