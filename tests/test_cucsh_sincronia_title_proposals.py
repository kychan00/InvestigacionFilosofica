import unittest

from scripts.cucsh.propose_sincronia_title_repairs import (
    canonical_path, propose_title_repair, generate_proposals,
)


class TitleRepairProposalTests(unittest.TestCase):
    def test_same_url_different_scheme_and_case_is_accepted(self):
        row = {
            "id": "article:1", "issueNumber": 1,
            "title": "Filosof\ufffda moderna",
            "urls": {"canonical": "http://example.org/ART.HTM"},
        }
        links = [{"url": "https://example.org/art.htm",
                  "text": "Filosofía moderna"}]
        proposal = propose_title_repair(row, links)
        self.assertEqual(proposal["status"], "strong_index_match")
        self.assertEqual(proposal["proposedTitle"], "Filosofía moderna")

    def test_different_url_cannot_authorize_title_change(self):
        row = {
            "id": "article:2", "issueNumber": 1,
            "title": "Filosof\ufffda moderna",
            "urls": {"canonical": "http://example.org/original.htm"},
        }
        links = [{"url": "http://example.org/different.htm",
                  "text": "Filosofía moderna"}]
        proposal = propose_title_repair(row, links)
        self.assertEqual(proposal["status"], "unverified_link")

    def test_dissimilar_or_damaged_link_text_is_never_strong(self):
        row = {
            "id": "article:3", "issueNumber": 1,
            "title": "Filosof\ufffda moderna",
            "urls": {"canonical": "http://example.org/one.htm"},
        }
        wrong = propose_title_repair(
            row, [{"url": "http://example.org/one.htm",
                   "text": "Nombre de la autora"}]
        )
        self.assertEqual(wrong["status"], "requires_title_review")
        damaged = propose_title_repair(
            row, [{"url": "http://example.org/one.htm",
                   "text": "Filosof\ufffda moderna"}]
        )
        self.assertEqual(damaged["status"], "damaged_index_title")

    def test_unavailable_issue_is_review_not_silent_success(self):
        row = {
            "id": "x", "issueNumber": 1, "journal": "Sincronía",
            "title": "Periodizaci\ufffdn",
            "urls": {"canonical": "http://example.org/x.htm"},
        }
        proposals = generate_proposals([row], {1: None})
        self.assertEqual(proposals[0]["status"], "archive_unavailable")


if __name__ == "__main__":
    unittest.main()
