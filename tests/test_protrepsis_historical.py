#!/usr/bin/env python3

from __future__ import annotations

import sys
import unittest

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CUCSH = ROOT / "scripts" / "cucsh"

sys.path.insert(0, str(CUCSH))

import harvest
import protrepsis_historical


class ProtrepsisHistoricalTest(unittest.TestCase):
    def test_issue_from_single_doi(self):
        issue = (
            protrepsis_historical
            .historical_issue_from_doi(
                "https://doi.org/10.32870/PROT.I3.42."
            )
        )

        self.assertEqual(
            issue["numbers"],
            [3],
        )
        self.assertEqual(
            issue["label"],
            "3",
        )

    def test_issue_from_double_doi(self):
        issue = (
            protrepsis_historical
            .historical_issue_from_doi(
                "10.32870/prot.i9-10.127"
            )
        )

        self.assertEqual(
            issue["numbers"],
            [9, 10],
        )
        self.assertEqual(
            issue["label"],
            "9-10",
        )

    def test_issue_15_is_not_historical(self):
        self.assertIsNone(
            protrepsis_historical
            .historical_issue_from_doi(
                "10.32870/prot.i15.201"
            )
        )

    def test_temperie_ids_are_excluded_by_policy(self):
        self.assertIn(
            24,
            protrepsis_historical.TEMPERIE_ARTICLE_IDS["2"],
        )
        self.assertIn(
            61,
            protrepsis_historical.TEMPERIE_ARTICLE_IDS["4"],
        )
        self.assertIn(
            179,
            protrepsis_historical.TEMPERIE_ARTICLE_IDS["14"],
        )
        self.assertNotIn(
            42,
            protrepsis_historical.TEMPERIE_ARTICLE_IDS.get("3", set()),
        )

    def test_abstract_reconstruction(self):
        abstract = (
            protrepsis_historical
            .abstract_from_inverted_index({
                "La": [0],
                "filosofía": [1],
                "vive": [2],
            })
        )

        self.assertEqual(
            abstract,
            "La filosofía vive",
        )

    def test_merge_deduplicates_by_doi_and_enriches_issue(self):
        current = [{
            "id": "oai:42",
            "journal": "Protrepsis",
            "title": "Reseña",
            "year": 2012,
            "doi": "10.32870/prot.i3.42",
            "bibliographicSources": [],
            "urls": {
                "canonical": (
                    "https://protrepsis.cucsh.udg.mx/"
                    "index.php/prot/article/view/42"
                ),
                "doi": (
                    "https://doi.org/"
                    "10.32870/prot.i3.42"
                ),
                "relations": [],
            },
        }]

        historical = [{
            "id": "historical:42",
            "journal": "Protrepsis",
            "title": "Reseña",
            "year": 2012,
            "doi": "10.32870/prot.i3.42",
            "issue": "3",
            "issueLabel": "3",
            "issueNumbers": [3],
            "issueNumber": 3,
            "bibliographicSources": [
                "Protrepsis, Núm. 3",
            ],
            "urls": {
                "canonical": (
                    "https://doi.org/"
                    "10.32870/prot.i3.42"
                ),
                "doi": (
                    "https://doi.org/"
                    "10.32870/prot.i3.42"
                ),
                "relations": [],
            },
        }]

        merged, added, enriched = (
            harvest.merge_historical_protrepsis(
                current,
                historical,
            )
        )

        self.assertEqual(
            len(merged),
            1,
        )
        self.assertEqual(
            added,
            0,
        )
        self.assertEqual(
            enriched,
            1,
        )
        self.assertEqual(
            merged[0]["issueNumber"],
            3,
        )
        self.assertIn(
            "Protrepsis, Núm. 3",
            merged[0][
                "bibliographicSources"
            ],
        )


if __name__ == "__main__":
    unittest.main()
