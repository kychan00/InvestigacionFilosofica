# Multilingual constraints v1 analysis

Development-only structural comparison of the human-validated expansion-fix run against multilingual-constraints-v1. It does not infer relevance for unseen documents and is not an independent validation set.

> Shared Top-10 rows cancel in paired P@10. Exact paired human ΔP@10 requires human labels for every old-only/new-only Top-10 pair.

## Summary

- queries: 10
- Top-10 shared query-document pairs: 67
- Top-10 union query-document pairs: 133
- mean Top-10 overlap per query: 6.7/10
- changed Top-10 pairs: 66
- changed pairs already covered by prior human judgments: 21
- changed pairs still requiring human judgment for exact paired ΔP@10: 45
- Top-20 shared query-document pairs: 131
- mean Top-20 overlap per query: 13.1/20
- new-run Top-10 positions with translation provenance: 27/100
- new-run Top-10 positions with translation-only provenance: 25/100
- new-only Top-10 positions with translation provenance: 26
- among already-judged changed pairs only: old relevant=9/20, new relevant=1/1, net=-8
- the partial human line above is descriptive only; it is not the final paired delta until all changed pairs are judged

## es-09 — fenomenología en enfermería

Top-10 overlap: **7/10** · changed=6 · already-human=3 · unresolved=3
Top-20 overlap: **14/20**
translation provenance in new Top 10: 3/10 · translation-only=3/10 · new-only via translation=3
known changed labels: old relevant=2/3 · new relevant=0/0 · net=-2

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | ? | original-only | Crossref | fenomenología en enfermería:original@1.00 | La fenomenología, y su uso en la producción científica de enfermería: estudio bibliométrico 2010-2014 |
| 2 | 2 | shared | ? | original-only | Crossref | fenomenología en enfermería:original@1.00 | Contribuciones significativas de la fenomenología de Edmund Husserl, Martin Heidegger y Hans-Georg Gadamer a la investigación en enfermería |
| 3 | 3 | shared | 2 | original-only | Crossref | fenomenología en enfermería:original@1.00 | Aplicaciones de dispositivos móviles como estrategia de aprendizaje en estudiantes universitarios de enfermería. Una mirada desde la fenomenología crítica |
| 4 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | Interpretive phenomenology in health care research |
| 5 | 4 | shared | ? | original-only | CUCSH Filosofía | fenomenología en enfermería:original@1.00 | Algunas reflexiones sobre las herramientas técnicas de mediación en el proceso educativo musical y sus posibilidades de análisis a través de la fenomenología de Alfred Schütz |
| 6 | 5 | shared | ? | original-only | CUCSH Filosofía | fenomenología en enfermería:original@1.00 | Sobre la posibilidad de una “hermenéutica encarnada”. Institución, pasividad, prejuicio y tradición en la fenomenología tardía de Merleau-Ponty y la hermenéutica filosófica de Gadamer |
| 7 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs |
| 8 | 6 | shared | ? | original-only | OpenAlex Philosophy | fenomenología en enfermería:original@1.00 | Fenomenología y hermenéutica un gran atractivo de investigación en Enfermería |
| 9 | 7 | shared | ? | original-only | OpenAlex Philosophy | fenomenología en enfermería:original@1.00 | El cuidar en Enfermería desde la Fenomenología Hermenéutica |
| 10 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing |

### Left previous Top 10

- old r8 · human=3 · Crossref · La interface entre la fenomenología y el cuidado de enfermería
- old r9 · human=1 · Crossref · Hacia un nuevo horizonte en ciencias de la educación: educación continua interdisciplinaria y sostenible en salud desde la fenomenología social
- old r10 · human=3 · Crossref · Fenomenología como método de investigación: Una opción para el profesional de enfermería

## en-09 — phenomenology in nursing

