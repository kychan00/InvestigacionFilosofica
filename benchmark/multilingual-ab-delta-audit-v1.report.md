# Held-out multilingual A/B paired human delta

Exact paired human Top-10 delta for the frozen held-out A/B run. Shared A/B Top-10 rows cancel; every row in the symmetric difference was judged blind to condition, rank, provider, score, and translation provenance.

> This is an internal held-out validation with one human adjudicator. A/B conditions were run consecutively with alternating order, reducing but not eliminating live-provider variability. English queries are drift controls because their logical expansion is unchanged.

## Summary

- changed Top-10 query-document pairs judged: 68
- judgments with comments: 68/68
- relevant A-only positions: 9
- relevant B-only positions: 20
- net relevant positions: +11
- exact paired human ΔP@10 (B−A): +0.055
- ordinal relevance A-only → B-only: 36 → 58 (Δ +22)
- improved/worsened/tied queries: 4/1/15
- B-only rows with translation provenance: 34; relevant=20; rate=0.5882
- B-only translation-only rows: 30; relevant=20; rate=0.6667

## English drift controls vs non-English targets

- English controls (4 queries): ΔP@10=+0; net relevant=+0
- Non-English targets (16 queries): ΔP@10=+0.0688; net relevant=+11

## By language

| language | queries | A-only rel | B-only rel | net | paired ΔP@10 |
|---|---:|---:|---:|---:|---:|
| es | 4 | 1 | 2 | +1 | +0.025 |
| en | 4 | 0 | 0 | +0 | +0 |
| de | 4 | 2 | 7 | +5 | +0.125 |
| fr | 4 | 3 | 8 | +5 | +0.125 |
| pt | 4 | 3 | 3 | +0 | +0 |

## By family

| family | queries | A-only rel | B-only rel | net | paired ΔP@10 |
|---|---:|---:|---:|---:|---:|
| ethics-artificial-intelligence | 5 | 2 | 2 | +0 | +0 |
| epistemology-psychology | 5 | 4 | 4 | +0 | +0 |
| philosophy-science-physics | 5 | 3 | 14 | +11 | +0.22 |
| logic-linguistics | 5 | 0 | 0 | +0 | +0 |

## Per query

| query | lang | control | changed/side | A rel | B rel | Δ rel | paired ΔP@10 | B translation rel/total |
|---|---|---|---:|---:|---:|---:|---:|---:|
| val-es-01 · ética en inteligencia artificial | es | no | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-en-01 · ethics in artificial intelligence | en | yes | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-de-01 · Ethik in der künstlichen Intelligenz | de | no | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-fr-01 · éthique en intelligence artificielle | fr | no | 1 | 1 | 1 | +0 | +0 | 1/1 |
| val-pt-01 · ética em inteligência artificial | pt | no | 1 | 1 | 1 | +0 | +0 | 1/1 |
| val-es-02 · epistemología en psicología | es | no | 2 | 1 | 1 | +0 | +0 | 1/2 |
| val-en-02 · epistemology in psychology | en | yes | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-de-02 · Epistemologie in der Psychologie | de | no | 4 | 0 | 1 | +1 | +0.1 | 1/4 |
| val-fr-02 · épistémologie en psychologie | fr | no | 2 | 2 | 1 | -1 | -0.1 | 1/2 |
| val-pt-02 · epistemologia em psicologia | pt | no | 2 | 1 | 1 | +0 | +0 | 1/2 |
| val-es-03 · filosofía de la ciencia en física | es | no | 1 | 0 | 1 | +1 | +0.1 | 1/1 |
| val-en-03 · philosophy of science in physics | en | yes | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-de-03 · Wissenschaftstheorie in der Physik | de | no | 7 | 2 | 6 | +4 | +0.4 | 6/7 |
| val-fr-03 · philosophie des sciences en physique | fr | no | 7 | 0 | 6 | +6 | +0.6 | 6/7 |
| val-pt-03 · filosofia da ciência em física | pt | no | 1 | 1 | 1 | +0 | +0 | 1/1 |
| val-es-04 · lógica en lingüística | es | no | 3 | 0 | 0 | +0 | +0 | 0/3 |
| val-en-04 · logic in linguistics | en | yes | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-de-04 · Logik in der Linguistik | de | no | 0 | 0 | 0 | +0 | +0 | 0/0 |
| val-fr-04 · logique en linguistique | fr | no | 2 | 0 | 0 | +0 | +0 | 0/2 |
| val-pt-04 · lógica em linguística | pt | no | 1 | 0 | 0 | +0 | +0 | 0/1 |

