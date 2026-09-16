# Multilingual constraints v1 paired human delta

Observed paired human Top-10 delta between the expansion-fix run and multilingual-constraints-v1. Shared rows cancel; all changed rows are human judged or reused from prior human audits.

> This is development evidence, not independent validation. Provider drift is visible in English queries where the expansion set is unchanged; therefore the observed run-to-run delta must not be interpreted as a pure causal effect of multilingual translation.

## Summary

- changed Top-10 pairs judged/reused: 66
- newly judged in this blind audit: 45
- prior human judgments reused: 21
- comments on new judgments: 45/45
- relevant old-only positions: 10
- relevant new-only positions: 26
- net relevant positions: +16
- observed paired human ΔP@10: +0.16
- ordinal relevance old-only → new-only: 31 → 76 (Δ +45)
- improved/worsened/tied queries: 6/1/3
- new-only rows with translation provenance: 26; relevant=21; rate=0.8077
- translation-only new rows: 25; relevant=21; rate=0.84

## Drift control and translation-target languages

English queries are a useful drift control because multilingual-constraints-v1 adds no distinct English translation query to them.

- English control (2 queries): observed ΔP@10=+0.05, net relevant=+1
- Non-English translation targets (8 queries): observed ΔP@10=+0.1875, net relevant=+15

## Per query

| query | lang | control | changed/side | old rel | new rel | Δ rel | observed ΔP@10 | translation new-only rel/total |
|---|---|---|---:|---:|---:|---:|---:|---:|
| es-09 · fenomenología en enfermería | es | no | 3 | 2 | 2 | +0 | +0 | 2/3 |
| en-09 · phenomenology in nursing | en | yes | 2 | 2 | 1 | -1 | -0.1 | 0/0 |
| de-09 · Phänomenologie in der Pflege | de | no | 8 | 2 | 7 | +5 | +0.5 | 7/8 |
| fr-09 · phénoménologie en soins infirmiers | fr | no | 3 | 0 | 2 | +2 | +0.2 | 2/3 |
| pt-09 · fenomenologia na enfermagem | pt | no | 3 | 2 | 2 | +0 | +0 | 2/3 |
| es-10 · ontología en informática | es | no | 1 | 0 | 0 | +0 | +0 | 0/0 |
| en-10 · ontology in computer science | en | yes | 4 | 2 | 4 | +2 | +0.2 | 0/0 |
| de-10 · Ontologie in der Informatik | de | no | 5 | 0 | 5 | +5 | +0.5 | 5/5 |
| fr-10 · ontologie en informatique | fr | no | 2 | 0 | 2 | +2 | +0.2 | 2/2 |
| pt-10 · ontologia em ciência da computação | pt | no | 2 | 0 | 1 | +1 | +0.1 | 1/2 |

## Human comments on changed documents

Old/new side and translation provenance are revealed only after the blind audit was finalized.

### es-09 — fenomenología en enfermería

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 4 | 3 | translation-only | Interpretive phenomenology in health care research | Obra dedicada a la fenomenología interpretativa como marco para investigación y práctica de enfermería y salud. |
| new-only | 7 | 0 | translation-only | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs | Estudia educación a distancia y capital social en estudiantes de enfermería, pero no aborda la fenomenología. |
| new-only | 10 | 3 | translation-only | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing | Analiza directamente los usos de la fenomenología como filosofía y método de investigación en enfermería. |
| old-only | 8 | 3 | — | La interface entre la fenomenología y el cuidado de enfermería | El artículo está dedicado explícitamente a fundamentar y analizar el cuidado de enfermería desde una perspectiva fenomenológica. |
| old-only | 9 | 1 | — | Hacia un nuevo horizonte en ciencias de la educación: educación continua interdisciplinaria y sostenible en salud desde la fenomenología social | Utiliza sustantivamente la fenomenología social en un estudio sobre educación continua en salud, pero no se centra específicamente en enfermería. |
| old-only | 10 | 3 | — | Fenomenología como método de investigación: Una opción para el profesional de enfermería | Desarrolla explícitamente la fenomenología como método de investigación aplicable por profesionales de enfermería. |