Top-10 overlap: **8/10** · changed=4 · already-human=2 · unresolved=2
Top-20 overlap: **18/20**
translation provenance in new Top 10: 0/10 · translation-only=0/10 · new-only via translation=0
known changed labels: old relevant=2/2 · new relevant=0/0 · net=-2

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 3 | shared | ? | original-only | Crossref | phenomenology in nursing:original@1.00 | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing |
| 2 | 4 | shared | ? | original-only | Internet Archive | phenomenology in nursing:original@1.00 | Interpretive phenomenology in health care research |
| 3 | — | new-only | ? | original-only | Internet Archive | phenomenology in nursing:original@1.00 | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs |
| 4 | 5 | shared | ? | original-only | Crossref | phenomenology in nursing:original@1.00 | Nursing and Phenomenology |
| 5 | 6 | shared | ? | original-only | Crossref | phenomenology in nursing:original@1.00 | Using Phenomenology as a Research Method in Community-Based Research |
| 6 | 7 | shared | ? | original-only | Crossref | phenomenology in nursing:original@1.00 | Phenomenology and nursing |
| 7 | 8 | shared | ? | original-only | Crossref | phenomenology in nursing:original@1.00 | Phenomenology and nursing |
| 8 | 9 | shared | 3 | original-only | Crossref | phenomenology in nursing:original@1.00 | Walt Whitman, Nursing, and Phenomenology |
| 9 | — | new-only | ? | original-only | Internet Archive | phenomenology in nursing:original@1.00 | Lived experiences of management intern nursing students in the clinical settings of the quality of educational services using the SERVQUAL model: A descriptive phenomenology study |
| 10 | 10 | shared | 3 | original-only | OpenAlex Philosophy | phenomenology in nursing:original@1.00 | Phenomenology in nursing research: reflection based on Heidegger’s hermeneutics |

### Left previous Top 10

- old r1 · human=3 · Internet Archive · Nursing and the experience of illness : phenomenology in practice
- old r2 · human=3 · Internet Archive · Revisioning phenomenology : nursing and health science research

## de-09 — Phänomenologie in der Pflege

Top-10 overlap: **2/10** · changed=16 · already-human=1 · unresolved=15
Top-20 overlap: **9/20**
translation provenance in new Top 10: 8/10 · translation-only=8/10 · new-only via translation=8
known changed labels: old relevant=1/1 · new relevant=0/0 · net=-1

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | Interpretive phenomenology in health care research |
| 2 | 1 | shared | ? | original-only | Crossref | Phänomenologie in der Pflege:original@1.00 | Intuition und Wahrnehmung als Grundlage in der palliativen Pflege – das Konzept der leiblichen Phänomenologie in Praxis und Bildung |
| 3 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs |
| 4 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing |
| 5 | 2 | shared | ? | original-only | Crossref | Phänomenologie in der Pflege:original@1.00 | Auf die Situation kommt es an – Beziehung und Berührung in der Pflege |
| 6 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Using Phenomenology as a Research Method in Community-Based Research |
| 7 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Nursing and Phenomenology |
| 8 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Phenomenology and nursing |
| 9 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Phenomenology and nursing |
| 10 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | ERIC EJ956977: The Experience of Witnessing Patients' Trauma and Suffering among Acute Care Nurses |

### Left previous Top 10

