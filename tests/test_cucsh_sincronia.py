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


class SincroniaIssueMetadataTest(
    unittest.TestCase,
):
    def test_archive_discovers_issue_urls(
        self,
    ):
        parser = (
            MODULE.SincroniaArchiveParser(
                (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/issue/archive"
                )
            )
        )

        parser.feed(
            """
            <a href="/index.php/sincronia/issue/view/90">
              Vol. 30 Núm. 90
            </a>
            <a href="/index.php/sincronia/issue/view/89">
              Vol. 30 Núm. 89
            </a>
            <a href="/index.php/sincronia/issue/view/90">
              duplicado
            </a>
            """
        )

        self.assertEqual(
            len(parser.issue_urls),
            2,
        )

    def test_issue_keeps_every_editorial_section(
        self,
    ):
        parser = (
            MODULE.SincroniaIssueParser(
                (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/issue/view/90"
                )
            )
        )

        parser.feed(
            """
            <h1>
              Vol. 30 Núm. 90 (2026):
              Julio-Diciembre 2026
            </h1>

            <h2>FILOSOFÍA</h2>
            <a href="/index.php/sincronia/article/view/1001">
              Artículo filosófico
            </a>

            <h2>LETRAS</h2>
            <a href="/index.php/sincronia/article/view/1002">
              Artículo literario
            </a>

            <h2>MISCELÁNEA</h2>
            <a href="/index.php/sincronia/article/view/1003">
              Artículo misceláneo
            </a>
            """
        )

        self.assertEqual(
            set(parser.articles),
            {
                "1001",
                "1002",
                "1003",
            },
        )

        self.assertEqual(
            parser.issue_year,
            2026,
        )

        self.assertEqual(
            parser.issue_number,
            90,
        )

        self.assertEqual(
            parser.articles[
                "1001"
            ]["section"],
            "FILOSOFÍA",
        )

        self.assertEqual(
            parser.articles[
                "1002"
            ]["section"],
            "LETRAS",
        )

        self.assertEqual(
            parser.articles[
                "1003"
            ]["section"],
            "MISCELÁNEA",
        )

    def test_sincronia_does_not_apply_other_journal_topic_filters(
        self,
    ):
        xml = (
            """
            <record
              xmlns="http://www.openarchives.org/OAI/2.0/"
            >
              <header>
                <identifier>
                  oai:sincronia:999
                </identifier>
                <datestamp>
                  2026-01-01
                </datestamp>
              </header>
              <metadata>
                <dc
                  xmlns="http://www.openarchives.org/OAI/2.0/oai_dc/"
                  xmlns:dct="http://purl.org/dc/elements/1.1/"
                >
                  <dct:title>
                    Literatura y memoria cultural
                  </dct:title>
                  <dct:creator>
                    María Ejemplo
                  </dct:creator>
                  <dct:date>
                    2020
                  </dct:date>
                  <dct:description>
                    Temperie sección literaria no arbitrada.
                    Este texto conserva contenido suficiente
                    para representar un artículo de letras
                    dentro de la revista Sincronía.
                  </dct:description>
                  <dct:identifier>
                    https://revistasincronia.cucsh.udg.mx/
                    index.php/sincronia/article/view/999
                  </dct:identifier>
                </dc>
              </metadata>
            </record>
            """
        )

        import xml.etree.ElementTree as ET

        record = MODULE.parse_oai_record(
            ET.fromstring(
                xml
            ),
            {
                "id":
                    "sincronia",

                "journal":
                    "Sincronía",
            },
        )

        self.assertIsNotNone(
            record
        )

        self.assertFalse(
            record.get(
                "_excluded",
                False,
            )
        )

        self.assertEqual(
            record["journal"],
            "Sincronía",
        )


    def test_authorship_declarations_are_not_journal_articles(
        self,
    ):
        import xml.etree.ElementTree as ET

        for title, article_id in (
            ("DECLARACIÓN DE COAUTORÍA", "371"),
            ("DECLARACIÓN DE AUTORÍA INDIVIDUAL", "372"),
        ):
            document = (
                '<record xmlns="http://www.openarchives.org/OAI/2.0/">'
                '<header><identifier>oai:sincronia:' + article_id
                + '</identifier></header><metadata><dc '
                'xmlns="http://www.openarchives.org/OAI/2.0/oai_dc/" '
                'xmlns:dct="http://purl.org/dc/elements/1.1/">'
                '<dct:title>' + title + '</dct:title>'
                '<dct:identifier>'
                'https://revistasincronia.cucsh.udg.mx/'
                'index.php/sincronia/article/view/' + article_id
                + '</dct:identifier></dc></metadata></record>'
            )
            record = MODULE.parse_oai_record(
                ET.fromstring(document),
                {"id": "sincronia", "journal": "Sincronía"},
            )
            self.assertTrue(record["_excluded"])
            self.assertEqual(
                record["reason"],
                "sincronia-non-article-front-matter",
            )
            self.assertTrue(
                record["canonical"].endswith("/" + article_id)
            )

        self.assertIsNone(
            MODULE.SINCRONIA_NON_ARTICLE_TITLE_RE.fullmatch(
                "Reflexiones filosóficas sobre la coautoría"
            )
        )

    def test_legacy_range_stops_before_modern_ojs_archive(
        self,
    ):
        source = next(
            source
            for source in MODULE.SOURCES
            if source["id"] == "sincronia"
        )

        self.assertEqual(
            source["legacyMaxIssue"],
            60,
        )



    def test_indexed_ojs_articles_cannot_be_silently_omitted(
        self,
    ):
        metadata = {
            "1100": {"issueNumber": 90, "section": "FILOSOFÍA"},
            "1101": {"issueNumber": 90, "section": "LETRAS"},
            "1102": {"issueNumber": 90, "section": "EDITORIAL"},
        }
        rows = [{
            "urls": {
                "canonical": (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/article/view/1100"
                )
            },
        }]
        with self.assertRaisesRegex(
            RuntimeError,
            "2 indexed article\\(s\\) missing",
        ):
            MODULE.audit_sincronia_ojs_coverage(metadata, rows)

        # A front-matter exclusion must be specifically identified from OAI.
        with self.assertRaisesRegex(
            RuntimeError,
            "1 indexed article\\(s\\) missing",
        ):
            MODULE.audit_sincronia_ojs_coverage(
                metadata,
                rows,
                {"1102"},
            )

        rows.append({
            "urls": {
                "canonical": (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/article/view/1101"
                )
            },
        })
        MODULE.audit_sincronia_ojs_coverage(
            metadata,
            rows,
            {"1102"},
        )

    def test_article_id_is_stable(
        self,
    ):
        self.assertEqual(
            MODULE.article_id_from_url(
                (
                    "https://revistasincronia.cucsh.udg.mx/"
                    "index.php/sincronia/article/view/763"
                )
            ),
            "763",
        )


if __name__ == "__main__":
    unittest.main()