### en-09 — phenomenology in nursing

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 3 | 0 | original-only | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs | Mismo documento que M012/M014/M028/M037. Estudia capital social en estudiantes de enfermería a distancia, pero no aborda fenomenología. |
| new-only | 9 | 2 | original-only | Lived experiences of management intern nursing students in the clinical settings of the quality of educational services using the SERVQUAL model: A descriptive phenomenology study | Utiliza de forma sustantiva fenomenología descriptiva para estudiar experiencias de estudiantes de enfermería, pero el foco principal es la calidad de los servicios educativos mediante SERVQUAL. |
| old-only | 1 | 3 | — | Nursing and the experience of illness : phenomenology in practice | Obra dedicada explícitamente a la aplicación de la fenomenología en la investigación y práctica de enfermería. |
| old-only | 2 | 3 | — | Revisioning phenomenology : nursing and health science research | Obra metodológica dedicada explícitamente al uso de la fenomenología en investigación de enfermería y ciencias de la salud. |

### de-09 — Phänomenologie in der Pflege

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 1 | 3 | translation-only | Interpretive phenomenology in health care research | Obra dedicada a la fenomenología interpretativa como marco filosófico y metodológico para investigación y práctica de enfermería y salud. |
| new-only | 3 | 0 | translation-only | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs | Estudia capital social y educación a distancia en estudiantes de enfermería, pero no aborda la fenomenología. |
| new-only | 4 | 3 | translation-only | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing | Analiza directamente los usos de la fenomenología como filosofía y método de investigación en enfermería, y su impacto en el conocimiento disciplinar. |
| new-only | 6 | 3 | translation-only | Using Phenomenology as a Research Method in Community-Based Research | Capítulo metodológico dedicado al uso de la fenomenología en investigación comunitaria dentro del contexto de la investigación en enfermería. |
| new-only | 7 | 3 | translation-only | Nursing and Phenomenology | Entrada dedicada explícitamente a la influencia y uso de la fenomenología en investigación, práctica y cuidado de enfermería. |
| new-only | 8 | 3 | translation-only | Phenomenology and nursing | Capítulo dedicado explícitamente a la relación entre fenomenología y enfermería dentro de un manual de filosofía y nursing. |
| new-only | 9 | 3 | translation-only | Phenomenology and nursing | Capítulo dedicado explícitamente a la relación entre fenomenología y enfermería y a su relevancia filosófica para el campo. |
| new-only | 10 | 2 | translation-only | ERIC EJ956977: The Experience of Witnessing Patients' Trauma and Suffering among Acute Care Nurses | Utiliza de forma sustantiva un método fenomenológico para estudiar la experiencia vivida de enfermeras de cuidados agudos, pero el foco principal es el trauma y sufrimiento presenciado en la práctica clínica. |
| old-only | 3 | 0 | — | Heidegger's Appropriation of the Concept of Intentionality in Die Grundprobleme der Phanomenologie | Analiza la apropiación heideggeriana de la intencionalidad en fenomenología filosófica; no aborda enfermería ni investigación en nursing. |
| old-only | 4 | 0 | — | Gabriel Cercel: Martin HEIDEGGER, Reden und andere Zeugnisse eines Lebensweges; Attila Szigeti: Emmanuel LEVINAS, Positivité et transcendance. Suivi de Lévinas et la phenomenology; Cristian Ciocan: Jean-Luc MARION, Crucea vizibilului; Gabriel Cercel: Mądąlina DIACONU, Blickumkehr. Mit Martin Heidegger zu einer relationalen ästhetik; Cristina Ionescu: Mark WRATHALL, Jeff MALPAS (eds.), Essays in Honour of Hubert L. Dreyfus; Cristian Ciocan: Ion COPOERU, Aparenţą şi sens. Repere ale fenomenologiei constitutive; Cristian Ciocan: Michael INWOOD, A Heidegger Dictionary; Cristian Ciocan: Linda FISCHER, Lester EMBREE (eds.), Feminist Phenomenology; Mądąlina Diaconu: Renato CRISTIN, Fenomeno storia. Fenomenologia e storicità in Husserl e Dilthey; Cristian Ciocan: Michel HAAR, La philosophie française entre phénoménologie et métaphysique; Gabriel Cercel: Otto PöGGELER, Heidegger in seiner Zeit; Roxana Albu: James RISSER (ed.), Heidegger toward the Turn, Essays on the work of the 1930s; Cristian Ciocan: Virgil Ciomoş, Timp şi Eternitate. Aristotel, Fizica IV 10-14, Interpretare fenomenologicą; Cristina Ionescu: William D. BLATTNER, Heidegger's Temporal Idealism; Bogdan Mincą: Gino ZACCARIA, L'inizio greco del pensiero. Heidegger e l'essenza futura della filosofia; Mądąlina Diaconu: Ute GUZZONI, Wohnen und Wandern; Bogdan Tątaru-Cazaban: Emmanuel LéVINAS, Totalitate şi infinit; Mihail Neamţu: Jean-Luc MARION, étant donné. Essai d'une phénoménologie de la donation; Gabriel Cercel: Robert PETKOVŠEK, Heidegger-Index (1919-1927); Cristian Ciocan: Einar ØVERENGET, Seeing The Self. Heidegger on Subjectivity Mihail Neamţu: Rolf KüHN, Husserls Begriff der Passivität. Zur Kritik der passiven Synthesis in der genetischen Phänomenologie. | Conjunto de reseñas sobre obras de fenomenología filosófica; no trata enfermería ni aplicación fenomenológica a los cuidados. |
| old-only | 5 | 0 | — | Das Selbst und die Gegenwart der Verantwortung. Über das Verantwortungskonzept in der hermeneutischen Phänomenologie von Paul Ricœur | Analiza la responsabilidad en la fenomenología hermenéutica de Ricœur, pero no tiene relación sustantiva con enfermería o cuidados. |
| old-only | 6 | 0 | — | Das Experiment bei Husserl. Zum Verhältnis von Empirie und Eidetik in der Phänomenologie | Estudia metodológicamente el papel del experimento en la fenomenología husserliana, pero no aborda enfermería ni cuidados. |
| old-only | 7 | 3 | — | Dialogische Phänomenologie im Rahmen der Pflegewissenschaft – Eine kritische Auseinandersetzung mit einer wenig bekannten Forschungsmethode | Presenta y evalúa directamente la fenomenología dialógica como método de investigación en ciencias de la enfermería y su utilidad para la práctica reflexiva. |
| old-only | 8 | 2 | — | Qualitative Gesundheitsforschung aus Sicht der Neuen Phänomenologie | Aplica la Nueva Fenomenología a la investigación cualitativa en salud, pero no parece centrarse específicamente en enfermería. |
| old-only | 9 | 0 | — | Idee einer Phänomenologie der Hoffnung | Desarrolla una fenomenología filosófica de la esperanza, pero no aborda enfermería ni investigación fenomenológica en nursing. |
| old-only | 10 | 0 | — | Der Sinn der Phänomenologie: Eine methodologische Reflexion | Reflexiona sobre el sentido y método de la fenomenología en el plano filosófico; no aborda enfermería ni su aplicación en investigación o cuidados. |