- old r3 · human=? · OpenAlex Philosophy · Heidegger's Appropriation of the Concept of Intentionality in Die Grundprobleme der Phanomenologie
- old r4 · human=? · OpenAlex Philosophy · Gabriel Cercel: Martin HEIDEGGER, Reden und andere Zeugnisse eines Lebensweges; Attila Szigeti: Emmanuel LEVINAS, Positivité et transcendance. Suivi de Lévinas et la phenomenology; Cristian Ciocan: Jean-Luc MARION, Crucea vizibilului; Gabriel Cercel: Mądąlina DIACONU, Blickumkehr. Mit Martin Heidegger zu einer relationalen ästhetik; Cristina Ionescu: Mark WRATHALL, Jeff MALPAS (eds.), Essays in Honour of Hubert L. Dreyfus; Cristian Ciocan: Ion COPOERU, Aparenţą şi sens. Repere ale fenomenologiei constitutive; Cristian Ciocan: Michael INWOOD, A Heidegger Dictionary; Cristian Ciocan: Linda FISCHER, Lester EMBREE (eds.), Feminist Phenomenology; Mądąlina Diaconu: Renato CRISTIN, Fenomeno storia. Fenomenologia e storicità in Husserl e Dilthey; Cristian Ciocan: Michel HAAR, La philosophie française entre phénoménologie et métaphysique; Gabriel Cercel: Otto PöGGELER, Heidegger in seiner Zeit; Roxana Albu: James RISSER (ed.), Heidegger toward the Turn, Essays on the work of the 1930s; Cristian Ciocan: Virgil Ciomoş, Timp şi Eternitate. Aristotel, Fizica IV 10-14, Interpretare fenomenologicą; Cristina Ionescu: William D. BLATTNER, Heidegger's Temporal Idealism; Bogdan Mincą: Gino ZACCARIA, L'inizio greco del pensiero. Heidegger e l'essenza futura della filosofia; Mądąlina Diaconu: Ute GUZZONI, Wohnen und Wandern; Bogdan Tątaru-Cazaban: Emmanuel LéVINAS, Totalitate şi infinit; Mihail Neamţu: Jean-Luc MARION, étant donné. Essai d'une phénoménologie de la donation; Gabriel Cercel: Robert PETKOVŠEK, Heidegger-Index (1919-1927); Cristian Ciocan: Einar ØVERENGET, Seeing The Self. Heidegger on Subjectivity Mihail Neamţu: Rolf KüHN, Husserls Begriff der Passivität. Zur Kritik der passiven Synthesis in der genetischen Phänomenologie.
- old r5 · human=? · OpenAlex Philosophy · Das Selbst und die Gegenwart der Verantwortung. Über das Verantwortungskonzept in der hermeneutischen Phänomenologie von Paul Ricœur
- old r6 · human=? · OpenAlex Philosophy · Das Experiment bei Husserl. Zum Verhältnis von Empirie und Eidetik in der Phänomenologie
- old r7 · human=? · Crossref · Dialogische Phänomenologie im Rahmen der Pflegewissenschaft – Eine kritische Auseinandersetzung mit einer wenig bekannten Forschungsmethode
- old r8 · human=2 · Crossref · Qualitative Gesundheitsforschung aus Sicht der Neuen Phänomenologie
- old r9 · human=? · Crossref · Idee einer Phänomenologie der Hoffnung
- old r10 · human=? · Crossref · Der Sinn der Phänomenologie: Eine methodologische Reflexion

## fr-09 — phénoménologie en soins infirmiers

Top-10 overlap: **7/10** · changed=6 · already-human=0 · unresolved=6
Top-20 overlap: **11/20**
translation provenance in new Top 10: 3/10 · translation-only=3/10 · new-only via translation=3
known changed labels: old relevant=0/0 · new relevant=0/0 · net=0

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | ? | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | De l’intérêt de la phénoménologie pour la mise en évidence de l’expertise infirmière et le développement de connaissances en soins infirmiers |
| 2 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | Interpretive phenomenology in health care research |
| 3 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs |
| 4 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing |
| 5 | 3 | shared | ? | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 6 | 2 | shared | 0 | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 7 | 4 | shared | ? | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 8 | 5 | shared | ? | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 9 | 6 | shared | 0 | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 10 | 7 | shared | ? | original-only | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |

### Left previous Top 10

- old r8 · human=? · Crossref · Hypnose en soins infirmiers
- old r9 · human=? · Crossref · Hypnose en soins infirmiers
- old r10 · human=? · Crossref · Hypnose en soins infirmiers

## pt-09 — fenomenologia na enfermagem

