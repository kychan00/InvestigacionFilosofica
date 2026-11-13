#!/usr/bin/env python3

from __future__ import annotations

import unittest

from scripts.cucsh import (
    sincronia_redalyc as redalyc,
)


class SincroniaRedalycTest(
    unittest.TestCase,
):
    def test_collection_ids_match_preserved_issue_block(
        self,
    ):
        self.assertEqual(
            redalyc.collection_id(37),
            77270,
        )
        self.assertEqual(
            redalyc.collection_id(41),
            77274,
        )

    def test_issue_page_extracts_only_matching_article_ids(
        self,
    ):
        data = b"""
        <html>
          <body>
            <a href="/articulo.oa?id=513877274001">
              Uno
            </a>
            <a href="/articulo.oa?id=513877274002">
              Dos
            </a>
            <a href="/articulo.oa?id=513877273001">
              Otro numero
            </a>
          </body>
        </html>
        """

        self.assertEqual(
            redalyc.article_ids_from_issue_page(
                data,
                redalyc.issue_url(41),
                41,
            ),
            [
                "513877274001",
                "513877274002",
            ],
        )

    def test_article_metadata_builds_historical_record(
        self,
    ):
        data = """
        <html>
          <head>
            <meta
              name="citation_title"
              content="Sociología de la vida cotidiana"
            />
            <meta
              name="citation_author"
              content="Samuel F. Velarde"
            />
            <meta
              name="citation_publication_date"
              content="2006"
            />
            <meta
              name="citation_issue"
              content="41"
            />
            <meta
              name="description"
              content="Este artículo presenta una reflexión suficientemente extensa sobre la sociología de la vida cotidiana y sus principales problemas conceptuales."
            />
          </head>
          <body>
            Sincronía, núm. 41, diciembre-marzo, 2006
          </body>
        </html>
        """.encode(
            "utf-8"
        )

        record = (
            redalyc.parse_article_record(
                "513877274008",
                data,
                41,
            )
        )

        self.assertIsNotNone(
            record
        )
        self.assertEqual(
            record["title"],
            "Sociología de la vida cotidiana",
        )
        self.assertEqual(
            record["authors"][0]["name"],
            "Samuel F. Velarde",
        )
        self.assertEqual(
            record["year"],
            2006,
        )
        self.assertEqual(
            record["issueNumber"],
            41,
        )
        self.assertEqual(
            record["legacyMetadataSource"],
            "Redalyc",
        )
        self.assertEqual(
            record["urls"]["canonical"],
            (
                "https://www.redalyc.org/"
                "articulo.oa?id=513877274008"
            ),
        )

    def test_wrong_issue_metadata_is_rejected(
        self,
    ):
        data = """
        <html>
          <head>
            <meta
              name="citation_title"
              content="Artículo ajeno"
            />
            <meta
              name="citation_issue"
              content="40"
            />
          </head>
        </html>
        """.encode(
            "utf-8"
        )

        self.assertIsNone(
            redalyc.parse_article_record(
                "513877274001",
                data,
                41,
            )
        )


if __name__ == "__main__":
    unittest.main()
