#!/usr/bin/env python3

from __future__ import annotations

import unittest

from unittest.mock import patch

from scripts.cucsh import (
    sincronia_dialnet as dialnet,
)


class SincroniaDialnetTest(
    unittest.TestCase,
):
    def test_journal_page_discovers_issues(
        self,
    ):
        data = b"""
        <html><body>
          <a href="/ejemplar/547854">17</a>
          <a href="/ejemplar/251077">50</a>
          <a href="/servlet/revista?codigo=2487">
            Sincronia
          </a>
        </body></html>
        """

        self.assertEqual(
            dialnet.journal_issue_urls(
                data
            ),
            [
                (
                    "https://dialnet.unirioja.es/"
                    "ejemplar/547854"
                ),
                (
                    "https://dialnet.unirioja.es/"
                    "ejemplar/251077"
                ),
            ],
        )

        self.assertEqual(
            dialnet.journal_issue_urls(
                data,
                max_issue=20,
            ),
            [
                (
                    "https://dialnet.unirioja.es/"
                    "ejemplar/547854"
                ),
            ],
        )

    def test_targeted_issue_discovery_filters_known_numbers(
        self,
    ):
        data = b"""
        <html><body>
          <a href="/ejemplar/547854">17</a>
          <a href="/ejemplar/547094">19</a>
          <a href="/ejemplar/251120">51</a>
        </body></html>
        """

        self.assertEqual(
            dialnet.journal_issue_urls(
                data,
                max_issue=51,
                target_issues={
                    19,
                    51,
                },
            ),
            [
                (
                    "https://dialnet.unirioja.es/"
                    "ejemplar/547094"
                ),
                (
                    "https://dialnet.unirioja.es/"
                    "ejemplar/251120"
                ),
            ],
        )

    def test_known_issue_map_covers_catalogued_legacy_range(
        self,
    ):
        self.assertEqual(
            dialnet.KNOWN_ISSUE_URLS[17],
            (
                "https://dialnet.unirioja.es/"
                "ejemplar/547854"
            ),
        )
        self.assertNotIn(
            18,
            dialnet.KNOWN_ISSUE_URLS,
        )
        self.assertEqual(
            dialnet.KNOWN_ISSUE_URLS[33],
            (
                "https://dialnet.unirioja.es/"
                "ejemplar/119796"
            ),
        )
        self.assertEqual(
            dialnet.KNOWN_ISSUE_URLS[51],
            (
                "https://dialnet.unirioja.es/"
                "ejemplar/251120"
            ),
        )


    def test_issue_identity(
        self,
    ):
        data = (
            """
            <html><body>
              <h3>
                Año 2009, Número 50
                (Spring 2009)
              </h3>
            </body></html>
            """
        ).encode("utf-8")

        self.assertEqual(
            dialnet.issue_identity(
                data
            ),
            {
                "year":
                    2009,

                "number":
                    50,
            },
        )

    def test_issue_parser_keeps_all_articles_and_authors(
        self,
    ):
        data = (
            """
            <html><body>
              <h3>
                Año 2001, Número 19
              </h3>

              <a href="/servlet/articulo?codigo=100">
                Articulo de filosofia
              </a>
              <a href="/servlet/autor?codigo=1">
                Autora Uno
              </a>

              <a href="/servlet/articulo?codigo=101">
                Articulo de letras
              </a>
              <a href="/servlet/autor?codigo=2">
                Autor Dos
              </a>
              <a href="/servlet/autor?codigo=3">
                Autora Tres
              </a>

              <a href="/servlet/articulo?codigo=101&info=resumen">
                Resumen
              </a>
            </body></html>
            """
        ).encode("utf-8")

        articles = (
            dialnet.issue_articles(
                data,
                (
                    "https://dialnet.unirioja.es/"
                    "ejemplar/123"
                ),
            )
        )

        self.assertEqual(
            [item["code"] for item in articles],
            [
                "100",
                "101",
            ],
        )

        self.assertEqual(
            articles[0]["authors"],
            [
                "Autora Uno"
            ],
        )

        self.assertEqual(
            articles[1]["authors"],
            [
                "Autor Dos",
                "Autora Tres",
            ],
        )

    def test_issue_parser_accepts_parameterized_links(
        self,
    ):
        data = (
            """
            <html><body>
              <h3>
                Año 2011, Nº. 60
              </h3>

              <a href="/servlet/articulo?info=resumen&codigo=3803596">
                Obama, Calderón and the Mérida Initiative
              </a>
              <a href="/servlet/autor?foo=1&codigo=2630508">
                Peter Watt
              </a>
            </body></html>
            """
        ).encode("utf-8")

        self.assertEqual(
            dialnet.issue_identity(
                data
            ),
            {
                "year":
                    2011,

                "number":
                    60,
            },
        )

        articles = dialnet.issue_articles(
            data,
            (
                "https://dialnet.unirioja.es/"
                "ejemplar/293399"
            ),
        )

        self.assertEqual(
            len(articles),
            1,
        )

        self.assertEqual(
            articles[0]["code"],
            "3803596",
        )

        self.assertEqual(
            articles[0]["authors"],
            [
                "Peter Watt"
            ],
        )


    def test_failed_target_gets_one_cooldown_retry(
        self,
    ):
        failure = {
            "error":
                "fetch:503",
            "url":
                dialnet.KNOWN_ISSUE_URLS[51],
        }
        success = (
            {
                "year": 2009,
                "number": 51,
            },
            [
                {
                    "code": "999",
                    "url":
                        "https://dialnet.unirioja.es/servlet/articulo?codigo=999",
                    "title":
                        "Artículo recuperado",
                    "authors": [],
                },
            ],
        )

        with (
            patch.object(
                dialnet,
                "fetch_issue_payload",
                side_effect=[
                    failure,
                    success,
                ],
            ) as fetch_payload,
            patch.object(
                dialnet.time,
                "sleep",
            ),
        ):
            records, issues = (
                dialnet.harvest_dialnet_records(
                    max_issue=51,
                    target_issues={51},
                )
            )

        self.assertEqual(
            fetch_payload.call_count,
            2,
        )
        self.assertEqual(
            issues,
            [51],
        )
        self.assertEqual(
            len(records),
            1,
        )


    def test_verified_issue_49_fallback_covers_all_articles(
        self,
    ):
        payload = dialnet.verified_issue_payload(49)
        self.assertIsNotNone(payload)
        issue, articles = payload
        self.assertEqual(issue["number"], 49)
        self.assertEqual(issue["year"], 2008)
        self.assertEqual(len(articles), 21)
        self.assertEqual(len({article["code"] for article in articles}), 21)
        self.assertEqual(articles[0]["code"], "3296390")
        self.assertEqual(articles[-1]["code"], "3296628")
        self.assertTrue(all(article["title"] and article["authors"] for article in articles))
        records = [dialnet.build_record(article, issue) for article in articles]
        self.assertTrue(all(row["issueNumber"] == 49 for row in records))
        self.assertTrue(all(row["legacyMetadataSource"] == "Dialnet" for row in records))
        self.assertEqual(len({row["id"] for row in records}), 21)


    def test_verified_issue_51_fallback_builds_valid_records(
        self,
    ):
        payload = dialnet.verified_issue_payload(
            51
        )

        self.assertIsNotNone(
            payload
        )

        issue, articles = payload

        self.assertEqual(
            issue["number"],
            51,
        )
        self.assertEqual(
            issue["year"],
            2009,
        )
        self.assertEqual(
            len(articles),
            9,
        )

        record = dialnet.build_record(
            articles[0],
            issue,
        )

        self.assertEqual(
            record["issueNumber"],
            51,
        )
        self.assertEqual(
            record["authors"][0]["name"],
            "Maximiliano Emanuel Korstanje",
        )
        self.assertEqual(
            record["sourceId"],
            "dialnet:3297190",
        )


    def test_record_preserves_historical_provenance(
        self,
    ):
        record = dialnet.build_record(
            {
                "code":
                    "3296664",

                "url":
                    (
                        "https://dialnet.unirioja.es/"
                        "servlet/articulo?"
                        "codigo=3296664"
                    ),

                "title":
                    "Estado, poder y discurso politico",

                "authors":
                    [
                        "Alberto Javier Mayorga Rojel"
                    ],
            },
            {
                "year":
                    2009,

                "number":
                    50,
            },
        )

        self.assertEqual(
            record["journal"],
            "Sincronía",
        )

        self.assertEqual(
            record["issueNumber"],
            50,
        )

        self.assertTrue(
            record["legacyOriginal"]
        )

        self.assertEqual(
            record["legacyMetadataSource"],
            "Dialnet",
        )


if __name__ == "__main__":
    unittest.main()