Top-10 overlap: **7/10** · changed=6 · already-human=3 · unresolved=3
Top-20 overlap: **16/20**
translation provenance in new Top 10: 3/10 · translation-only=3/10 · new-only via translation=3
known changed labels: old relevant=2/3 · new relevant=0/0 · net=-2

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | 3 | original-only | Crossref | fenomenologia na enfermagem:original@1.00 | O ensino de enfermagem em saúde mental e psiquiátrica: visão do professor e do aluno na perspectiva da fenomenologia social |
| 2 | 2 | shared | ? | original-only | Crossref | fenomenologia na enfermagem:original@1.00 | CONTRIBUIÇÕES DA FENOMENOLOGIA PARA A PRÁTICA DA ENFERMAGEM NA SAÚDE DA MULHER |
| 3 | 3 | shared | ? | original-only | Crossref | fenomenologia na enfermagem:original@1.00 | A presença da fenomenologia na investigação em enfermagem: mapeamento das teses de doutoramento em Portugal |
| 4 | 4 | shared | ? | original-only | Crossref | fenomenologia na enfermagem:original@1.00 | Brinquedo terapêutico: percepção da equipe de enfermagem na perspectiva da fenomenologia social |
| 5 | 5 | shared | ? | original-only | Crossref | fenomenologia na enfermagem:original@1.00 | Na trilha da fenomenologia: um caminho para a pesquisa em enfermagem |
| 6 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | Interpretive phenomenology in health care research |
| 7 | — | new-only | ? | translation-only | Internet Archive | phenomenology in nursing:translation@0.90 | ERIC EJ1073197: Hiding in Plain Sight: Building Community Social Capital in Distance Education Graduate Programs |
| 8 | 6 | shared | ? | original-only | OpenAlex Philosophy | fenomenologia na enfermagem:original@1.00 | Cuidado de enfermagem em terapia intensiva cardiológica: hermenêutica do conceito fundamentada na fenomenologia heideggeriana |
| 9 | — | new-only | ? | translation-only | Crossref | phenomenology in nursing:translation@0.90 | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing |
| 10 | 7 | shared | 3 | original-only | Crossref | fenomenologia na enfermagem:original@1.00 | SOBRE FENOMENOLOGIA, FENOMENOLOGIA EXISTENCIAL E ENFERMAGEM PSIQUIATRICA |

### Left previous Top 10

- old r8 · human=3 · Crossref · Fenomenologia: uma alternativa para pesquisa em enfermagem
- old r9 · human=0 · Crossref · Figuras do direito na Fenomenologia do Espírito: a fenomenologia como doutrina do espírito objetivo?
- old r10 · human=3 · Crossref · Enfermagem psiquiátrica e fenomenologia: algumas considerações

## es-10 — ontología en informática

Top-10 overlap: **9/10** · changed=2 · already-human=1 · unresolved=1
Top-20 overlap: **10/20**
translation provenance in new Top 10: 1/10 · translation-only=0/10 · new-only via translation=0
known changed labels: old relevant=0/1 · new relevant=0/0 · net=0

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | ? | original-only | Crossref | ontología en informática:original@1.00 | Autoconstitución y libertad Ontología y política en Espinosa III |
| 2 | 2 | shared | 0 | original-only | Crossref | ontología en informática:original@1.00 | Origen de la ontología jurídica en el pensamiento griego |
| 3 | — | new-only | ? | original-only | Crossref | ontología en informática:original@1.00 | La ontología negativa en las filosofías socráticas y sus proyecciones interepocales |
| 4 | 9 | shared | 0 | original+translation | CUCSH Filosofía | ontología en informática:original@1.00 \| ontology in computer science:translation@0.90 | Abismando formaciones discursivas, entrecruces del ser maya ch´ol versus ser alguien en la vida |
| 5 | 3 | shared | 0 | original-only | Crossref | ontología en informática:original@1.00 | Lógica y ontología en Aristóteles / |
| 6 | 4 | shared | 0 | original-only | Crossref | ontología en informática:original@1.00 | Ontología en América Latina. Fase 1: Ontología Existencial |
| 7 | 5 | shared | 0 | original-only | Crossref | ontología en informática:original@1.00 | Ontología de la finitud en Ernildo Stein |
| 8 | 7 | shared | 0 | original-only | CUCSH Filosofía | ontología en informática:original@1.00 | Una ontología propiamente dicha |
| 9 | 8 | shared | 0 | original-only | CUCSH Filosofía | ontología en informática:original@1.00 | Kant y la relatividad. Sobre la idea de una “ontología de la experiencia” |
| 10 | 10 | shared | 0 | original-only | CUCSH Filosofía | ontología en informática:original@1.00 | Museología y trascendencia en el hiperrealismo de William Fisk |