## Human comments on changed documents

A/B side and translation provenance are revealed only after the blind audit was finalized.

### val-fr-01 — éthique en intelligence artificielle

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 10 | 2 | — | Presentation Media of the Book: Dorian Codex Protocol For Artificial Intelligence By Stefano Dorian Franco | La ética y el alineamiento son componentes sustantivos del protocolo, pero el documento se centra más ampliamente en estabilidad cognitiva, coherencia y arquitectura de IA. |
| B-only | 10 | 3 | translation-only | To The Artificial Intelligence Of The Future | Propone explícitamente principios éticos y de responsabilidad para futuros sistemas de inteligencia artificial. |

### val-pt-01 — ética em inteligência artificial

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 10 | 3 | — | Inteligência Artificial na Educação: Proposta de um Framework para Adoção Ética | Propone directamente un marco de adopción ética de IA basado en privacidad, transparencia, justicia, supervisión humana, responsabilidad e inclusión. |
| B-only | 7 | 3 | translation-only | To The Artificial Intelligence Of The Future | Propone explícitamente principios éticos y de responsabilidad para el diseño y comportamiento de futuros sistemas de inteligencia artificial. |

### val-es-02 — epistemología en psicología

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 9 | 2 | — | Formación en Psicología Comunitaria | Aborda explícitamente los componentes epistémicos de la Psicología Comunitaria dentro del análisis de su formación posgradual y competencias. |
| A-only | 10 | 1 | — | Formación posgradual en Psicología Organizacional y del trabajo | Capítulo sobre delimitación disciplinar, formación y competencias en Psicología Organizacional y del Trabajo; la dimensión epistemológica pertenece al marco general del volumen, pero no es su foco principal. |
| B-only | 6 | 2 | translation-only | Inductive inference and its natural ground : an essay in naturalistic epistemology | Desarrolla epistemología naturalizada apoyándose sustantivamente en capacidades psicológicas humanas, aunque su objeto principal es la inferencia inductiva. |
| B-only | 8 | 0 | translation-only | ERIC ED466631: Explanation, Justification and Argumentation in Mathematics Classrooms. | Analiza procesos de razonamiento y justificación en educación matemática, no epistemología de la psicología. |

### val-de-02 — Epistemologie in der Psychologie

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 7 | 1 | — | 4. Funktionen des Erzählens II: Epistemologie der Narratologie | Desarrolla una epistemología de la narratología y del conocimiento narrativo, no una epistemología de la psicología. |
| A-only | 8 | 1 | — | Historische Epistemologie der Strukturwissenschaften | Desarrolla una epistemología histórica de ciencias estructurales como cibernética, informática, teoría de la información e IA, no de la psicología. |
| A-only | 9 | 1 | — | Von der Epistemologie zur Ontologie Martin Heideggers Hermeneutik der Freiheit im Diskurs mit Immanuel Kant | Aborda epistemología y ontología en Kant y Heidegger, pero no epistemología aplicada a la psicología. |
| A-only | 10 | 1 | — | Der gute Mensch. Epistemologie und Rhetorik im 18. Jahrhundert (Baumgarten – Sulzer – Kant) | La epistemología es central, pero se estudia en relación con antropología, retórica, estética y pedagogía del siglo XVIII, no con la psicología como disciplina. |
| B-only | 2 | 2 | translation-only | Inductive inference and its natural ground : an essay in naturalistic epistemology | Desarrolla epistemología naturalizada apoyándose sustantivamente en capacidades psicológicas humanas, aunque su objeto principal es la inferencia inductiva. |
| B-only | 3 | 0 | translation-only | ERIC ED466631: Explanation, Justification and Argumentation in Mathematics Classrooms. | Analiza explicación y justificación en aulas de matemáticas desde una perspectiva sociocultural; no trata epistemología de la psicología. |
| B-only | 5 | 0 | translation-only | ERIC ED389230: The Discontinuity of Human Existence, Part I. The Fundamental Concepts of Human Existence and the Relation between the Singular and the Super Singular. No. 50. | Incluye referencias a psicología cognitiva y teorías psicológicas, pero su objeto es filosófico-antropológico y no la epistemología de la psicología. |
| B-only | 10 | 1 | translation-only | Descriptor revision : belief change through direct choice | Estudia formalmente el cambio de creencias desde lógica y epistemología, pero no la epistemología de la psicología como disciplina. |

