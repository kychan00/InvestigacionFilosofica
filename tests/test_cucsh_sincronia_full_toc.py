import unittest
from scripts.cucsh.audit_sincronia_full_toc import compare_full_issues, create_report


def record(issue, code, title):
    return {
        "id": f"article:{issue}:{code or title}",
        "journal": "Sincronía",
        "issueNumber": issue, "sourceId": f"dialnet:{code}" if code else None,
        "title": title, "authors": [{"name": "Persona"}],
        "urls": {"canonical": (
            "https://dialnet.unirioja.es/servlet/articulo?codigo=" + code
            if code else "http://sincronia.cucsh.udg.mx/original.htm"
        )},
    }


class AllIssueTocAuditTest(unittest.TestCase):
    def test_exact_article_id_across_issue(self):
        rows = compare_full_issues(
            [record(44, "123", "Una obra")],
            [record(44, "123", "Una obra")], [44],
        )
        self.assertEqual(rows[0]["exactIdMatches"], 1)
        self.assertEqual(rows[0]["possibleMissingArticles"], 0)

    def test_title_only_is_review_not_proof_of_identity(self):
        rows = compare_full_issues(
            [record(44, "", "Filosofía en la modernidad")],
            [record(44, "200", "Filosofia en la modernidad")], [44],
        )
        self.assertEqual(rows[0]["titleOnlyReview"], 1)
        self.assertEqual(rows[0]["status"], "requires_review")
        self.assertEqual(rows[0]["findings"][0]["dialnetCode"], "200")

    def test_article_missing_from_non_sparse_issue_is_flagged(self):
        rows = compare_full_issues(
            [record(21, "100", "Artículo conocido")],
            [record(21, "100", "Artículo conocido"),
             record(21, "101", "Una investigación filosófica totalmente nueva")],
            [21],
        )
        self.assertEqual(rows[0]["possibleMissingArticles"], 1)
        self.assertEqual(
            rows[0]["findings"][0]["type"], "possible_missing_article"
        )

    def test_same_title_other_issue_cannot_match(self):
        rows = compare_full_issues(
            [record(39, "120", "Historia de México")],
            [record(44, "200", "Historia de México")],
            [39, 44],
        )
        self.assertEqual(rows[1]["possibleMissingArticles"], 1)

    def test_unavailable_issue_is_not_marked_complete(self):
        result = create_report(
            [record(44, "1", "Filosofía")], [], [44],
        )
        self.assertEqual(result["status"], "partial_source_unavailable")
        self.assertEqual(result["totals"]["issuesUnavailable"], 1)
        self.assertEqual(result["missingIssueNumbers"], [44])

    def test_report_status_is_string_for_every_outcome(self):
        unavailable = create_report([], [], [44])
        complete = create_report(
            [record(44, "1", "Filosofía")],
            [record(44, "1", "Filosofía")], [44],
        )
        review = create_report(
            [record(44, "1", "Filosofía")],
            [record(44, "2", "Otro artículo distinto")], [44],
        )
        self.assertEqual(unavailable["status"], "partial_source_unavailable")
        self.assertEqual(complete["status"], "matched_source")
        self.assertEqual(review["status"], "requires_article_review")
        for report in (unavailable, complete, review):
            self.assertIsInstance(report["status"], str)

    def test_variant_reported_separately_from_certain_missing(self):
        rows = compare_full_issues(
            [record(44, "", "Filosofía política contemporánea")],
            [record(44, "200", "Filosofia politica contemporánea")],
            [44],
        )
        self.assertEqual(rows[0]["possibleTitleVariants"], 0)
        self.assertEqual(rows[0]["titleOnlyReview"], 1)


if __name__ == "__main__":
    unittest.main()