### Left previous Top 10

- old r6 · human=0 · Crossref · Ontología política de la voluntad en Enrique Dussel

## en-10 — ontology in computer science

Top-10 overlap: **6/10** · changed=8 · already-human=5 · unresolved=3
Top-20 overlap: **16/20**
translation provenance in new Top 10: 0/10 · translation-only=0/10 · new-only via translation=0
known changed labels: old relevant=2/4 · new relevant=1/1 · net=-1

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | — | new-only | 3 | original-only | Internet Archive | ontology in computer science:original@1.00 | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology |
| 2 | 1 | shared | ? | original-only | OpenAlex Philosophy | ontology in computer science:original@1.00 | Ontology in Computer Science |
| 3 | — | new-only | ? | original-only | Internet Archive | ontology in computer science:original@1.00 | DTIC ADA515719: Uncertainty in Ontology Mapping: A Bayesian Perspective |
| 4 | 2 | shared | 0 | original-only | OpenAlex Philosophy | ontology in computer science:original@1.00 | von Leibniz'Metaphysik (2001), Leibniz: Metaphilosophy and Metaphysics, 1666–1686 (2005), and Biomedical Ontology and the Metaphysics of Composite Substances, 1540–1670 (2010). Martin Campbell-Kelly is emeritus professor in the Department of Com-puter Science at the University of Warwick, where he specializes in the |
| 5 | 3 | shared | 0 | original-only | OpenAlex Philosophy | ontology in computer science:original@1.00 | A Consciousness-First Ontology in the Long Arc of Science and Mysticism: The Unified Play of Consciousness (UPC) in Historical and Scientific |
| 6 | 4 | shared | 0 | original-only | OpenAlex Philosophy | ontology in computer science:original@1.00 | Th eology as the science of existence and philosophy as the science of being in the fundamental ontology of M. Heidegger |
| 7 | 5 | shared | 3 | original-only | Crossref | ontology in computer science:original@1.00 | Using a trope-based foundational ontology for bridging different areas of concern in ontology-driven conceptual modeling |
| 8 | — | new-only | ? | original-only | Internet Archive | ontology in computer science:original@1.00 | DTIC ADA624287: Dataset Curation through Renders and Ontology Matching |
| 9 | 7 | shared | 3 | original-only | Crossref | ontology in computer science:original@1.00 | Ontology segmentation in ontology matching |
| 10 | — | new-only | ? | original-only | Internet Archive | ontology in computer science:original@1.00 | A Conceptual Model for Ontology Based Learning |

### Left previous Top 10

- old r6 · human=3 · Internet Archive · DTIC ADA534412: Linking Semantic and Knowledge Representations in a Multi-Domain Dialogue System
- old r8 · human=3 · Internet Archive · Video Representation and Semantic Information Extraction using Ontology based Approaches
- old r9 · human=0 · OpenAlex Philosophy · Levinas, Meaning, and Philosophy of Social Science: From Ethical Metaphysics to Ontology and Epistemology
- old r10 · human=0 · OpenAlex Philosophy · Myth of Metaphysical Neutrality: How Denying Ontology Distorts Science, AI, and Understanding Itself