### fr-09 — phénoménologie en soins infirmiers

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 2 | 3 | translation-only | Interpretive phenomenology in health care research | Obra metodológica dedicada a la fenomenología interpretativa en investigación sanitaria, con numerosos capítulos centrados explícitamente en enfermería y prácticas de cuidado. |
| new-only | 3 | 0 | translation-only | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs | Estudia capital social y educación a distancia en estudiantes de enfermería, pero no aborda la fenomenología. |
| new-only | 4 | 3 | translation-only | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing | Analiza directamente los usos de la fenomenología como filosofía y método de investigación en enfermería. |
| old-only | 8 | 0 | — | Hypnose en soins infirmiers | Trata específicamente de hipnosis e hipnoterapia en cuidados de enfermería, no de fenomenología. |
| old-only | 9 | 0 | — | Hypnose en soins infirmiers | Trata específicamente de hipnosis en cuidados de enfermería, pero no aborda fenomenología. |
| old-only | 10 | 0 | — | Hypnose en soins infirmiers | Aborda la hipnosis en cuidados de enfermería, pero no la fenomenología. |

### pt-09 — fenomenologia na enfermagem

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 6 | 3 | translation-only | Interpretive phenomenology in health care research | Mismo documento que M006/M011/M036. Obra metodológica dedicada a la fenomenología interpretativa en investigación sanitaria, con fuerte énfasis en enfermería y prácticas de cuidado. |
| new-only | 7 | 0 | translation-only | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs | Estudia educación a distancia y capital social en estudiantes de enfermería, pero no utiliza ni aborda la fenomenología. |
| new-only | 9 | 3 | translation-only | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing | Analiza directamente los usos de la fenomenología como filosofía y método de investigación en enfermería. |
| old-only | 8 | 3 | — | Fenomenologia: uma alternativa para pesquisa em enfermagem | Presenta explícitamente la fenomenología como alternativa metodológica para la investigación en enfermería y examina su uso por profesionales de enfermería. |
| old-only | 9 | 0 | — | Figuras do direito na Fenomenologia do Espírito: a fenomenologia como doutrina do espírito objetivo? | Analiza la Fenomenología del espíritu de Hegel y su relación con el derecho y el espíritu objetivo; no aborda fenomenología aplicada a la enfermería. |
| old-only | 10 | 3 | — | Enfermagem psiquiátrica e fenomenologia: algumas considerações | Reflexiona directamente sobre la aplicación de la fenomenología a la atención y comprensión del paciente en enfermería psiquiátrica. |

