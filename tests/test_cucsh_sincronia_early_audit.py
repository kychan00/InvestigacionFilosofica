import unittest
from scripts.cucsh.audit_sincronia_early import (
    normalized_link, inspect_issue, summarize_author_gaps,
)


def record(issue, title, url, authors=None, source="original"):
    return {
        "id": f"test:{issue}:{title}",
        "journal": "Sincronía", "issueNumber": issue,
        "title": title, "authors": authors or [],
        "urls": {"canonical": url},
        "legacyMetadataSource": source,
    }


class EarlyAuditTests(unittest.TestCase):
    def test_url_normalization_ignores_protocol_and_case(self):
        a = normalized_link("http://FUENTES.CSH.UDG.MX/Some/ART.HTM")
        b = normalized_link("https://fuentes.csh.udg.mx/Some/art.htm")
        self.assertEqual(a, b)

    def test_missing_source_cannot_certify_completeness(self):
        rows = [record(3, "An old article", "http://example.org/a.htm")]
        result = inspect_issue(3, rows, None)
        self.assertEqual(result["finding"], "source_unavailable_review_required")
        self.assertEqual(result["localArticles"], 1)

    def test_index_only_creates_candidates_not_articles(self):
        rows = [record(6, "Filosofía antigua", "http://example.org/a.htm")]
        page = {
            "title": "Spring 1998", "year": 1998,
            "links": [
                {"url": "https://example.org/a.htm", "text": "Filosofía antigua"},
                {"url": "http://example.org/b.htm", "text": "Otra obra"},
            ],
        }
        result = inspect_issue(6, rows, page)
        self.assertEqual(result["indexArticleCandidates"], 2)
        self.assertEqual(len(result["candidateLinksNotMatched"]), 1)
        self.assertEqual(result["finding"], "review_unmatched_index_links")

    def test_authors_not_inferred(self):
        rows = [
            record(3, "Uno", "http://example.org/1.htm"),
            record(3, "Dos", "http://example.org/2.htm",
                   authors=[{"name": "Known"}], source="Dialnet"),
        ]
        summary = summarize_author_gaps(rows)
        self.assertEqual(summary["missingAuthorTotal"], 1)
        self.assertEqual(summary["byMetadataSource"]["original"]["withoutAuthors"], 1)
        self.assertEqual(summary["byMetadataSource"]["Dialnet"]["withoutAuthors"], 0)


if __name__ == "__main__":
    unittest.main()