## de-10 — Ontologie in der Informatik

Top-10 overlap: **5/10** · changed=10 · already-human=3 · unresolved=7
Top-20 overlap: **10/20**
translation provenance in new Top 10: 5/10 · translation-only=5/10 · new-only via translation=5
known changed labels: old relevant=0/3 · new relevant=0/0 · net=0

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | ? | original-only | Crossref | Ontologie in der Informatik:original@1.00 | Ontologie und Weltbezug – vom philosophischen Weltverständnis zum Konstrukt der Informatik |
| 2 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology |
| 3 | 2 | shared | ? | original-only | Crossref | Ontologie in der Informatik:original@1.00 | Eine kurze Geschichte der Ontologie |
| 4 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | DTIC ADA515719: Uncertainty in Ontology Mapping: A Bayesian Perspective |
| 5 | 3 | shared | ? | original-only | Crossref | Ontologie in der Informatik:original@1.00 | Praxisgerechte Verwaltung der Ontologie |
| 6 | 4 | shared | ? | original-only | Crossref | Ontologie in der Informatik:original@1.00 | Kommentar zu P. Gerstl: Praxisgerechte Verwaltung der Ontologie |
| 7 | 5 | shared | 3 | original-only | Crossref | Ontologie in der Informatik:original@1.00 | Ontologie und Axiomatik der Wissensbasis von LILOG |
| 8 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | DTIC ADA624287: Dataset Curation through Renders and Ontology Matching |
| 9 | — | new-only | ? | translation-only | OpenAlex Philosophy | ontology in computer science:translation@0.90 | Ontology in Computer Science |
| 10 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | A Conceptual Model for Ontology Based Learning |

### Left previous Top 10

- old r6 · human=? · OpenAlex Philosophy · Von der Epistemologie zur Ontologie Martin Heideggers Hermeneutik der Freiheit im Diskurs mit Immanuel Kant
- old r7 · human=0 · OpenAlex Philosophy · Die Ontologie Mullā Ṣadrās und der Vorwurf der Ontotheologie Versuch einer Interpretation der Philosophie Mullā Ṣadrās im Lichte der Metaphysikkritik Heideggers
- old r8 · human=? · OpenAlex Philosophy · Nicolai Hartmanns Kritische Ontologie („wie sie als Grundlage der Gnoseologie anzustreben ist“) und der Kritische Realismus der Gestaltpsychologie („Berliner Schule“/Gestalttheorie)
- old r9 · human=0 · OpenAlex Philosophy · Ontologie der Innerlichkeit. Reditio Completa und Processio Interior bei Thomas von Aquinas by Reto L. Fetz
- old r10 · human=0 · OpenAlex Philosophy · Physik und Ontologie – oder Die 'Ontologiebeladenheit' der Epistemologie und die 'Realismusdebatte'

## fr-10 — ontologie en informatique

Top-10 overlap: **8/10** · changed=4 · already-human=1 · unresolved=3
Top-20 overlap: **10/20**
translation provenance in new Top 10: 2/10 · translation-only=2/10 · new-only via translation=2
known changed labels: old relevant=0/1 · new relevant=0/0 · net=0

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Conception et mise en œuvre d’une ontologie informatique en allergologie |
| 2 | 2 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Contrats en informatique |
| 3 | 3 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Recherche en informatique |
| 4 | 4 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Vers la définition automatique des éléments de données des fiches RCP en cancérologie à partir d’une ontologie |
| 5 | 5 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | La texture en informatique musicale symbolique |
| 6 | 6 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Les emprunts a l'Anglais en Francais informatique |
| 7 | 7 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Ecriture de contrats intelligents: essai de méthodologie en droit et en informatique |
| 8 | 8 | shared | ? | original-only | Crossref | ontologie en informatique:original@1.00 | Modèlisation et détection de la persévérance en milieu scolaire en contexte informatique |
| 9 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology |
| 10 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | DTIC ADA515719: Uncertainty in Ontology Mapping: A Bayesian Perspective |