### es-10 — ontología en informática

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 3 | 0 | original-only | La ontología negativa en las filosofías socráticas y sus proyecciones interepocales | Aborda ontología en sentido filosófico, específicamente en las corrientes socráticas y su proyección hacia Heidegger; no trata ontologías computacionales ni informática. |
| old-only | 6 | 0 | — | Ontología política de la voluntad en Enrique Dussel | Aborda ontología política en el pensamiento de Enrique Dussel; no ontologías computacionales ni informática. |

### en-10 — ontology in computer science

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 1 | 3 | original-only | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology | — |
| new-only | 3 | 3 | original-only | DTIC ADA515719: Uncertainty in Ontology Mapping: A Bayesian Perspective | Aborda directamente el mapeo de ontologías OWL mediante un enfoque bayesiano para representación y razonamiento bajo incertidumbre. |
| new-only | 8 | 3 | original-only | DTIC ADA624287: Dataset Curation through Renders and Ontology Matching | Utiliza directamente ontology matching y ontologías de entidades para automatizar el etiquetado y la construcción de datasets en visión por computadora. |
| new-only | 10 | 3 | original-only | A Conceptual Model for Ontology Based Learning | Desarrolla una ontología del aprendizaje y un modelo conceptual basado en ella dentro de contextos de IA y sistemas multiagente. |
| old-only | 6 | 3 | — | DTIC ADA534412: Linking Semantic and Knowledge Representations in a Multi-Domain Dialogue System | Desarrolla directamente mapeo entre ontologías semánticas y ontologías de conocimiento de dominio para razonamiento computacional en sistemas de diálogo. |
| old-only | 8 | 3 | — | Video Representation and Semantic Information Extraction using Ontology based Approaches | Emplea directamente ingeniería de ontologías, representación semántica y razonamiento computacional para modelar y extraer información de video. |
| old-only | 9 | 0 | — | Levinas, Meaning, and Philosophy of Social Science: From Ethical Metaphysics to Ontology and Epistemology | Aborda ontología en sentido filosófico dentro de una discusión sobre Levinas y filosofía de las ciencias sociales; no trata ontologías computacionales ni informática. |
| old-only | 10 | 0 | — | Myth of Metaphysical Neutrality: How Denying Ontology Distorts Science, AI, and Understanding Itself | Discute compromisos ontológicos en sentido metafísico y sus implicaciones para ciencia e IA, pero no ontologías computacionales ni representación formal del conocimiento. |