### val-fr-02 — épistémologie en psychologie

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 9 | 2 | — | Épistémologie et méthodologie en psychanalyse et en psychiatrie | Aborda directamente problemas epistemológicos y metodológicos del psicoanálisis, la psiquiatría y su relación con neurociencias y psicología, aunque no se centra exclusivamente en psicología. |
| A-only | 10 | 2 | — | Épistémologie et méthodologie en psychanalyse et en psychiatrie | Aborda directamente problemas epistemológicos del estudio de la psique desde psicoanálisis, psiquiatría, psicología y neurociencias, pero con un alcance interdisciplinario. |
| B-only | 1 | 2 | translation-only | Inductive inference and its natural ground : an essay in naturalistic epistemology | Integra sustantivamente psicología cognitiva en una teoría epistemológica naturalizada de la inducción. |
| B-only | 2 | 0 | translation-only | ERIC ED466631: Explanation, Justification and Argumentation in Mathematics Classrooms. | Analiza razonamiento y justificación en educación matemática; no aborda epistemología de la psicología. |

### val-pt-02 — epistemologia em psicologia

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 9 | 2 | — | GEPEGE – Grupo de Estudo e Pesquisa em Epistemologia Genética e Educação | Presenta un grupo dedicado a Epistemología Genética, Psicología Genética y Educación; la relación epistemología-psicología es sustantiva, aunque el documento se centra en el propio grupo de investigación. |
| A-only | 10 | 1 | — | EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET | Se inscribe en la tradición de psicología y epistemología genéticas de Piaget, pero el artículo se centra específicamente en psicología moral y juicio moral. |
| B-only | 7 | 2 | translation-only | Inductive inference and its natural ground : an essay in naturalistic epistemology | Desarrolla una epistemología naturalizada de la inducción apoyándose sustantivamente en capacidades cognitivas y resultados de la psicología, aunque su objeto principal es epistemológico. |
| B-only | 8 | 0 | translation-only | ERIC ED466631: Explanation, Justification and Argumentation in Mathematics Classrooms. | Analiza explicación y justificación en educación matemática; no estudia la epistemología de la psicología. |

### val-es-03 — filosofía de la ciencia en física

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 10 | 1 | — | La problemática ecologista en la filosofía de la ciencia de Manuel Sacristán | Analiza ecologismo y filosofía de la ciencia en Manuel Sacristán, pero no la filosofía de la física específicamente. |
| B-only | 6 | 2 | translation-only | The Art of Science : From Perspective Drawing to Quantum Randomness | Aborda sustantivamente cuestiones filosóficas e históricas de la física cuántica dentro de un marco interdisciplinario más amplio sobre arte, matemáticas y ciencia. |

