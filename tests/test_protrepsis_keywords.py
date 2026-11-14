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
        self.assertGreaterEqual(len(curated), 100)
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
        self.assertEqual(
            curated["10.32870/prot.i29.503"]["keywords"],
            ["Animalidad", "muerte", "tiempo", "poesía"],
        )
        self.assertEqual(
            curated["10.32870/prot.i27.453"]["keywords"],
            [
                "Capitalismo tardío",
                "funcionalidad civilizatoria",
                "mal del ímpetu",
                "lo absurdo",
                "desprendimiento",
                "habitar este espacio",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i27.457"]["keywords"],
            [
                "Deber indirecto-directo",
                "clemencia",
                "libertad",
                "justicia",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i26.436"]["keywords"],
            [
                "Escuela de Frankfurt",
                "Instituto de Investigación Social",
                "presente",
                "fascismo",
                "nueva derecha",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i25.418"]["keywords"],
            [
                "Historia",
                "verdad",
                "saber",
                "máscara",
                "olvido",
                "creación",
                "Chat GPT",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i22.317"]["keywords"],
            [
                "Cyborg feminismo",
                "epistemología",
                "ontología",
                "logos",
                "metáfora",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i22.343"]["keywords"],
            [
                "Bien",
                "belleza",
                "verdad",
                "mujeres filósofas",
                "justicia",
                "equilibrio",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i23.374"]["keywords"],
            ["mundo común", "pareja", "fraternidad", "compasión", "amistad"],
        )
        self.assertEqual(
            curated["10.32870/prot.i20.290"]["keywords"],
            [
                "Pragmatismo",
                "comunidad de indagación filosófica",
                "Filosofía para Niños",
                "asombro",
                "experiencia",
                "significado",
                "Lipman",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i17.212"]["keywords"],
            [
                "Muerte",
                "infinitud",
                "ser occidental",
                "Mismo y Otro",
                "ciencia y tecnología",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i14.175"]["keywords"],
            ["lenguaje", "nombre", "mito", "cosmogonía", "origen del lenguaje"],
        )
        self.assertEqual(
            curated["10.32870/prot.i21.318"]["keywords"],
            ["Feminidad", "complicidad", "opresión", "formación", "internalización"],
        )
        self.assertEqual(
            curated["10.32870/prot.i23.384"]["keywords"],
            ["Kant", "Schopenhauer", "Übertragung", "teoría del conocimiento"],
        )

        self.assertEqual(
            curated["10.32870/prot.i14.146"]["keywords"],
            ["nihilismo", "décadence", "transparencia", "rendimiento", "positividad"],
        )
        self.assertEqual(
            curated["10.32870/prot.i13.153"]["keywords"],
            ["Humanidades", "construcción de una tesis", "investigación", "metodología"],
        )
        self.assertEqual(
            curated["10.32870/prot.i9-10.128"]["keywords"],
            ["Foucault", "Deleuze", "Poder", "Infancia", "Saber pedagógico"],
        )
        self.assertEqual(
            curated["10.32870/prot.i9-10.132"]["keywords"],
            [
                "Kant",
                "espacio",
                "tiempo",
                "física newtoniana",
                "relatividad general",
                "“ontología de la experiencia”",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i1.7"]["keywords"],
            [
                "Paradigma", "Continuidad", "Discontinuidad", "Externalismo",
                "Internalismo", "Ciencia", "Alquimia", "Química",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i5.76"]["keywords"],
            ["utopía", "homogeneidad", "distopía", "pluralismo"],
        )
        self.assertEqual(
            curated["10.32870/prot.i7-8.109"]["keywords"],
            [
                "Cyborg", "Biocapitalismo", "Ubjetos", "Hipersubsunción",
                "Feminismo", "Naturaleza Humana", "Naturaleza vs. Crianza",
                "Estudios Culturales",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i9-10.129"]["keywords"],
            [
                "Acción comunicativa", "Razón instrumental", "Modernidad",
                "Ilustración", "Racionalidad dramatúrgica", "Consenso",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i2.23"]["keywords"],
            ["Límites del lenguaje", "Tractatus Logico Philosophicus", "Wittgenstein", "Kant"],
        )
        self.assertEqual(
            curated["10.32870/prot.i2.30"]["keywords"],
            ["Vita beata", "vita activa", "bien", "libertad", "comunidad",
             "humanización", "acción", "discurso"],
        )
        self.assertEqual(
            curated["10.32870/prot.i4.55"]["keywords"],
            ["Kierkegaard", "Aristófanes", "sexualidad", "mito"],
        )
        self.assertEqual(
            curated["10.32870/prot.i11-12.139"]["keywords"],
            ["Fenomenología", "hermenéutica", "encarnación",
             "comprensión", "sensibilidad"],
        )

        self.assertEqual(
            curated["10.32870/prot.i24.353"]["keywords"],
            ["Hermenéutica", "opinión", "confianza", "atestación"],
        )
        self.assertEqual(
            curated["10.32870/prot.i15.170"]["keywords"],
            ["monarquía", "universal", "política", "utopía"],
        )
        self.assertEqual(
            curated["10.32870/prot.i15.172"]["keywords"],
            [
                "Marx", "marxismo", "teoría crítica", "sociología política",
                "espacio teórico", "Althusser", "materialismo",
                "acumulación originaria",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i15.173"]["keywords"],
            [
                "Marxismo", "Postmodernidad", "historia", "Historia",
                "proceso", "progreso",
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