### de-10 — Ontologie in der Informatik

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 2 | 3 | translation-only | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology | Construye y consulta una ontología computacional de búsqueda de empleo mediante Protégé, RDF, SPARQL y Apache Jena Fuseki. |
| new-only | 4 | 3 | translation-only | DTIC ADA515719: Uncertainty in Ontology Mapping: A Bayesian Perspective | Aborda directamente el mapeo de ontologías OWL mediante un enfoque bayesiano para representación y razonamiento bajo incertidumbre. |
| new-only | 8 | 3 | translation-only | DTIC ADA624287: Dataset Curation through Renders and Ontology Matching | Utiliza directamente ontology matching y mapeo de imágenes a ontologías de entidades para automatizar la construcción y etiquetado de datasets en visión por computadora. |
| new-only | 9 | 3 | translation-only | Ontology in Computer Science | Capítulo dedicado explícitamente al concepto y uso de ontologías en ciencias de la computación y Web Semántica. |
| new-only | 10 | 3 | translation-only | A Conceptual Model for Ontology Based Learning | Construye una ontología formal del aprendizaje y la utiliza como base para un modelo conceptual aplicable a IA y sistemas multiagente. |
| old-only | 6 | 0 | — | Von der Epistemologie zur Ontologie Martin Heideggers Hermeneutik der Freiheit im Diskurs mit Immanuel Kant | Aborda ontología filosófica en Heidegger, en diálogo con Kant y el problema de la libertad; no ontologías computacionales ni informática. |
| old-only | 7 | 0 | — | Die Ontologie Mullā Ṣadrās und der Vorwurf der Ontotheologie Versuch einer Interpretation der Philosophie Mullā Ṣadrās im Lichte der Metaphysikkritik Heideggers | Trata ontología filosófica y ontoteología en Mullā Ṣadrā y Heidegger, no ontologías en informática. |
| old-only | 8 | 0 | — | Nicolai Hartmanns Kritische Ontologie („wie sie als Grundlage der Gnoseologie anzustreben ist“) und der Kritische Realismus der Gestaltpsychologie („Berliner Schule“/Gestalttheorie) | Aborda ontología crítica en sentido filosófico y su relación con la psicología de la Gestalt; no trata ontologías computacionales ni informática. |
| old-only | 9 | 0 | — | Ontologie der Innerlichkeit. Reditio Completa und Processio Interior bei Thomas von Aquinas by Reto L. Fetz | Aborda ontología en sentido filosófico-tomista, particularmente la interioridad y el alma en Tomás de Aquino; no ontologías computacionales ni informática. |
| old-only | 10 | 0 | — | Physik und Ontologie – oder Die 'Ontologiebeladenheit' der Epistemologie und die 'Realismusdebatte' | Aborda ontología en filosofía de la física y epistemología, especialmente realismo científico y realismo estructural óntico; no ontologías computacionales ni informática. |

### fr-10 — ontologie en informatique

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 9 | 3 | translation-only | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology | Construye y consulta una ontología computacional de búsqueda de empleo mediante Protégé, RDF, SPARQL y Apache Jena Fuseki. |
| new-only | 10 | 3 | translation-only | DTIC ADA515719: Uncertainty in Ontology Mapping: A Bayesian Perspective | Aborda directamente ingeniería y mapeo de ontologías OWL mediante redes bayesianas para representación y razonamiento bajo incertidumbre. |
| old-only | 9 | 0 | — | Valeurs propres et vecteurs propres en classification hiérarchique | Trata métodos algebraicos para clasificación jerárquica y análisis de datos; no aborda ontologías computacionales. |
| old-only | 10 | 1 | — | Epistemology and Ontology of AI — From Lagrange and Hamilton Genre-Shift to Agentic AI Cognitive Safety: Open-Source Framework, LNN, HNN, PINN and SciML within the Dorian Codex H_SAFE by Stefano Dorian Franco — Independent Research Modules Programme | — |

### pt-10 — ontologia em ciência da computação

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| new-only | 9 | 3 | translation-only | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology | Construye y consulta una ontología computacional de búsqueda de empleo mediante Protégé, RDF, SPARQL y Apache Jena Fuseki. |
| new-only | 10 | 0 | original+translation | El proyecto de una ciencia del origen en el joven Benjamin | Aborda ontología en sentido filosófico-estético dentro del pensamiento de Walter Benjamin; no trata ontologías computacionales ni ciencia de la computación. |
| old-only | 9 | 0 | — | Kant y la relatividad. Sobre la idea de una “ontología de la experiencia” | “Ontología” se usa en sentido epistemológico y metafísico, aplicada a Kant y la relatividad general; no trata ontologías computacionales ni informática. |
| old-only | 10 | 0 | — | Una ontología propiamente dicha | Aborda ontología orientada a objetos en sentido filosófico, especialmente realismo, fenómeno/noúmeno y estética; no ontologías computacionales ni informática. |