### val-de-03 — Wissenschaftstheorie in der Physik

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 4 | 0 | — | Some Recent Literature of Philosophy<i>Fragments in Philosophy and Science</i>. James Mark Baldwin<i>The Limits of Evolution and Other Essays, Illustrating the Metaphysical Theory of Personal Idealism</i>. G. H. Howison<i>Elemente der Metaphysik</i>. Paul Deussen<i>Geschichte der Philosophie</i>. Karl Vorländer<i>Immanuel Kant: His Life and Doctrine</i>. Friedrich Paulsen , J. E. Creighton , Albert Lefevre<i>The Philosophy of Religion in England and America</i>. Alfred Caldecott | Sección general de reseñas de literatura filosófica; no aborda filosofía o teoría de la ciencia en física. |
| A-only | 5 | 0 | — | »Gott, Mensch und Welt in der Metaphysik von Descartes bis zu Nietzsche« (1967) | Estudio histórico-metafísico sobre Dios, ser humano y mundo; no aborda la filosofía de la ciencia ni los fundamentos epistemológicos de la física. |
| A-only | 6 | 0 | — | Realität als vermeintliche Grenze der Erkenntnis: Hegels Metaphysik im Anschluss an und in Abgrenzung zu Kant | Analiza metafísica y teoría del conocimiento en Hegel y Kant; no aborda la filosofía de la ciencia ni los fundamentos de la física. |
| A-only | 7 | 0 | — | Roland Bothner Fremdgesteuertes Sein, Philosophie der Technik, herausgegeben von Stefanie Bielmeier | Es una filosofía general de la técnica y sus relaciones con ciencia y sociedad; no estudia específicamente los fundamentos epistemológicos de la física. |
| A-only | 8 | 3 | — | Physik am normativen Gängelband? | Analiza directamente, desde la teoría de la ciencia, la relación entre protophysics y física empírica. |
| A-only | 9 | 0 | — | Phänomenologie als Urwissenschaft und neue “Metaphysik der Metaphysik”. Die systematische Genealogie von Heideggers philosophischen Anfängen | Analiza la fenomenología temprana de Heidegger como “ciencia originaria” y su desarrollo ontológico; no aborda filosofía de la física. |
| A-only | 10 | 2 | — | Von der mathematischen zur kritischen Metaphysik der Natur. Lambert und Kant | Analiza la metafísica kantiana de la naturaleza y su relación crítica con la física newtoniana, incluyendo fuerzas de atracción, repulsión y gravitación. |
| B-only | 1 | 2 | translation-only | The Art of Science : From Perspective Drawing to Quantum Randomness | Aborda de forma sustantiva cuestiones históricas y filosóficas sobre representación, observabilidad y fundamentos de la física cuántica, aunque el volumen tiene un alcance interdisciplinario más amplio. |
| B-only | 5 | 2 | translation-only | Holism in philosophy of mind and philosophy of physics | Reseña una obra que analiza extensamente el holismo en física cuántica y espacio-tiempo, aunque comparte el foco con filosofía de la mente. |
| B-only | 6 | 3 | translation-only | Philosophy of Physics | Capítulo directamente dedicado a los fundamentos conceptuales, epistemológicos y metodológicos de la física. |
| B-only | 7 | 3 | translation-only | The philosophy of physics | Trabajo directamente dedicado a filosofía de la física, publicado en una revista especializada en historia y filosofía de la física moderna. |
| B-only | 8 | 3 | translation-only | More than the conscience of physics? From physics to philosophy | Reseña una obra dedicada explícitamente a la filosofía y los fundamentos de la física moderna, especialmente de la teoría cuántica. |
| B-only | 9 | 3 | translation-only | Time in fundamental physics | Analiza filosófica y conceptualmente la noción de tiempo en mecánica, relatividad y física cuántica como problema fundamental de la física. |
| B-only | 10 | 1 | translation-only | Story Of Physics | Historia general de las ideas y descubrimientos de la física; la teoría de la ciencia no constituye su objeto sustantivo. |

### val-fr-03 — philosophie des sciences en physique

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 4 | 0 | — | Concepto en el habitar | Estudia filosóficamente la formación y naturaleza de los conceptos desde cognición 4E y filosofía del lenguaje; no aborda filosofía de la física. |
| A-only | 5 | 0 | — | Influencia de la filosofía del romanticismo en el arte contemporáneo | Estudia estética romántica y su influencia en el arte contemporáneo; no aborda filosofía de la ciencia ni física. |
| A-only | 6 | 1 | — | Societe Fran�aise De Logique Et De Philosophie Des Sciences | Informe sobre la Société Française de Logique et de Philosophie des Sciences; relacionado con filosofía de la ciencia, pero no específicamente con filosofía de la física. |
| A-only | 7 | 1 | — | Sur les buts et la methode de la philosophie des sciences | Está directamente dedicado a la metodología y fines de la filosofía de la ciencia en general, pero no específicamente a la filosofía de la física. |
| A-only | 8 | 1 | — | Du Rapport des Sciences avec la Philosophie | Estudia epistemología científica y las relaciones generales entre ciencia y filosofía; la física aparece dentro de ese marco, pero no constituye el objeto específico del trabajo. |
| A-only | 9 | 1 | — | _The Relevance of Judgment for Philosophy of Science_. Comptes Rendus de l’Académie Internationale de Philosophie des Sciences, IV | Obra centralmente dedicada a filosofía de la ciencia y al papel del juicio, pero de alcance general y no específicamente centrada en física. |
| A-only | 10 | 1 | — | Le problème des sciences humaines dans la philosophie herméneutique de Gadamer | Analiza los fundamentos filosóficos y metodológicos de las ciencias humanas en Gadamer, no la filosofía de la física. |
| B-only | 2 | 2 | translation-only | The Art of Science : From Perspective Drawing to Quantum Randomness | Aborda sustantivamente cuestiones históricas y filosóficas de la física cuántica dentro de un marco interdisciplinario más amplio sobre arte, matemáticas y ciencia. |
| B-only | 3 | 2 | translation-only | Holism in philosophy of mind and philosophy of physics | Aborda extensamente el holismo en física cuántica y espacio-tiempo, aunque comparte el foco con filosofía de la mente. |
| B-only | 5 | 3 | translation-only | Philosophy of Physics | Capítulo dedicado específicamente a la filosofía de la física y a problemas epistemológicos y metodológicos propios de las teorías físicas. |
| B-only | 6 | 3 | translation-only | The philosophy of physics | Reseña específicamente una obra de filosofía de la física que aborda fundamentos conceptuales de relatividad y mecánica cuántica. |
| B-only | 7 | 3 | translation-only | More than the conscience of physics? From physics to philosophy | Reseña una obra específicamente dedicada a los fundamentos filosóficos de la física moderna, especialmente teoría cuántica y relatividad. |
| B-only | 9 | 1 | translation-only | Story Of Physics | Historia general de las ideas y descubrimientos de la física; la filosofía de la ciencia no aparece como objeto sustantivo. |
| B-only | 10 | 2 | translation-only | Reflections on science, philosophy and art | Incluye de forma sustantiva reflexiones filosóficas sobre la física dentro de una obra más amplia sobre ciencia, filosofía y arte. |

