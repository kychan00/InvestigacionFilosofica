import unittest
from scripts.cucsh.audit_sincronia_2008_identity import (
    ISSUES, audit_issue, build_report, navigation_hint, build_candidates,
)


def row(n, code, title, url=None, authors=None):
    return {
        "id": f"original:{n}:{code}:{title}",
        "journal": "Sincronía", "issueNumber": n,
        "title": title, "sourceId": f"dialnet:{code}" if code else None,
        "urls": {"canonical": url or (
            "https://dialnet.unirioja.es/servlet/articulo?codigo=" + code
            if code else "http://sincronia.cucsh.udg.mx/known.htm"
        )},
        "authors": [{"name": x} for x in (authors or [])],
    }


class HistoricalIdentityAuditTests(unittest.TestCase):
    def test_issue_scope_is_exactly_targeted(self):
        self.assertEqual(ISSUES, (46, 47, 48, 50))

    def test_known_navigation_never_becomes_article(self):
        nav = row(46, "", "Editorial Board/Consejo Editorial",
                  "http://sincronia.cucsh.udg.mx/creditos.html")
        self.assertIn("editorial board", navigation_hint(nav))
        article = row(46, "12", "A legitimate research article")
        result = audit_issue([nav, article], [article], 46, True)
        self.assertEqual(len(result["navigationReview"]), 1)
        self.assertEqual(result["matchedCount"], 1)
        self.assertEqual(result["localCount"], 2)

    def test_author_label_matches_known_article(self):
        old = row(46, "", "Saganogo, Brahiman")
        source = row(46, "123", "Estudios filosóficos",
                     authors=["Brahiman Saganogo"])
        report = audit_issue([old], [source], 46, True)
        self.assertEqual(len(report["articleMatches"]), 1)
        self.assertEqual(
            report["articleMatches"][0]["status"],
            "author_label_needs_title_reconstruction"
        )
        self.assertEqual(report["matchedCount"], 1)

    def test_missing_external_article_is_review_only(self):
        old = row(46, "100", "Filosofía social")
        src = [old, row(46, "101", "Economía histórica")]
        report = audit_issue([old], src, 46, True)
        self.assertEqual(len(report["sourceUnmatched"]), 1)
        self.assertEqual(report["sourceUnmatched"][0]["sourceId"], "dialnet:101")

    def test_duplicate_author_assignment_not_confirmed(self):
        a = row(46, "", "Saganogo, Brahiman",
                "http://sincronia.cucsh.udg.mx/a.htm")
        b = row(46, "", "Saganogo, Brahiman",
                "http://sincronia.cucsh.udg.mx/b.htm")
        source = [row(46, "123", "Una obra", authors=["Brahiman Saganogo"])]
        report = audit_issue([a, b], source, 46, True)
        self.assertEqual(report["matchedCount"], 0)
        self.assertEqual(len(report["localUnresolved"]), 2)

    def test_no_response_does_not_count_as_complete(self):
        report = build_report(
            [row(46, "1", "Filosofía social")], [], []
        )
        self.assertEqual(report["status"], "partial_source_unavailable")
        self.assertEqual(report["issuesUnavailable"], list(ISSUES))
        self.assertEqual(report["totals"]["sourceRecords"], 0)

    def test_different_issue_never_matches(self):
        only_47 = row(47, "123", "Filosofía social")
        report = audit_issue(
            [row(46, "", "Filosofía social")],
            [only_47], 46, True,
        )
        self.assertEqual(report["status"], "source_unavailable")

    def test_no_author_guess_for_title_that_is_not_name(self):
        original = row(46, "", "Aging and Social Welfare")
        external = row(46, "321", "A different article",
                       authors=["Stephen W. Gilbert"])
        self.assertEqual(build_candidates(original, [external]), [])


if __name__ == "__main__":
    unittest.main()
