#!/usr/bin/env python3

from __future__ import annotations

import unittest

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
