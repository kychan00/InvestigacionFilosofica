#!/usr/bin/env python3
import unittest
from scripts.cucsh.audit_sincronia_historical import (
    historical_audit, normalized_title,
)


def row(issue, article_id, title="Filosofía e historia", **updates):
    value = {
        "id": "article:" + str(article_id),
        "title": title,
        "year": 2004,
        "issueNumber": issue,
        "journal": "Sincronía",
        "authors": [{"name": "Autora"}],
        "urls": {"canonical": "https://example.org/article/" + str(article_id)},
        "legacyMetadataSource": "Dialnet",
    }
    value.update(updates)
    return value


class HistoricalAuditTest(unittest.TestCase):
    def test_normalization_ignores_accents_and_punctuation(self):
        self.assertEqual(
            normalized_title("Filosofía: enseñanza y educación"),
            "filosofia ensenanza y educacion",
        )

    def test_missing_issue_is_fatal_but_low_count_is_reviewable(self):
        records = [row(n, n) for n in range(1, 61)]
        result = historical_audit(records)
        self.assertEqual(result["status"], "pass")
        self.assertTrue(any(
            x["issue"] == 29 and x["type"] == "very_low_article_count"
            for x in result["reviewQueue"]
        ))
        result = historical_audit(records[:-1])
        self.assertEqual(result["status"], "fail")
        self.assertTrue(any(
            x["issue"] == 60 and x["type"] == "missing_issue"
            for x in result["integrityErrors"]
        ))

    def test_url_and_id_integrity_is_strict(self):
        records = [row(n, n) for n in range(1, 61)]
        records.append(row(29, 1, title="Otro artículo"))
        result = historical_audit(records)
        self.assertEqual(result["status"], "fail")
        errors = {x["type"] for x in result["integrityErrors"]}
        self.assertIn("duplicate_id", errors)
        self.assertIn("duplicate_canonical_url", errors)

    def test_repeated_titles_between_issues_are_not_silently_dropped(self):
        records = [row(n, n, title="Historia en México") for n in range(1, 61)]
        result = historical_audit(records)
        self.assertEqual(result["articleCount"], 60)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(
            result["repeatedTitlesAcrossIssues"][0]["issues"],
            list(range(1, 61)),
        )


if __name__ == "__main__":
    unittest.main()
