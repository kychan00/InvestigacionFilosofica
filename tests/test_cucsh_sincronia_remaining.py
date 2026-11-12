import unittest
from unittest.mock import patch

from scripts.cucsh.enrich_sincronia_remaining import (
    apply_evidence, curated_encoding_proposals, derive_proposals,
    dialnet_author_proposals, dialnet_damaged_legacy_proposals,
    eligible_original_records, human_name, similarity,
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

    def test_person_name_trims_stray_trailing_punctuation(self):
        self.assertEqual(
            human_name("Lilia Granillo Vázquez ,"),
            "Lilia Granillo Vázquez",
        )

    @patch(
        "scripts.cucsh.enrich_sincronia_remaining.harvest_dialnet_records"
    )
    def test_dialnet_single_author_requires_strict_issue_title_match(self, harvest):
        row = paper("La envidia como cultura: el caso mexicano")
        row["issueNumber"] = 17
        row["urls"]["canonical"] = (
            "http://sincronia.cucsh.udg.mx/granillo.htm"
        )
        harvest.return_value = ([
            {
                "issueNumber": 17,
                "title": "La envidia como cultura: el caso mexicano",
                "authors": [{"name": "Lilia Granillo Vázquez ,"}],
                "urls": {
                    "canonical": (
                        "https://dialnet.unirioja.es/servlet/articulo?codigo=1"
                    )
                },
            },
            {
                "issueNumber": 17,
                "title": "Otro artículo completamente distinto",
                "authors": [{"name": "Otra Persona"}],
                "urls": {
                    "canonical": (
                        "https://dialnet.unirioja.es/servlet/articulo?codigo=2"
                    )
                },
            },
        ], [17])

        findings = dialnet_author_proposals([row])
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["status"], "verified_corrections")
        self.assertEqual(
            findings[0]["corrections"]["author"]["value"],
            "Lilia Granillo Vázquez",
        )
        self.assertEqual(
            findings[0]["evidenceUrl"],
            "https://dialnet.unirioja.es/servlet/articulo?codigo=1",
        )

    @patch(
        "scripts.cucsh.enrich_sincronia_remaining.harvest_dialnet_records"
    )
    def test_dialnet_repairs_damaged_legacy_title_and_author(self, harvest):
        row = paper(
            "Historias que nos contamos: una redescripci\ufffdn "
            "de Zapata para los ni\ufffdos"
        )
        row["issueNumber"] = 48
        row["urls"]["canonical"] = (
            "http://sincronia.cucsh.udg.mx/perezfall08.htm"
        )
        harvest.return_value = ([
            {
                "issueNumber": 48,
                "title": (
                    "Historias que nos contamos: una redescripción "
                    "de Zapata para los niños"
                ),
                "authors": [{"name": "María Dolores Pérez Padilla"}],
                "urls": {
                    "canonical": (
                        "https://dialnet.unirioja.es/servlet/"
                        "articulo?codigo=123"
                    )
                },
            },
            {
                "issueNumber": 48,
                "title": "Otro artículo completamente distinto",
                "authors": [{"name": "Otra Persona"}],
                "urls": {
                    "canonical": (
                        "https://dialnet.unirioja.es/servlet/"
                        "articulo?codigo=456"
                    )
                },
            },
        ], [48])

        findings = dialnet_damaged_legacy_proposals([row])
        self.assertEqual(findings[0]["status"], "verified_corrections")
        self.assertEqual(
            findings[0]["corrections"]["title"]["value"],
            "Historias que nos contamos: una redescripción "
            "de Zapata para los niños",
        )
        self.assertEqual(
            findings[0]["corrections"]["author"]["value"],
            "María Dolores Pérez Padilla",
        )

    @patch(
        "scripts.cucsh.enrich_sincronia_remaining.harvest_dialnet_records"
    )
    def test_dialnet_repairs_damaged_author_label_only_when_unique(self, harvest):
        row = paper("Garc\ufffda N\ufffd\ufffdez, Roberto")
        row["issueNumber"] = 46
        row["urls"]["canonical"] = (
            "http://sincronia.cucsh.udg.mx/garciaspring08.htm"
        )
        harvest.return_value = ([
            {
                "issueNumber": 46,
                "title": "Un acercamiento al Buddhismo",
                "authors": [{"name": "Roberto García Núñez"}],
                "urls": {
                    "canonical": (
                        "https://dialnet.unirioja.es/servlet/"
                        "articulo?codigo=789"
                    )
                },
            },
            {
                "issueNumber": 46,
                "title": "Otro texto",
                "authors": [{"name": "Persona Distinta"}],
                "urls": {
                    "canonical": (
                        "https://dialnet.unirioja.es/servlet/"
                        "articulo?codigo=999"
                    )
                },
            },
        ], [46])

        findings = dialnet_damaged_legacy_proposals([row])
        self.assertEqual(findings[0]["status"], "verified_corrections")
        self.assertEqual(
            findings[0]["corrections"]["title"]["value"],
            "Un acercamiento al Buddhismo",
        )
        self.assertEqual(
            findings[0]["corrections"]["author"]["value"],
            "Roberto García Núñez",
        )

    def test_curated_encoding_fix_requires_exact_frozen_record(self):
        row = paper(
            "�Carta à José Joaquín Palma� ou la position esthétique "
            "de José Martí en exil",
            authors=[{"name": "Brahiman Saganogo"}],
        )
        row["id"] = "cucsh:sincronia-dialnet:3297208"
        row["issueNumber"] = 51
        row["urls"]["canonical"] = (
            "https://dialnet.unirioja.es/servlet/articulo?codigo=3297208"
        )
        findings = curated_encoding_proposals([row])
        self.assertEqual(len(findings), 1)
        self.assertEqual(
            findings[0]["corrections"]["title"]["value"],
            "Carta à José Joaquín Palma ou la position esthétique "
            "de José Martí en exil",
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
