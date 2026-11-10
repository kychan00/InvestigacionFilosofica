#!/usr/bin/env python3

from __future__ import annotations

import unittest

from scripts.cucsh import (
    sincronia_legacy as legacy,
)


class SincroniaLegacyTest(
    unittest.TestCase,
):
    def test_issue_number_from_archive_text(
        self,
    ):
        self.assertEqual(
            legacy.infer_issue_number(
                "Número 51",
                (
                    "https://sincronia.cucsh.udg.mx/"
                    "summer09.htm"
                ),
            ),
            51,
        )

    def test_year_from_legacy_issue_page(
        self,
    ):
        parser = legacy.parse_html(
            b"""
            <html>
              <head>
                <title>Sincronia numero 51</title>
              </head>
              <body>
                <h1>
                  Sincronia - Verano 2009
                </h1>
              </body>
            </html>
            """
        )

        self.assertEqual(
            legacy.infer_year(
                parser,
                (
                    "https://sincronia.cucsh.udg.mx/"
                    "summer09.htm"
                ),
            ),
            2009,
        )

    def test_old_article_metadata_is_recovered(
        self,
    ):
        parser = legacy.parse_html(
            """
            <html>
              <body>
                <h1>
                  La cultura impresa centroamericana
                </h1>
                <p>Iván Molina Jiménez</p>
                <p>Resumen</p>
                <p>
                  Este artículo analiza los cambios
                  de la cultura impresa en
                  Centroamérica durante el siglo XIX
                  y sus procesos de secularización,
                  circulación y diversificación.
                </p>
                <p>
                  Palabras clave: cultura impresa,
                  secularización, libros
                </p>
              </body>
            </html>
            """.encode(
                "utf-8"
            )
        )

        title = legacy.choose_title(
            (
                "La cultura impresa "
                "centroamericana"
            ),
            parser,
        )

        authors = legacy.extract_authors(
            parser,
            title,
        )

        self.assertEqual(
            authors[0]["name"],
            "Iván Molina Jiménez",
        )

        self.assertTrue(
            legacy.extract_abstract(
                parser
            )
        )

        self.assertIn(
            "cultura impresa",
            legacy.extract_subjects(
                parser
            ),
        )

    def test_early_issue_filename_map_covers_missing_dialnet_years(
        self,
    ):
        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                1
            ],
            (
                "winter97.htm",
                1996,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                18
            ],
            (
                "spring01.htm",
                2001,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                21
            ],
            (
                "winter02.htm",
                2001,
            ),
        )

    def test_early_filename_variants_cover_historical_url_shapes(
        self,
    ):
        variants = (
            legacy.early_issue_filename_variants(
                "spring99.htm"
            )
        )

        self.assertIn(
            "spring99.htm",
            variants,
        )

        self.assertIn(
            "spring99.html",
            variants,
        )

        self.assertIn(
            "Spring99.htm",
            variants,
        )

        self.assertIn(
            "Spring99.html",
            variants,
        )

        self.assertIn(
            "csh.udg.mx",
            legacy.LEGACY_HOSTS,
        )


    def test_historical_merge_deduplicates_same_issue_and_title(
        self,
    ):
        direct = {
            "id":
                "legacy-a",

            "title":
                "Un artículo histórico",

            "issueNumber":
                18,

            "urls": {
                "canonical":
                    (
                        "http://sincronia.cucsh.udg.mx/"
                        "historico.htm"
                    ),
            },
        }

        dialnet = {
            "id":
                "dialnet-b",

            "title":
                "Un artículo histórico",

            "issueNumber":
                18,

            "urls": {
                "canonical":
                    (
                        "https://dialnet.unirioja.es/"
                        "servlet/articulo?codigo=1"
                    ),
            },
        }

        merged = (
            legacy.merge_historical_records(
                [direct],
                [dialnet],
            )
        )

        self.assertEqual(
            len(merged),
            1,
        )


    def test_navigation_is_not_an_article(
        self,
    ):
        self.assertFalse(
            legacy.plausible_article_link(
                {
                    "url":
                        (
                            "https://sincronia.cucsh.udg.mx/"
                            "index.htm"
                        ),
                    "text":
                        "Inicio",
                },
                set(),
            )
        )


if __name__ == "__main__":
    unittest.main()
