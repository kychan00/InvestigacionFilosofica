# Interdisciplinary expansion-fix analysis

Structural comparison of the frozen Ranking v2 interdisciplinary Top-10/Top-20 against the real expansion-fix run. It does not infer relevance for unseen documents.

> Absolute human P@10 for both systems requires labels for every old/new Top-10 union pair. Exact paired ΔP@10 requires labels only for old-only/new-only pairs because shared Top-10 rows contribute equally and cancel in the difference.

## Summary

- queries: 10
- Top-10 shared query-document pairs: 67
- Top-10 union query-document pairs: 133
- mean Top-10 overlap per query: 6.7/10
- Top-10 union pairs already judged by human-audit-v1: 22
- Top-10 union pairs still needing human judgment for absolute old/new P@10: 111
- Top-10 changed pairs (old-only + new-only): 66
- changed pairs already judged by human-audit-v1: 8
- changed pairs still needing human judgment for exact paired ΔP@10: 58
- Top-20 shared query-document pairs: 128
- Top-20 union query-document pairs: 272
- mean Top-20 overlap per query: 12.8/20

## es-09 — fenomenología en enfermería

Top-10 overlap: **6/10** · union=14 · changed=8 · changed-human=0 · changed-unresolved=8
Top-20 overlap: **7/20** · union=33

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | ? | Crossref | fenomenología en enfermería:original@1.00 | La fenomenología, y su uso en la producción científica de enfermería: estudio bibliométrico 2010-2014 |
| 2 | 2 | shared | ? | Crossref | fenomenología en enfermería:original@1.00 | Contribuciones significativas de la fenomenología de Edmund Husserl, Martin Heidegger y Hans-Georg Gadamer a la investigación en enfermería |
| 3 | — | new-only | ? | Crossref | fenomenología en enfermería:original@1.00 | Aplicaciones de dispositivos móviles como estrategia de aprendizaje en estudiantes universitarios de enfermería. Una mirada desde la fenomenología crítica |
| 4 | 3 | shared | ? | CUCSH Filosofía | fenomenología en enfermería:original@1.00 | Algunas reflexiones sobre las herramientas técnicas de mediación en el proceso educativo musical y sus posibilidades de análisis a través de la fenomenología de Alfred Schütz |
| 5 | 4 | shared | ? | CUCSH Filosofía | fenomenología en enfermería:original@1.00 | Sobre la posibilidad de una “hermenéutica encarnada”. Institución, pasividad, prejuicio y tradición en la fenomenología tardía de Merleau-Ponty y la hermenéutica filosófica de Gadamer |
| 6 | 5 | shared | ? | OpenAlex Philosophy | fenomenología en enfermería:original@1.00 | Fenomenología y hermenéutica un gran atractivo de investigación en Enfermería |
| 7 | 6 | shared | ? | OpenAlex Philosophy | fenomenología en enfermería:original@1.00 | El cuidar en Enfermería desde la Fenomenología Hermenéutica |
| 8 | — | new-only | ? | Crossref | fenomenología en enfermería:original@1.00 | La interface entre la fenomenología y el cuidado de enfermería |
| 9 | — | new-only | ? | Crossref | fenomenología en enfermería:original@1.00 | Hacia un nuevo horizonte en ciencias de la educación: educación continua interdisciplinaria y sostenible en salud desde la fenomenología social |
| 10 | — | new-only | ? | Crossref | fenomenología en enfermería:original@1.00 | Fenomenología como método de investigación: Una opción para el profesional de enfermería |

### Left old Top 10

- old r7 · human=? · Crossref · Connectionism and Phenomenology
- old r8 · human=? · Crossref · Phenomenology and Cognitive Science
- old r9 · human=? · Crossref · Feminist Phenomenology
- old r10 · human=? · Crossref · Critical Phenomenology and Micro-Phenomenology

## en-09 — phenomenology in nursing