### val-pt-03 — filosofia da ciência em física

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 10 | 3 | — | História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física | Estudia específicamente la presencia y uso de Historia y Filosofía de la Ciencia en investigación y enseñanza de la Física. |
| B-only | 7 | 2 | translation-only | The Art of Science : From Perspective Drawing to Quantum Randomness | Mismo documento que HAB007, sólo cambia el idioma de la consulta. Aborda sustantivamente cuestiones filosóficas e históricas de la física cuántica, aunque dentro de un marco interdisciplinario más amplio sobre arte, matemáticas y ciencia. |

### val-es-04 — lógica en lingüística

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 8 | 0 | — | Skate en el Gran La Plata: Lógica interna, lógica externa y Educación Física | “Lógica interna/externa” se refiere a categorías de la Praxiología Motriz en Educación Física, no a lógica en lingüística. |
| A-only | 9 | 1 | — | Anticipaciones de la semiótica de Peirce en la lógica aristotélica | Relaciona lógica y semiótica mediante Aristóteles y Peirce, pero no estudia específicamente la lógica dentro de la lingüística. |
| A-only | 10 | 1 | — | La normalización lingüística en la toponimia de Canarias 73 | Es un estudio lingüístico sobre normalización y escritura de topónimos canarios, pero no aborda lógica aplicada a la lingüística. |
| B-only | 8 | 1 | original+translation | ¿Ayuda la enseñanza de la lógica a los estudiantes a argumentar mejor? | Trata lógica y argumentación de forma sustantiva, pero no su aplicación dentro de la lingüística. |
| B-only | 9 | 1 | original+translation | ¿La lógica formal es útil para argumentar? La utilidad política | Aplica lógica formal al análisis de argumentación política y jurídica, pero no a problemas propios de la lingüística. |
| B-only | 10 | 1 | original+translation | Argumentación y lógica, ¿amigas o enemigas? ¿Substitutas o complementarias? ¿Relacionadas o independientes? | Trata directamente la relación entre lógica y argumentación, pero no la aplicación de la lógica dentro de la lingüística. |

### val-fr-04 — logique en linguistique

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 9 | 0 | — | Le PMSI en psychiatrie infanto-juvénile | “Logique” se usa en el sentido de lógica de atención, evaluación y costos en psiquiatría; no trata lógica en lingüística. |
| A-only | 10 | 1 | — | LA LOGIQUE | Introducción general a la lógica y sus aplicaciones en filosofía y ciencias, pero no específicamente a la lógica en lingüística. |
| B-only | 8 | 1 | translation-only | DTIC ADA460935: Stochastic Language Generation in a Dialogue System: Toward a Domain Independent Generator | Trabajo de lingüística computacional sobre generación de lenguaje y sistemas de diálogo; no aborda lógica de forma sustantiva. |
| B-only | 10 | 1 | translation-only | La falsa sistematización en Lógica viva | Estudia lógica, falacias y razonamiento natural, pero no la aplicación de la lógica dentro de la lingüística. |

### val-pt-04 — lógica em linguística

| side | rank | rel | route | title | comment |
|---|---:|---:|---|---|---|
| A-only | 7 | 0 | — | Diagnóstico automático de defeitos em rolamentos baseado em lógica fuzzy | Aplica lógica difusa al diagnóstico de fallas mecánicas; no trata lógica en lingüística. |
| B-only | 10 | 1 | original+translation | Lógica y Teoría de la Argumentación | Trata sustantivamente de lógica y argumentación, pero no específicamente de lógica aplicada a la lingüística. |

## Interpretation boundary

The paired ΔP@10 is exact for this frozen A/B run because shared Top-10 rows cancel. It is not an absolute P@10 estimate for either complete Top 10, and it should not be treated as an external population-level causal estimate.

