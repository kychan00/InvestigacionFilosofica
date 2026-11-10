#!/usr/bin/env python3

from __future__ import annotations

import importlib.util
import unittest

from pathlib import Path


ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

HARVEST_PATH = (
    ROOT
    / "scripts"
    / "cucsh"
    / "harvest.py"
)

SPEC = (
    importlib.util
    .spec_from_file_location(
        "cucsh_harvest",
        HARVEST_PATH,
    )
)

MODULE = (
    importlib.util
    .module_from_spec(
        SPEC
    )
)

SPEC.loader.exec_module(
    MODULE
)


class SincroniaParserTest(
    unittest.TestCase,
):
    def test_archive_parser_collects_issue_urls(
        self,
    ):
        parser = MODULE.IssueArchiveParser(
            (
                "https://revistasincronia.cucsh.udg.mx/"
                "index.php/sincronia/issue/archive"
            )
        )

        parser.feed(
            """
            <a href="/index.php/sincronia/issue/view/44">
              Vol. 30 Núm. 90
            </a>
            <a href="/index.php/sincronia/issue/view/44">
              repetido
            </a>
            <a href="/index.php/sincronia/article/view/999">
              artículo
            </a>
            """
        )

        self.assertEqual(
            parser.issue_urls,
            [
                (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/issue/view/44"
                )
            ],
        )

    def test_issue_parser_keeps_only_philosophy(
        self,
    ):
        parser = MODULE.IssueSectionParser(
            (
                "https://revistasincronia.cucsh.udg.mx/"
                "index.php/sincronia/issue/view/15"
            ),
            "FILOSOFÍA",
        )

        parser.feed(
            """
            <h1>
              Vol. 27 Núm. 63 (2013): Enero-Junio
            </h1>

            <h2>FILOSOFÍA</h2>
            <article>
              <a href="/index.php/sincronia/article/view/701">
                Filosofía y pensamiento crítico
              </a>
            </article>

            <h2>LETRAS</h2>
            <article>
              <a href="/index.php/sincronia/article/view/702">
                Un artículo literario
              </a>
            </article>
            """
        )

        self.assertEqual(
            parser.issue_year,
            2013,
        )

        self.assertEqual(
            parser.article_ids,
            {"701"},
        )

    def test_section_normalization_is_accent_insensitive(
        self,
    ):
        self.assertEqual(
            MODULE.normalize_section_label(
                " FILOSOFÍA "
            ),
            "filosofia",
        )

        self.assertEqual(
            MODULE.article_id_from_url(
                (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/article/view/1234"
                )
            ),
            "1234",
        )


if __name__ == "__main__":
    unittest.main()