Top-10 overlap: **8/10** · union=12 · changed=4 · changed-human=1 · changed-unresolved=3
Top-20 overlap: **8/20** · union=32

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | 3 | Internet Archive | phenomenology in nursing:original@1.00 | Nursing and the experience of illness : phenomenology in practice |
| 2 | — | new-only | ? | Internet Archive | phenomenology in nursing:original@1.00 | Revisioning phenomenology : nursing and health science research |
| 3 | 2 | shared | ? | Crossref | phenomenology in nursing:original@1.00 | Phenomenology as research method or substantive metaphysics? An overview of phenomenology's uses in nursing |
| 4 | 3 | shared | ? | Internet Archive | phenomenology in nursing:original@1.00 | Interpretive phenomenology in health care research |
| 5 | 4 | shared | ? | Crossref | phenomenology in nursing:original@1.00 | Nursing and Phenomenology |
| 6 | 5 | shared | ? | Crossref | phenomenology in nursing:original@1.00 | Using Phenomenology as a Research Method in Community-Based Research |
| 7 | 7 | shared | ? | Crossref | phenomenology in nursing:original@1.00 | Phenomenology and nursing |
| 8 | 6 | shared | ? | Crossref | phenomenology in nursing:original@1.00 | Phenomenology and nursing |
| 9 | 8 | shared | 3 | Crossref | phenomenology in nursing:original@1.00 | Walt Whitman, Nursing, and Phenomenology |
| 10 | — | new-only | ? | OpenAlex Philosophy | phenomenology in nursing:original@1.00 | Phenomenology in nursing research: reflection based on Heidegger’s hermeneutics |

### Left old Top 10

- old r9 · human=? · Crossref · Connectionism and Phenomenology
- old r10 · human=0 · Crossref · Phenomenology and Cognitive Science

## de-09 — Phänomenologie in der Pflege

Top-10 overlap: **10/10** · union=10 · changed=0 · changed-human=0 · changed-unresolved=0
Top-20 overlap: **20/20** · union=20

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | ? | Crossref | Phänomenologie in der Pflege:original@1.00 | Intuition und Wahrnehmung als Grundlage in der palliativen Pflege – das Konzept der leiblichen Phänomenologie in Praxis und Bildung |
| 2 | 2 | shared | ? | Crossref | Phänomenologie in der Pflege:original@1.00 | Auf die Situation kommt es an – Beziehung und Berührung in der Pflege |
| 3 | 3 | shared | ? | OpenAlex Philosophy | Phänomenologie in der Pflege:original@1.00 | Heidegger's Appropriation of the Concept of Intentionality in Die Grundprobleme der Phanomenologie |
| 4 | 4 | shared | ? | OpenAlex Philosophy | Phänomenologie in der Pflege:original@1.00 | Gabriel Cercel: Martin HEIDEGGER, Reden und andere Zeugnisse eines Lebensweges; Attila Szigeti: Emmanuel LEVINAS, Positivité et transcendance. Suivi de Lévinas et la phenomenology; Cristian Ciocan: Jean-Luc MARION, Crucea vizibilului; Gabriel Cercel: Mądąlina DIACONU, Blickumkehr. Mit Martin Heidegger zu einer relationalen ästhetik; Cristina Ionescu: Mark WRATHALL, Jeff MALPAS (eds.), Essays in Honour of Hubert L. Dreyfus; Cristian Ciocan: Ion COPOERU, Aparenţą şi sens. Repere ale fenomenologiei constitutive; Cristian Ciocan: Michael INWOOD, A Heidegger Dictionary; Cristian Ciocan: Linda FISCHER, Lester EMBREE (eds.), Feminist Phenomenology; Mądąlina Diaconu: Renato CRISTIN, Fenomeno storia. Fenomenologia e storicità in Husserl e Dilthey; Cristian Ciocan: Michel HAAR, La philosophie française entre phénoménologie et métaphysique; Gabriel Cercel: Otto PöGGELER, Heidegger in seiner Zeit; Roxana Albu: James RISSER (ed.), Heidegger toward the Turn, Essays on the work of the 1930s; Cristian Ciocan: Virgil Ciomoş, Timp şi Eternitate. Aristotel, Fizica IV 10-14, Interpretare fenomenologicą; Cristina Ionescu: William D. BLATTNER, Heidegger's Temporal Idealism; Bogdan Mincą: Gino ZACCARIA, L'inizio greco del pensiero. Heidegger e l'essenza futura della filosofia; Mądąlina Diaconu: Ute GUZZONI, Wohnen und Wandern; Bogdan Tątaru-Cazaban: Emmanuel LéVINAS, Totalitate şi infinit; Mihail Neamţu: Jean-Luc MARION, étant donné. Essai d'une phénoménologie de la donation; Gabriel Cercel: Robert PETKOVŠEK, Heidegger-Index (1919-1927); Cristian Ciocan: Einar ØVERENGET, Seeing The Self. Heidegger on Subjectivity Mihail Neamţu: Rolf KüHN, Husserls Begriff der Passivität. Zur Kritik der passiven Synthesis in der genetischen Phänomenologie. |
| 5 | 5 | shared | ? | OpenAlex Philosophy | Phänomenologie in der Pflege:original@1.00 | Das Selbst und die Gegenwart der Verantwortung. Über das Verantwortungskonzept in der hermeneutischen Phänomenologie von Paul Ricœur |
| 6 | 6 | shared | ? | OpenAlex Philosophy | Phänomenologie in der Pflege:original@1.00 | Das Experiment bei Husserl. Zum Verhältnis von Empirie und Eidetik in der Phänomenologie |
| 7 | 7 | shared | ? | Crossref | Phänomenologie in der Pflege:original@1.00 | Dialogische Phänomenologie im Rahmen der Pflegewissenschaft – Eine kritische Auseinandersetzung mit einer wenig bekannten Forschungsmethode |
| 8 | 8 | shared | 2 | Crossref | Phänomenologie in der Pflege:original@1.00 | Qualitative Gesundheitsforschung aus Sicht der Neuen Phänomenologie |
| 9 | 9 | shared | ? | Crossref | Phänomenologie in der Pflege:original@1.00 | Idee einer Phänomenologie der Hoffnung |
| 10 | 10 | shared | ? | Crossref | Phänomenologie in der Pflege:original@1.00 | Der Sinn der Phänomenologie: Eine methodologische Reflexion |