### Left previous Top 10

- old r9 · human=? · Crossref · Valeurs propres et vecteurs propres en classification hiérarchique
- old r10 · human=1 · Internet Archive · Epistemology and Ontology of AI — From Lagrange and Hamilton Genre-Shift to Agentic AI Cognitive Safety: Open-Source Framework, LNN, HNN, PINN and SciML within the Dorian Codex H_SAFE by Stefano Dorian Franco — Independent Research Modules Programme

## pt-10 — ontologia em ciência da computação

Top-10 overlap: **8/10** · changed=4 · already-human=2 · unresolved=2
Top-20 overlap: **17/20**
translation provenance in new Top 10: 2/10 · translation-only=1/10 · new-only via translation=2
known changed labels: old relevant=0/2 · new relevant=0/0 · net=0

### New run Top 10

| new | old | status | human | route | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|---|
| 1 | 1 | shared | ? | original-only | Crossref | ontologia em ciência da computação:original@1.00 | UMA ABORDAGEM PARA ORQUESTRAÇÃO DO CONHECIMENTO COMO SUPORTE AO PLANEJAMENTO CURRICULAR EM CIÊNCIA DA COMPUTAÇÃO |
| 2 | 2 | shared | ? | original-only | Crossref | ontologia em ciência da computação:original@1.00 | ONTOLOGIA EM CIÊNCIA DA INFORMAÇÃO: Tecnologia e Aplicações Coleção Representação do conhecimento em Ciência da Informação Volume 2 |
| 3 | 3 | shared | 2 | original-only | Crossref | ontologia em ciência da computação:original@1.00 | ONTOLOGIA EM CIÊNCIA DA INFORMAÇÃO: Teoria e Método Coleção Representação do Conhecimento em Ciência da Informação Volume 01 |
| 4 | 4 | shared | 2 | original-only | Crossref | ontologia em ciência da computação:original@1.00 | ONTOLOGIA EM CIÊNCIA DA INFORMAÇÃO: ESTUDOS AVANÇADOS - VL 3 |
| 5 | 5 | shared | 1 | original-only | Crossref | ontologia em ciência da computação:original@1.00 | Ciência da Computação: Tecnologias Emergentes em Computação |
| 6 | 6 | shared | 0 | original-only | Crossref | ontologia em ciência da computação:original@1.00 | Fundamentos e Avanços em Ciência da Computação |
| 7 | 7 | shared | 0 | original-only | Crossref | ontologia em ciência da computação:original@1.00 | MONOGRAFIAS EM CIÊNCIA DA COMPUTAÇÃO |
| 8 | 8 | shared | 0 | original-only | Crossref | ontologia em ciência da computação:original@1.00 | Ciência da Computação: tecnologias emergentes em computação - Volume 2 |
| 9 | — | new-only | ? | translation-only | Internet Archive | ontology in computer science:translation@0.90 | Using Apache Jena Fuseki Server for Execution of SPARQL Queries in Job Search Ontology Using Semantic Technology |
| 10 | — | new-only | ? | original+translation | CUCSH Filosofía | ontologia em ciência da computação:original@1.00 \| ontology in computer science:translation@0.90 | El proyecto de una ciencia del origen en el joven Benjamin |

### Left previous Top 10

- old r9 · human=0 · CUCSH Filosofía · Kant y la relatividad. Sobre la idea de una “ontología de la experiencia”
- old r10 · human=0 · CUCSH Filosofía · Una ontología propiamente dicha

## Next audit requirement

For the exact paired human ΔP@10 between the expansion-fix run and multilingual-constraints-v1, **45** changed query-document pairs remain unlabeled. This is a development comparison because these query families informed the new multilingual design.

