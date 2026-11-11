import unittest

from scripts.cucsh.enrich_sincronia_remaining import (
    apply_evidence, derive_proposals, eligible_original_records,
    human_name, similarity,
)


def paper(title="El pensamiento crítico", authors=None):
    return {
        "id": "original:1", "journal": "Sincronía",
        "issueNumber": 3, "title": title,
        "titleVariants": [title], "authors": authors or [],
        "legacyOriginal": True,
        "urls": {"canonical": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/article.htm"},
    }


class RemainingMetadataTests(unittest.TestCase):
    def test_live_latin1_title_and_author_byline(self):
        row = paper("La filosof\ufffda moderna")
        html = (
            "<html><head><meta charset='ISO-8859-1'></head><body>"
            "<h1>La filosofía moderna</h1>"
            "<p>José María Areta</p>"
            "<p>Universidad de Guadalajara</p>"
            "<p>Resumen</p><p>Este texto estudia algo relevante.</p>"
            "</body></html>"
        ).encode("cp1252")
        result = derive_proposals(row, html)
        self.assertEqual(result["status"], "verified_corrections")
        self.assertEqual(result["corrections"]["title"]["value"], "La filosofía moderna")
        self.assertEqual(result["corrections"]["author"]["value"], "José María Areta")
        after, changed = apply_evidence({"records": [row]}, [result])
        self.assertEqual(len(after["records"]), 1)
        self.assertEqual(after["records"][0]["authors"][0]["name"], "José María Areta")
        self.assertEqual(after["records"][0]["titleVariants"], ["La filosofía moderna"])
        self.assertEqual(len(changed), 1)

    def test_explicit_author_tag(self):
        row = paper()
        html = (
            "<html><head><meta name='citation_author' content='Helen Galkina'/>"
            "<meta name='citation_title' content='El pensamiento crítico'/></head>"
            "<body></body></html>"
        ).encode("utf-8")
        result = derive_proposals(row, html)
        self.assertEqual(result["corrections"]["author"]["value"], "Helen Galkina")
        self.assertEqual(
            result["corrections"]["author"]["evidence"],
            "original-article-author-meta",
        )

    def test_navigation_and_university_are_not_people(self):
        self.assertIsNone(human_name("Stanford University"))
        self.assertIsNone(human_name("Regresar a ana"))
        self.assertIsNone(human_name("National University of Singapore"))
        row = paper()
        html = (
            "<html><body><h1>El pensamiento crítico</h1>"
            "<p>Stanford University</p><p>Resumen</p></body></html>"
        ).encode("utf-8")
        result = derive_proposals(row, html)
        self.assertNotIn("author", result["corrections"])

    def test_mismatched_page_never_edits_source(self):
        row = paper("La filosof\ufffda moderna")
        html = (
            "<html><head><meta name='citation_author' content='Helen Galkina'/>"
            "</head><body><h1>Otra obra filosófica</h1></body></html>"
        ).encode("utf-8")
        result = derive_proposals(row, html)
        self.assertNotIn("author", result["corrections"])
        self.assertNotIn("title", result["corrections"])

    def test_author_is_never_overwritten(self):
        row = paper(authors=[{"name": "Known Author"}])
        evidence = {
            "id": row["id"], "issue": row["issueNumber"],
            "url": row["urls"]["canonical"], "status": "verified_corrections",
            "corrections": {"author": {
                "value": "Another Author", "evidence": "original-article-author-meta"
            }},
        }
        with self.assertRaisesRegex(ValueError, "overwrite"):
            apply_evidence({"records": [row]}, [evidence])

    def test_existing_other_journals_untouched_and_sources_limited(self):
        row = paper()
        external = {**paper(), "id": "external", "urls": {
            "canonical": "https://untrusted.example.org/page.htm"}}
        other = {"id": "protrepsis", "journal": "Protrepsis", "title": "Unchanged"}
        assert eligible_original_records([row, external, other]) == [row]
        updated, changed = apply_evidence({"records": [row, other]}, [])
        self.assertEqual(changed, [])
        self.assertEqual(updated["records"], [row, other])

    def test_similarity_is_strict(self):
        self.assertGreater(similarity("Filosof\ufffda social", "Filosofía social"), 0.89)
        self.assertLess(similarity("Enseñanza del arte", "Biología molecular"), 0.50)


if __name__ == "__main__":
    unittest.main()