### Left old Top 10

- none

## fr-09 — phénoménologie en soins infirmiers

Top-10 overlap: **10/10** · union=10 · changed=0 · changed-human=0 · changed-unresolved=0
Top-20 overlap: **20/20** · union=20

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | De l’intérêt de la phénoménologie pour la mise en évidence de l’expertise infirmière et le développement de connaissances en soins infirmiers |
| 2 | 3 | shared | 0 | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 3 | 2 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 4 | 4 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 5 | 6 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 6 | 5 | shared | 0 | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 7 | 8 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 8 | 7 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 9 | 10 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |
| 10 | 9 | shared | ? | Crossref | phénoménologie en soins infirmiers:original@1.00 | Hypnose en soins infirmiers |

### Left old Top 10

- none

## pt-09 — fenomenologia na enfermagem

Top-10 overlap: **6/10** · union=14 · changed=8 · changed-human=0 · changed-unresolved=8
Top-20 overlap: **7/20** · union=33

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | 3 | Crossref | fenomenologia na enfermagem:original@1.00 | O ensino de enfermagem em saúde mental e psiquiátrica: visão do professor e do aluno na perspectiva da fenomenologia social |
| 2 | 2 | shared | ? | Crossref | fenomenologia na enfermagem:original@1.00 | CONTRIBUIÇÕES DA FENOMENOLOGIA PARA A PRÁTICA DA ENFERMAGEM NA SAÚDE DA MULHER |
| 3 | 3 | shared | ? | Crossref | fenomenologia na enfermagem:original@1.00 | A presença da fenomenologia na investigação em enfermagem: mapeamento das teses de doutoramento em Portugal |
| 4 | 4 | shared | ? | Crossref | fenomenologia na enfermagem:original@1.00 | Brinquedo terapêutico: percepção da equipe de enfermagem na perspectiva da fenomenologia social |
| 5 | 5 | shared | ? | Crossref | fenomenologia na enfermagem:original@1.00 | Na trilha da fenomenologia: um caminho para a pesquisa em enfermagem |
| 6 | 6 | shared | ? | OpenAlex Philosophy | fenomenologia na enfermagem:original@1.00 | Cuidado de enfermagem em terapia intensiva cardiológica: hermenêutica do conceito fundamentada na fenomenologia heideggeriana |
| 7 | — | new-only | ? | Crossref | fenomenologia na enfermagem:original@1.00 | SOBRE FENOMENOLOGIA, FENOMENOLOGIA EXISTENCIAL E ENFERMAGEM PSIQUIATRICA |
| 8 | — | new-only | ? | Crossref | fenomenologia na enfermagem:original@1.00 | Fenomenologia: uma alternativa para pesquisa em enfermagem |
| 9 | — | new-only | ? | Crossref | fenomenologia na enfermagem:original@1.00 | Figuras do direito na Fenomenologia do Espírito: a fenomenologia como doutrina do espírito objetivo? |
| 10 | — | new-only | ? | Crossref | fenomenologia na enfermagem:original@1.00 | Enfermagem psiquiátrica e fenomenologia: algumas considerações |

