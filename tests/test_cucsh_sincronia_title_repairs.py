import unittest

from scripts.cucsh.apply_sincronia_title_repairs import (
    apply_verified_title_proposals, EVIDENCE_RUN
)


def sample():
    original = {
        "id": "old:1", "journal": "Sincronía", "issueNumber": 1,
        "title": "Filosof\ufffda del lenguaje", "titleVariants": ["Filosof\ufffda del lenguaje"],
        "legacyOriginal": True, "authors": [{"name": "Known"}],
        "urls": {"canonical": "http://example.org/sincronia/art.htm"},
    }
    snapshot = {"records": [original, {
        "id": "other", "journal": "Protrepsis", "title": "Otra revista",
    }]}
    evidence = {"proposals": [
        {
            "status": "strong_index_match", "id": "old:1",
            "issue": 1, "titleBefore": "Filosof\ufffda del lenguaje",
            "proposedTitle": "Filosofía del lenguaje",
            "sourceUrl": "http://example.org/sincronia/art.htm",
            "sourceIndexLinkUrl": "https://example.org/sincronia/ART.htm",
            "similarity": 0.95,
        },
        {"status": "archive_unavailable", "id": "ignored"},
    ]}
    return snapshot, evidence


class RepairTests(unittest.TestCase):
    def test_corrects_only_verified_title_and_preserves_authors(self):
        src, evidence = sample()
        out, report = apply_verified_title_proposals(src, evidence, expected_count=1)
        self.assertEqual(out["records"][0]["title"], "Filosofía del lenguaje")
        self.assertEqual(out["records"][0]["titleVariants"], ["Filosofía del lenguaje"])
        self.assertEqual(out["records"][0]["authors"], src["records"][0]["authors"])
        self.assertEqual(out["records"][1], src["records"][1])
        self.assertEqual(report["changed"], 1)
        self.assertEqual(
            out["records"][0]["legacyTitleEncodingEvidence"]["auditRunId"],
            EVIDENCE_RUN,
        )

    def test_idempotency(self):
        src, evidence = sample()
        out, _ = apply_verified_title_proposals(src, evidence, expected_count=1)
        again, report = apply_verified_title_proposals(out, evidence, expected_count=1)
        self.assertEqual(again, out)
        self.assertEqual(report["changed"], 0)

    def test_refuses_different_url_or_missing_issue(self):
        src, evidence = sample()
        src["records"][0]["issueNumber"] = 2
        with self.assertRaisesRegex(ValueError, "validation failed"):
            apply_verified_title_proposals(src, evidence, expected_count=1)

    def test_refuses_weak_source_evidence(self):
        src, evidence = sample()
        evidence["proposals"][0]["similarity"] = 0.70
        with self.assertRaisesRegex(ValueError, "validation failed"):
            apply_verified_title_proposals(src, evidence, expected_count=1)


if __name__ == "__main__":
    unittest.main()
