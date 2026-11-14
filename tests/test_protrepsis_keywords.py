import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "cucsh"))

from harvest import (
    apply_curated_protrepsis_editorial_keywords,
    keywords_from_article_html,
    load_protrepsis_editorial_keywords,
    split_keyword_values,
)


class ProtrepsisKeywordParserTest(unittest.TestCase):
    def test_meta_keywords_are_split_and_deduplicated(self):
        html = """
        <html><head>
          <meta name="DC.Subject" content="Estudiantes indígenas; violencia cultural; discriminación racial">
          <meta name="citation_keywords" content="epistemología crítica, educación intercultural, justicia epistémica">
        </head></html>
        """
        self.assertEqual(
            keywords_from_article_html(html),
            [
                "Estudiantes indígenas",
                "violencia cultural",
                "discriminación racial",
                "epistemología crítica",
                "educación intercultural",
                "justicia epistémica",
            ],
        )

    def test_visible_ojs_keyword_block_is_supported(self):
        html = """
        <section class="item keywords">
          <h2 class="label">Palabras clave:</h2>
          <span class="value">
            Estudiantes indígenas, violencia cultural, discriminación racial,
            epistemología crítica, educación intercultural, justicia epistémica
          </span>
        </section>
        """
        self.assertEqual(
            keywords_from_article_html(html),
            [
                "Estudiantes indígenas",
                "violencia cultural",
                "discriminación racial",
                "epistemología crítica",
                "educación intercultural",
                "justicia epistémica",
            ],
        )

    def test_curated_layer_is_doi_keyed_and_preserves_real_keywords(self):
        curated = load_protrepsis_editorial_keywords()
        self.assertGreaterEqual(len(curated), 10)
        self.assertEqual(
            curated["10.32870/prot.i29.477"]["keywords"],
            [
                "redes sociales",
                "transparencia",
                "desinformación",
                "Nayib Bukele",
                "influencia digital",
                "ciudadanía informada",
            ],
        )

        records = [{
            "journal": "Protrepsis",
            "doi": "10.32870/prot.i29.477",
            "subjects": ["generic subject"],
            "editorialKeywords": [],
            "editorialKeywordSource": None,
        }]
        self.assertEqual(
            apply_curated_protrepsis_editorial_keywords(records),
            1,
        )
        self.assertEqual(
            records[0]["editorialKeywordSource"],
            "verified-publication",
        )
        self.assertEqual(
            records[0]["editorialKeywords"],
            curated["10.32870/prot.i29.477"]["keywords"],
        )
        self.assertIn(
            "generic subject",
            records[0]["subjects"],
        )
        self.assertIn(
            "redes sociales",
            records[0]["subjects"],
        )

    def test_oai_subjects_are_not_implicitly_editorial_keywords(self):
        source = (
            ROOT / "scripts" / "cucsh" / "harvest.py"
        ).read_text(encoding="utf-8")
        self.assertNotIn(
            '"editorialKeywords":\n            subjects',
            source,
        )
        self.assertIn(
            '"editorialKeywords":\n            []',
            source,
        )

    def test_duplicate_and_empty_values_are_safe(self):
        self.assertEqual(
            split_keyword_values([
                "Ética; ética; Bioética",
                "Palabras clave: Bioética, justicia",
                "",
            ]),
            ["Ética", "Bioética", "justicia"],
        )


if __name__ == "__main__":
    unittest.main()
