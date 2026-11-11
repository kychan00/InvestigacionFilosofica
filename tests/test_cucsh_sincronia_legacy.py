#!/usr/bin/env python3

from __future__ import annotations

import unittest

from unittest.mock import patch

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
                5
            ],
            (
                "winter98.htm",
                1998,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                9
            ],
            (
                "winter99.htm",
                1999,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                13
            ],
            (
                "winter00.htm",
                2000,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                17
            ],
            (
                "winter01.htm",
                2000,
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

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                51
            ],
            (
                "summer09.htm",
                2009,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                53
            ],
            (
                "winter10.htm",
                2009,
            ),
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_FILENAMES[
                60
            ],
            (
                "fall11.htm",
                2011,
            ),
        )

        self.assertEqual(
            set(
                legacy.EARLY_ISSUE_FILENAMES
            ),
            set(
                range(
                    1,
                    61,
                )
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
            "spring1999.htm",
            variants,
        )

        self.assertIn(
            "Spring1999.html",
            variants,
        )

        self.assertIn(
            "csh.udg.mx",
            legacy.LEGACY_HOSTS,
        )


    def test_direct_issue_variants_stay_bounded(
        self,
    ):
        self.assertEqual(
            legacy.direct_issue_filename_variants(
                "winter98.htm"
            ),
            [
                "winter98.htm",
                "winter98.html",
                "invierno98.htm",
                "invierno98.html",
            ],
        )

        self.assertEqual(
            legacy.direct_issue_filename_variants(
                "fall05.htm"
            ),
            [
                "fall05.htm",
                "fall05.html",
                "otono05.htm",
                "otono05.html",
            ],
        )


    def test_early_issue_stems_keep_authoritative_numbers(
        self,
    ):
        self.assertEqual(
            legacy.EARLY_ISSUE_NUMBER_BY_STEM[
                "winter98"
            ],
            5,
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_NUMBER_BY_STEM[
                "spring99"
            ],
            10,
        )

        self.assertEqual(
            legacy.EARLY_ISSUE_NUMBER_BY_STEM[
                "fall00"
            ],
            16,
        )


    def test_targeted_direct_recovery_only_probes_requested_issues(
        self,
    ):
        def fake_issue(
            issue_number,
            filename,
            fallback_year,
        ):
            return {
                "url":
                    (
                        "https://sincronia.cucsh.udg.mx/"
                        + filename
                    ),
                "number":
                    issue_number,
                "year":
                    fallback_year,
                "title":
                    f"Sincronía Núm. {issue_number}",
                "links": [
                    {
                        "url":
                            (
                                "https://sincronia.cucsh.udg.mx/"
                                f"article-{issue_number}.htm"
                            ),
                        "text":
                            f"Artículo {issue_number}",
                    },
                ],
                "usedWayback":
                    False,
            }

        def fake_record(
            article_link,
            issue,
            prefer_wayback=False,
        ):
            return {
                "id":
                    f"record:{issue['number']}",
                "title":
                    article_link["text"],
                "issueNumber":
                    issue["number"],
                "urls": {
                    "canonical":
                        article_link["url"],
                },
            }

        with (
            patch.object(
                legacy,
                "fetch_direct_early_issue",
                side_effect=fake_issue,
            ) as fetch_issue,
            patch.object(
                legacy,
                "build_legacy_record",
                side_effect=fake_record,
            ),
        ):
            records, issues = (
                legacy.harvest_direct_early_issues(
                    max_issue=60,
                    target_issues={
                        22,
                        41,
                    },
                )
            )

        self.assertEqual(
            issues,
            [
                22,
                41,
            ],
        )

        self.assertEqual(
            {
                row["issueNumber"]
                for row in records
            },
            {
                22,
                41,
            },
        )

        self.assertEqual(
            {
                call.args[0]
                for call in fetch_issue.call_args_list
            },
            {
                22,
                41,
            },
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


    def test_pipeline_targets_dialnet_only_for_unresolved_issues(
        self,
    ):
        def fake_record(issue_number):
            return {
                "id":
                    f"record:{issue_number}",
                "title":
                    f"Artículo {issue_number}",
                "issueNumber":
                    issue_number,
                "urls": {
                    "canonical":
                        (
                            "https://example.test/"
                            f"{issue_number}"
                        ),
                },
            }

        direct_issues = [
            issue_number
            for issue_number in range(
                1,
                19,
            )
            if issue_number != 17
        ]

        direct_records = [
            fake_record(
                issue_number
            )
            for issue_number in
            direct_issues
        ]

        with (
            patch.object(
                legacy,
                "harvest_direct_early_issues",
                return_value=(
                    direct_records,
                    direct_issues,
                ),
            ),
            patch.object(
                legacy,
                "harvest_dialnet_records",
                return_value=(
                    [
                        fake_record(17)
                    ],
                    [
                        17
                    ],
                ),
            ) as dialnet_harvest,
            patch.object(
                legacy,
                "harvest_archive_index_records",
                return_value=[],
            ),
        ):
            records = (
                legacy.harvest_legacy_records(
                    archive_urls=[],
                    max_issue=18,
                )
            )

        self.assertEqual(
            {
                row["issueNumber"]
                for row in records
            },
            set(
                range(
                    1,
                    19,
                )
            ),
        )

        dialnet_harvest.assert_called_once()

        self.assertEqual(
            dialnet_harvest.call_args.kwargs[
                "target_issues"
            ],
            {
                17
            },
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