### Left old Top 10

- old r7 · human=? · Crossref · Connectionism and Phenomenology
- old r8 · human=? · Crossref · Phenomenology and Cognitive Science
- old r9 · human=? · Crossref · Feminist Phenomenology
- old r10 · human=? · Crossref · Critical Phenomenology and Micro-Phenomenology

## es-10 — ontología en informática

Top-10 overlap: **2/10** · union=18 · changed=16 · changed-human=3 · changed-unresolved=13
Top-20 overlap: **9/20** · union=31

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 2 | shared | ? | Crossref | ontología en informática:original@1.00 | Autoconstitución y libertad Ontología y política en Espinosa III |
| 2 | 10 | shared | 0 | Crossref | ontología en informática:original@1.00 | Origen de la ontología jurídica en el pensamiento griego |
| 3 | — | new-only | ? | Crossref | ontología en informática:original@1.00 | Lógica y ontología en Aristóteles / |
| 4 | — | new-only | ? | Crossref | ontología en informática:original@1.00 | Ontología en América Latina. Fase 1: Ontología Existencial |
| 5 | — | new-only | ? | Crossref | ontología en informática:original@1.00 | Ontología de la finitud en Ernildo Stein |
| 6 | — | new-only | ? | Crossref | ontología en informática:original@1.00 | Ontología política de la voluntad en Enrique Dussel |
| 7 | — | new-only | ? | CUCSH Filosofía | ontología en informática:original@1.00 | Una ontología propiamente dicha |
| 8 | — | new-only | ? | CUCSH Filosofía | ontología en informática:original@1.00 | Kant y la relatividad. Sobre la idea de una “ontología de la experiencia” |
| 9 | — | new-only | ? | CUCSH Filosofía | ontología en informática:original@1.00 | Abismando formaciones discursivas, entrecruces del ser maya ch´ol versus ser alguien en la vida |
| 10 | — | new-only | ? | CUCSH Filosofía | ontología en informática:original@1.00 | Museología y trascendencia en el hiperrealismo de William Fisk |

### Left old Top 10

- old r1 · human=0 · Internet Archive · The metaphysics of Sir William Hamilton
- old r3 · human=? · Crossref · Metaphysics
- old r4 · human=? · Crossref · Metaphysics
- old r5 · human=0 · Crossref · Postmodal Metaphysics and Structuralism
- old r6 · human=? · Crossref · Metaphysics of Science as Naturalized Metaphysics
- old r7 · human=? · Crossref · Aristotle's Metaphysics, Vol. 2
- old r8 · human=0 · Crossref · METAPHYSICS AND INTERDISCIPLINARY MODELS
- old r9 · human=? · Crossref · 7. Criticism of Metaphysics

## en-10 — ontology in computer science

Top-10 overlap: **1/10** · union=19 · changed=18 · changed-human=3 · changed-unresolved=15
Top-20 overlap: **8/20** · union=32

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 3 | shared | ? | OpenAlex Philosophy | ontology in computer science:original@1.00 | Ontology in Computer Science |
| 2 | — | new-only | ? | OpenAlex Philosophy | ontology in computer science:original@1.00 | von Leibniz'Metaphysik (2001), Leibniz: Metaphilosophy and Metaphysics, 1666–1686 (2005), and Biomedical Ontology and the Metaphysics of Composite Substances, 1540–1670 (2010). Martin Campbell-Kelly is emeritus professor in the Department of Com-puter Science at the University of Warwick, where he specializes in the |
| 3 | — | new-only | ? | OpenAlex Philosophy | ontology in computer science:original@1.00 | A Consciousness-First Ontology in the Long Arc of Science and Mysticism: The Unified Play of Consciousness (UPC) in Historical and Scientific |
| 4 | — | new-only | ? | OpenAlex Philosophy | ontology in computer science:original@1.00 | Th eology as the science of existence and philosophy as the science of being in the fundamental ontology of M. Heidegger |
| 5 | — | new-only | ? | Crossref | ontology in computer science:original@1.00 | Using a trope-based foundational ontology for bridging different areas of concern in ontology-driven conceptual modeling |
| 6 | — | new-only | ? | Internet Archive | ontology in computer science:original@1.00 | DTIC ADA534412: Linking Semantic and Knowledge Representations in a Multi-Domain Dialogue System |
| 7 | — | new-only | ? | Crossref | ontology in computer science:original@1.00 | Ontology segmentation in ontology matching |
| 8 | — | new-only | ? | Internet Archive | ontology in computer science:original@1.00 | Video Representation and Semantic Information Extraction using Ontology based Approaches |
| 9 | — | new-only | ? | OpenAlex Philosophy | ontology in computer science:original@1.00 | Levinas, Meaning, and Philosophy of Social Science: From Ethical Metaphysics to Ontology and Epistemology |
| 10 | — | new-only | ? | OpenAlex Philosophy | ontology in computer science:original@1.00 | Myth of Metaphysical Neutrality: How Denying Ontology Distorts Science, AI, and Understanding Itself |

