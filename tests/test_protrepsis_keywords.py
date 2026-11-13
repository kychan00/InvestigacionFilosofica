import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "cucsh"))

from harvest import keywords_from_article_html, split_keyword_values


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
