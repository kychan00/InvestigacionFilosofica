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
    unique_strings,
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
        self.assertGreaterEqual(len(curated), 146)
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

        self.assertEqual(
            curated["10.32870/prot.i1.3"]["keywords"],
            [
                "justicia", "juventud dorada", "persona", "placer",
                "poder", "política", "universidad", "valores",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i1.4"]["keywords"],
            ["pensar", "rumiar", "traspasar", "sustraerse"],
        )
        self.assertEqual(
            curated["10.32870/prot.i1.10"]["keywords"],
            [
                "mente", "inteligencia artificial", "Turing",
                "computación", "procesos", "cerebro",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i3.35"]["keywords"],
            [
                "Karl Popper", "inductivismo", "problema de la inducción",
                "corroboración", "falsación", "justificacionismo", "falibilismo",
            ],
        )

        self.assertEqual(
            curated["10.32870/prot.i16.190"]["keywords"],
            [
                "explotación animal", "sintientes", "vulnerabilidad",
                "especismo", "consideración moral",
            ],
        )
        self.assertEqual(
            curated["10.32870/prot.i17.229"]["keywords"],
            ["Axiomatización", "reducción", "revolución científica",
             "relaciones interteóricas"],
        )
        self.assertEqual(
            curated["10.32870/prot.i18.263"]["keywords"],
            ["Tolerancia", "mal", "deísmo", "providencia",
             "libertad", "bien", "optimismo", "desdicha"],
        )
        self.assertEqual(
            curated["10.32870/prot.i19.275"]["keywords"],
            ["Inferencia", "deducción", "inducción", "abducción",
             "pragmatismo", "realismo", "investigación"],
        )

        self.assertEqual(
            curated["10.32870/prot.i4.37"]["keywords"],
            ["Love", "suffering", "human nature", "Eros",
             "despair", "sacrifice", "resurrection"],
        )
        self.assertEqual(
            curated["10.32870/prot.i4.53"]["keywords"],
            ["amor", "sufrimiento", "naturaleza humana", "Eros",
             "desesperación", "sacrificio", "resurrección"],
        )
        self.assertEqual(
            curated["10.32870/prot.i5.74"]["keywords"],
            ["Kierkergaad", "God", "religious", "human being",
             "christianity", "existentialism"],
        )
        self.assertEqual(
            curated["10.32870/prot.i5.75"]["keywords"],
            ["Kierkergaard", "Dios", "religión", "ser humano",
             "cristianismo", "existencialismo"],
        )
        self.assertEqual(
            curated["10.32870/prot.i21.313"]["keywords"],
            ["Patriarcado", "historia androcéntrica", "narración dominante",
             "olas del feminismo", "injusticia epistémica"],
        )

        self.assertEqual(
            curated["10.32870/prot.i23.399"]["keywords"],
            ["Arendt", "violencia", "necroemprendimientos",
             "subjetividad", "cadáver", "neoliberalismo"],
        )
        self.assertEqual(
            curated["10.32870/prot.i23.333"]["keywords"],
            ["Videojuegos", "colonialidad", "poder", "lengua", "cultura"],
        )
        self.assertEqual(
            curated["10.32870/prot.i26.431"]["keywords"],
            ["Intuición", "duración", "libertad", "multiplicidad", "vitalismo"],
        )

        self.assertEqual(
            curated["10.32870/prot.i26.444"]["keywords"],
            ["Razón instrumental", "Antropoceno", "tecnoceno",
             "crisis ecológica", "progreso", "Prometeo"],
        )
        self.assertEqual(
            curated["10.32870/prot.i21.311"]["keywords"],
            ["Masculinidad", "subjetivación", "sexaje",
             "falocracia", "violencia"],
        )
        self.assertNotIn(
            "falopoder",
            curated["10.32870/prot.i21.311"]["keywords"],
        )
        self.assertEqual(
            curated["10.32870/prot.i20.332"]["keywords"],
            ["Pregunta", "preguntar", "filosofía", "práctica filosófica",
             "filosofía con niños", "filosofía para niños",
             "tríada del buen preguntador"],
        )
        self.assertEqual(
            curated["10.32870/prot.i20.286"]["keywords"],
            ["Diferencia", "duración", "memoria", "tiempo", "repetición"],
        )

        self.assertEqual(
            curated["10.32870/prot.i23.395"]["keywords"],
            ["Hannah Arendt", "story", "empathy", "witness", "common sense"],
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

    def test_verified_keyword_casing_is_not_collapsed(self):
        self.assertEqual(
            unique_strings(["historia", "Historia", "historia"], preserve_case=True),
            ["historia", "Historia"],
        )
        self.assertEqual(
            unique_strings(["historia", "Historia", "historia"]),
            ["historia"],
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