### Left old Top 10

- old r1 · human=? · Internet Archive · The metaphysics of Sir William Hamilton
- old r2 · human=? · Crossref · Metaphysics of Science as Naturalized Metaphysics
- old r4 · human=? · Crossref · Metaphysics
- old r5 · human=? · Crossref · Metaphysics
- old r6 · human=? · Crossref · Postmodal Metaphysics and Structuralism
- old r7 · human=? · Crossref · Aristotle's Metaphysics, Vol. 2
- old r8 · human=0 · Crossref · 7. Criticism of Metaphysics
- old r9 · human=0 · Internet Archive · The Dimensional Lattice: A Mathematical Framework for Consciousness Emergence and Coherence Dynamics
- old r10 · human=0 · Internet Archive · Harmonies of Nature, in Three Volumes, Vol. I

## de-10 — Ontologie in der Informatik

Top-10 overlap: **10/10** · union=10 · changed=0 · changed-human=0 · changed-unresolved=0
Top-20 overlap: **20/20** · union=20

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | ? | Crossref | Ontologie in der Informatik:original@1.00 | Ontologie und Weltbezug – vom philosophischen Weltverständnis zum Konstrukt der Informatik |
| 2 | 2 | shared | ? | Crossref | Ontologie in der Informatik:original@1.00 | Eine kurze Geschichte der Ontologie |
| 3 | 3 | shared | ? | Crossref | Ontologie in der Informatik:original@1.00 | Praxisgerechte Verwaltung der Ontologie |
| 4 | 4 | shared | ? | Crossref | Ontologie in der Informatik:original@1.00 | Kommentar zu P. Gerstl: Praxisgerechte Verwaltung der Ontologie |
| 5 | 5 | shared | 3 | Crossref | Ontologie in der Informatik:original@1.00 | Ontologie und Axiomatik der Wissensbasis von LILOG |
| 6 | 6 | shared | ? | OpenAlex Philosophy | Ontologie in der Informatik:original@1.00 | Von der Epistemologie zur Ontologie Martin Heideggers Hermeneutik der Freiheit im Diskurs mit Immanuel Kant |
| 7 | 7 | shared | 0 | OpenAlex Philosophy | Ontologie in der Informatik:original@1.00 | Die Ontologie Mullā Ṣadrās und der Vorwurf der Ontotheologie Versuch einer Interpretation der Philosophie Mullā Ṣadrās im Lichte der Metaphysikkritik Heideggers |
| 8 | 8 | shared | ? | OpenAlex Philosophy | Ontologie in der Informatik:original@1.00 | Nicolai Hartmanns Kritische Ontologie („wie sie als Grundlage der Gnoseologie anzustreben ist“) und der Kritische Realismus der Gestaltpsychologie („Berliner Schule“/Gestalttheorie) |
| 9 | 9 | shared | 0 | OpenAlex Philosophy | Ontologie in der Informatik:original@1.00 | Ontologie der Innerlichkeit. Reditio Completa und Processio Interior bei Thomas von Aquinas by Reto L. Fetz |
| 10 | 10 | shared | 0 | OpenAlex Philosophy | Ontologie in der Informatik:original@1.00 | Physik und Ontologie – oder Die 'Ontologiebeladenheit' der Epistemologie und die 'Realismusdebatte' |

### Left old Top 10

- none

## fr-10 — ontologie en informatique

Top-10 overlap: **10/10** · union=10 · changed=0 · changed-human=0 · changed-unresolved=0
Top-20 overlap: **20/20** · union=20

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 1 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Conception et mise en œuvre d’une ontologie informatique en allergologie |
| 2 | 2 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Contrats en informatique |
| 3 | 3 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Recherche en informatique |
| 4 | 4 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Vers la définition automatique des éléments de données des fiches RCP en cancérologie à partir d’une ontologie |
| 5 | 5 | shared | ? | Crossref | ontologie en informatique:original@1.00 | La texture en informatique musicale symbolique |
| 6 | 6 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Les emprunts a l'Anglais en Francais informatique |
| 7 | 7 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Ecriture de contrats intelligents: essai de méthodologie en droit et en informatique |
| 8 | 8 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Modèlisation et détection de la persévérance en milieu scolaire en contexte informatique |
| 9 | 9 | shared | ? | Crossref | ontologie en informatique:original@1.00 | Valeurs propres et vecteurs propres en classification hiérarchique |
| 10 | 10 | shared | 1 | Internet Archive | ontologie en informatique:original@1.00 | Epistemology and Ontology of AI — From Lagrange and Hamilton Genre-Shift to Agentic AI Cognitive Safety: Open-Source Framework, LNN, HNN, PINN and SciML within the Dorian Codex H_SAFE by Stefano Dorian Franco — Independent Research Modules Programme |

### Left old Top 10

- none

## pt-10 — ontologia em ciência da computação

Top-10 overlap: **4/10** · union=16 · changed=12 · changed-human=1 · changed-unresolved=11
Top-20 overlap: **9/20** · union=31

### New run Top 10

| new | old | status | human | providers | matchedQueries | title |
|---:|---:|---|---:|---|---|---|
| 1 | 2 | shared | ? | Crossref | ontologia em ciência da computação:original@1.00 | UMA ABORDAGEM PARA ORQUESTRAÇÃO DO CONHECIMENTO COMO SUPORTE AO PLANEJAMENTO CURRICULAR EM CIÊNCIA DA COMPUTAÇÃO |
| 2 | 3 | shared | ? | Crossref | ontologia em ciência da computação:original@1.00 | ONTOLOGIA EM CIÊNCIA DA INFORMAÇÃO: Tecnologia e Aplicações Coleção Representação do conhecimento em Ciência da Informação Volume 2 |
| 3 | 4 | shared | 2 | Crossref | ontologia em ciência da computação:original@1.00 | ONTOLOGIA EM CIÊNCIA DA INFORMAÇÃO: Teoria e Método Coleção Representação do Conhecimento em Ciência da Informação Volume 01 |
| 4 | 5 | shared | 2 | Crossref | ontologia em ciência da computação:original@1.00 | ONTOLOGIA EM CIÊNCIA DA INFORMAÇÃO: ESTUDOS AVANÇADOS - VL 3 |
| 5 | — | new-only | ? | Crossref | ontologia em ciência da computação:original@1.00 | Ciência da Computação: Tecnologias Emergentes em Computação |
| 6 | — | new-only | ? | Crossref | ontologia em ciência da computação:original@1.00 | Fundamentos e Avanços em Ciência da Computação |
| 7 | — | new-only | ? | Crossref | ontologia em ciência da computação:original@1.00 | MONOGRAFIAS EM CIÊNCIA DA COMPUTAÇÃO |
| 8 | — | new-only | ? | Crossref | ontologia em ciência da computação:original@1.00 | Ciência da Computação: tecnologias emergentes em computação - Volume 2 |
| 9 | — | new-only | ? | CUCSH Filosofía | ontologia em ciência da computação:original@1.00 | Kant y la relatividad. Sobre la idea de una “ontología de la experiencia” |
| 10 | — | new-only | ? | CUCSH Filosofía | ontologia em ciência da computação:original@1.00 | Una ontología propiamente dicha |

### Left old Top 10

- old r1 · human=? · Internet Archive · The metaphysics of Sir William Hamilton
- old r6 · human=? · Crossref · Metaphysics
- old r7 · human=? · Crossref · Postmodal Metaphysics and Structuralism
- old r8 · human=? · Crossref · Metaphysics
- old r9 · human=0 · Crossref · Metaphysics of Science as Naturalized Metaphysics
- old r10 · human=? · Crossref · Aristotle's Metaphysics, Vol. 2

## Audit requirement

For absolute old/new human P@10, **111** union pairs remain unresolved. For the exact paired human **ΔP@10**, only **58** changed pairs remain unresolved because shared Top-10 rows cancel.
