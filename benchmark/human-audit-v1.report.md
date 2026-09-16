# Human audit v1 analysis

100 blinded human judgments: 50 random-stratified + 50 targeted difficult cases.

> The random-stratified half is the appropriate subset for estimating ordinary AI↔human agreement. The targeted half is intentionally harder and must not be treated as prevalence-representative.

## AI ↔ human agreement

| Silver reference | Group | n | Exact grade | Within ±1 | Binary agreement | Binary κ | Silver FP | Silver FN |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | random_stratified | 46 | 23.9% | 65.2% | 58.7% | 0.1892 | 4 | 15 |
| Baseline | targeted | 36 | 27.8% | 47.2% | 36.1% | -0.2395 | 15 | 8 |
| Baseline | all | 82 | 25.6% | 57.3% | 48.8% | -0.0274 | 19 | 23 |
| Ranking v2 | random_stratified | 48 | 29.2% | 64.6% | 58.3% | 0.1823 | 4 | 16 |
| Ranking v2 | targeted | 43 | 30.2% | 51.2% | 44.2% | -0.1121 | 14 | 10 |
| Ranking v2 | all | 91 | 29.7% | 58.2% | 51.6% | 0.0205 | 18 | 26 |

## Human corrections applied to frozen pools

| Version | Audited in Top20 | Grade changed | Binary changed | Audited in Top10 | Top10 grade changed | Top10 binary changed |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 82 | 61 | 42 | 67 | 50 | 33 |
| Ranking v2 | 91 | 64 | 44 | 74 | 52 | 34 |

## Sensitivity of Ranking v2 advantage

> Hybrid sensitivity analysis: audited labels are human; unaudited labels remain AI-silver. This is **not** a fully human-gold benchmark.

| Metric | Baseline silver | V2 silver | Δ silver | Baseline human-corrected | V2 human-corrected | Δ corrected |
|---|---:|---:|---:|---:|---:|---:|
| precision5 | 0.444 | 0.5 | 0.056 | 0.46 | 0.532 | 0.072 |
| precision10 | 0.434 | 0.468 | 0.034 | 0.452 | 0.48 | 0.028 |
| recall10 | 0.5642 | 0.6055 | 0.0413 | 0.5981 | 0.5812 | -0.0169 |
| ndcg10 | 0.5466 | 0.5692 | 0.0226 | 0.5744 | 0.5804 | 0.006 |
| mrr10 | 0.7064 | 0.7539 | 0.0475 | 0.713 | 0.758 | 0.045 |

Human-corrected P@10 query direction: **15 improved / 6 worsened / 29 tied**.

## Human-corrected per-query P@10 changes

| Query | Lang | Intent | Baseline | Ranking v2 | Delta |
|---|---|---|---:|---:|---:|
| de-10 | de | interdisciplinary-challenge | 0.5 | 0.1 | -0.4 |
| en-03 | en | philosopher-concept | 0.4 | 0.3 | -0.1 |
| fr-03 | fr | philosopher-concept | 0.4 | 0.3 | -0.1 |
| en-04 | en | philosopher-concept | 0.4 | 0.3 | -0.1 |
| en-05 | en | philosopher-concept | 0.1 | 0 | -0.1 |
| en-10 | en | interdisciplinary-challenge | 0.2 | 0.1 | -0.1 |
| en-01 | en | philosopher-concept | 0.3 | 0.4 | 0.1 |
| fr-02 | fr | work | 0.8 | 0.9 | 0.1 |
| pt-03 | pt | philosopher-concept | 0.7 | 0.8 | 0.1 |
| en-06 | en | philosopher-concept | 0.2 | 0.3 | 0.1 |
| de-08 | de | work | 0.2 | 0.3 | 0.1 |
| fr-08 | fr | work | 0.3 | 0.4 | 0.1 |
| pt-09 | pt | interdisciplinary-challenge | 0.5 | 0.6 | 0.1 |
| es-02 | es | work | 0.5 | 0.7 | 0.2 |
| pt-02 | pt | work | 0.5 | 0.7 | 0.2 |
| de-03 | de | philosopher-concept | 0.3 | 0.5 | 0.2 |
| es-08 | es | work | 0.7 | 0.9 | 0.2 |
| en-08 | en | work | 0.1 | 0.3 | 0.2 |
| es-09 | es | interdisciplinary-challenge | 0.3 | 0.5 | 0.2 |
| en-09 | en | interdisciplinary-challenge | 0.1 | 0.3 | 0.2 |
| pt-10 | pt | interdisciplinary-challenge | 0.3 | 0.5 | 0.2 |

## Binary AI↔human disagreements

### Baseline silver (42)

- **H001 · es-05 · random_stratified** — human=3, silver=0 — Márgenes de la Filosofía. Diálogos cruzados sobre la alteridad en Levinas y Derrida — nota: La alteridad en Levinas es uno de los ejes principales, aunque el texto la aborda en diálogo con Derrida.
- **H007 · es-02 · random_stratified** — human=3, silver=0 — Martin Heidegger: Being and Time
- **H009 · es-09 · random_stratified** — human=3, silver=0 — Hermeneutical Phenomenology
- **H011 · en-07 · random_stratified** — human=2, silver=1 — The Pedagogics of Liberation - A Latin American Philosophy of Education
- **H014 · en-07 · random_stratified** — human=3, silver=0 — Europe is dead on the philosophy of liberation of Enrique Dussel
- **H016 · en-06 · random_stratified** — human=3, silver=0 — Becoming One: Theology and Philosophy, Will and Intellect, Mode and Substance in Spinoza
- **H022 · de-03 · random_stratified** — human=2, silver=0 — VI. Phronêsis – Die Bezeichnung von Urteilskraft bei Aristoteles?
- **H025 · de-01 · random_stratified** — human=3, silver=0 — Philosophie, Geographie, Geschichte: eine ‚kosmopolitische‘ Vermittlung von Natur und Freiheit bei Kant
- **H026 · de-07 · random_stratified** — human=0, silver=3 — Philosophie der Befreiung die phänomenologische Ontologie bei Jean-Paul Sartre ; Anhang Anarchie und Moral, Interview mit J.-P. Sartre
- **H029 · de-10 · random_stratified** — human=3, silver=0 — Ontologie und Axiomatik der Wissensbasis von LILOG
- **H030 · de-09 · random_stratified** — human=2, silver=0 — Qualitative Gesundheitsforschung aus Sicht der Neuen Phänomenologie — nota: Aplica la Nueva Fenomenología a la investigación cualitativa en salud, pero no parece centrarse específicamente en enfermería.
- **H032 · fr-05 · random_stratified** — human=2, silver=1 — Le statut philosophique de l'enseignement chez Emmanuel Levinas — nota: La tesis se centra en el concepto de enseñanza, pero lo desarrolla sustantivamente a partir de la relación con el Otro y la ética levinasiana.
- **H034 · fr-03 · random_stratified** — human=3, silver=1 — Vertu éthique et rationalité pratique chez Aristote. Note sur la notion d’hexis proairetikê
- **H035 · fr-07 · random_stratified** — human=1, silver=2 — Pensée critique latino-américaine: de la philosophie de la libération au tournant décolonial — nota: La Filosofía de la Liberación es central en el artículo, pero Dussel no aparece como objeto específico o principal en el resumen.
- **H038 · fr-08 · random_stratified** — human=3, silver=0 — Structures et mouvement dialectique dans la Phénoménologie de l'esprit de Hegel
- **H044 · pt-07 · random_stratified** — human=3, silver=0 — A DESCOLONIALIDADE EPISTEMOLÓGICA NA FILOSOFIA DA LIBERTAÇÃO DE ENRIQUE DUSSEL
- **H045 · pt-06 · random_stratified** — human=3, silver=0 — A substância divina e a subjetividade em Descartes
- **H046 · pt-06 · random_stratified** — human=0, silver=2 — Morfometria cerebral de substância cinzenta e imagens de tensores de difusão da microestrutura de substância branca de pacientes em primeiro episódio maníaco com sintomas psicóticos
- **H050 · pt-10 · random_stratified** — human=0, silver=2 — Metaphysics of Science as Naturalized Metaphysics
- **H054 · en-10 · targeted** — human=0, silver=2 — Harmonies of Nature, in Three Volumes, Vol. I
- **H055 · fr-10 · targeted** — human=1, silver=3 — Epistemology and Ontology of AI — From Lagrange and Hamilton Genre-Shift to Agentic AI Cognitive Safety: Open-Source Framework, LNN, HNN, PINN and SciML within the Dorian Codex H_SAFE by Stefano Dorian Franco — Independent Research Modules Programme
- **H056 · en-10 · targeted** — human=0, silver=2 — The Dimensional Lattice: A Mathematical Framework for Consciousness Emergence and Coherence Dynamics
- **H064 · en-06 · targeted** — human=1, silver=2 — A demonstration of the being and attributes of God: more particularly in answer to Mr. Hobbs, Spinoza, and their followers. ... Being the substance of eight sermons preach'd at the cathedral-church of St. Paul, in the year 1704. ... By Samuel Clark, ... 1705
- **H065 · en-05 · targeted** — human=1, silver=2 — Quanta, Alterity, And Love
- **H066 · de-07 · targeted** — human=0, silver=2 — Gabriel Cercel: Martin HEIDEGGER, Reden und andere Zeugnisse eines Lebensweges; Attila Szigeti: Emmanuel LEVINAS, Positivité et transcendance. Suivi de Lévinas et la phenomenology; Cristian Ciocan: Jean-Luc MARION, Crucea vizibilului; Gabriel Cercel: Mądąlina DIACONU, Blickumkehr. Mit Martin Heidegger zu einer relationalen ästhetik; Cristina Ionescu: Mark WRATHALL, Jeff MALPAS (eds.), Essays in Honour of Hubert L. Dreyfus; Cristian Ciocan: Ion COPOERU, Aparenţą şi sens. Repere ale fenomenologiei constitutive; Cristian Ciocan: Michael INWOOD, A Heidegger Dictionary; Cristian Ciocan: Linda FISCHER, Lester EMBREE (eds.), Feminist Phenomenology; Mądąlina Diaconu: Renato CRISTIN, Fenomeno storia. Fenomenologia e storicità in Husserl e Dilthey; Cristian Ciocan: Michel HAAR, La philosophie française entre phénoménologie et métaphysique; Gabriel Cercel: Otto PöGGELER, Heidegger in seiner Zeit; Roxana Albu: James RISSER (ed.), Heidegger toward the Turn, Essays on the work of the 1930s; Cristian Ciocan: Virgil Ciomoş, Timp şi Eternitate. Aristotel, Fizica IV 10-14, Interpretare fenomenologicą; Cristina Ionescu: William D. BLATTNER, Heidegger's Temporal Idealism; Bogdan Mincą: Gino ZACCARIA, L'inizio greco del pensiero. Heidegger e l'essenza futura della filosofia; Mądąlina Diaconu: Ute GUZZONI, Wohnen und Wandern; Bogdan Tątaru-Cazaban: Emmanuel LéVINAS, Totalitate şi infinit; Mihail Neamţu: Jean-Luc MARION, étant donné. Essai d'une phénoménologie de la donation; Gabriel Cercel: Robert PETKOVŠEK, Heidegger-Index (1919-1927); Cristian Ciocan: Einar ØVERENGET, Seeing The Self. Heidegger on Subjectivity Mihail Neamţu: Rolf KüHN, Husserls Begriff der Passivität. Zur Kritik der passiven Synthesis in der genetischen Phänomenologie.
- **H069 · fr-01 · targeted** — human=1, silver=2 — Kant y la construcción del significado — nota: El artículo se centra en Kant, pero aborda lenguaje, significado y estructuras trascendentales; no trata sustantivamente el problema kantiano de la libertad.
- **H072 · fr-03 · targeted** — human=0, silver=2 — La división disciplinar del tiempo en el joven Heidegger. Las influencias de su concepción de los tiempos de la ciencia y la historia — nota: Aristóteles aparece sólo como influencia en la concepción heideggeriana del tiempo; no se trata la ética de la virtud.
- **H073 · en-09 · targeted** — human=3, silver=0 — Walt Whitman, Nursing, and Phenomenology — nota: Clasificación basada en el título; enfermería y fenomenología aparecen como ejes explícitos del capítulo.
- **H074 · de-10 · targeted** — human=0, silver=2 — Die Ontologie Mullā Ṣadrās und der Vorwurf der Ontotheologie Versuch einer Interpretation der Philosophie Mullā Ṣadrās im Lichte der Metaphysikkritik Heideggers — nota: Trata ontología filosófica y ontoteología en Mullā Ṣadrā y Heidegger, no ontologías en informática.
- **H075 · es-10 · targeted** — human=0, silver=3 — Metaphysics and common sense — nota: Trata metafísica filosófica, no ontologías en ciencias de la computación.
- … 12 more in benchmark/human-audit-v1.report.json

### Ranking v2 silver (44)

- **H001 · es-05 · random_stratified** — human=3, silver=0 — Márgenes de la Filosofía. Diálogos cruzados sobre la alteridad en Levinas y Derrida — nota: La alteridad en Levinas es uno de los ejes principales, aunque el texto la aborda en diálogo con Derrida.
- **H007 · es-02 · random_stratified** — human=3, silver=0 — Martin Heidegger: Being and Time
- **H009 · es-09 · random_stratified** — human=3, silver=0 — Hermeneutical Phenomenology
- **H011 · en-07 · random_stratified** — human=2, silver=1 — The Pedagogics of Liberation - A Latin American Philosophy of Education
- **H014 · en-07 · random_stratified** — human=3, silver=0 — Europe is dead on the philosophy of liberation of Enrique Dussel
- **H016 · en-06 · random_stratified** — human=3, silver=0 — Becoming One: Theology and Philosophy, Will and Intellect, Mode and Substance in Spinoza
- **H022 · de-03 · random_stratified** — human=2, silver=0 — VI. Phronêsis – Die Bezeichnung von Urteilskraft bei Aristoteles?
- **H025 · de-01 · random_stratified** — human=3, silver=0 — Philosophie, Geographie, Geschichte: eine ‚kosmopolitische‘ Vermittlung von Natur und Freiheit bei Kant
- **H026 · de-07 · random_stratified** — human=0, silver=2 — Philosophie der Befreiung die phänomenologische Ontologie bei Jean-Paul Sartre ; Anhang Anarchie und Moral, Interview mit J.-P. Sartre
- **H027 · de-02 · random_stratified** — human=3, silver=1 — Martin Heidegger, Ser Y Tiempo, Sein Und Zeit, 1927
- **H029 · de-10 · random_stratified** — human=3, silver=0 — Ontologie und Axiomatik der Wissensbasis von LILOG
- **H030 · de-09 · random_stratified** — human=2, silver=0 — Qualitative Gesundheitsforschung aus Sicht der Neuen Phänomenologie — nota: Aplica la Nueva Fenomenología a la investigación cualitativa en salud, pero no parece centrarse específicamente en enfermería.
- **H032 · fr-05 · random_stratified** — human=2, silver=1 — Le statut philosophique de l'enseignement chez Emmanuel Levinas — nota: La tesis se centra en el concepto de enseñanza, pero lo desarrolla sustantivamente a partir de la relación con el Otro y la ética levinasiana.
- **H034 · fr-03 · random_stratified** — human=3, silver=1 — Vertu éthique et rationalité pratique chez Aristote. Note sur la notion d’hexis proairetikê
- **H035 · fr-07 · random_stratified** — human=1, silver=2 — Pensée critique latino-américaine: de la philosophie de la libération au tournant décolonial — nota: La Filosofía de la Liberación es central en el artículo, pero Dussel no aparece como objeto específico o principal en el resumen.
- **H038 · fr-08 · random_stratified** — human=3, silver=0 — Structures et mouvement dialectique dans la Phénoménologie de l'esprit de Hegel
- **H044 · pt-07 · random_stratified** — human=3, silver=0 — A DESCOLONIALIDADE EPISTEMOLÓGICA NA FILOSOFIA DA LIBERTAÇÃO DE ENRIQUE DUSSEL
- **H045 · pt-06 · random_stratified** — human=3, silver=0 — A substância divina e a subjetividade em Descartes
- **H046 · pt-06 · random_stratified** — human=0, silver=2 — Morfometria cerebral de substância cinzenta e imagens de tensores de difusão da microestrutura de substância branca de pacientes em primeiro episódio maníaco com sintomas psicóticos
- **H050 · pt-10 · random_stratified** — human=0, silver=2 — Metaphysics of Science as Naturalized Metaphysics
- **H052 · en-01 · targeted** — human=3, silver=1 — The subject of freedom : Kant, Levinas
- **H053 · es-10 · targeted** — human=0, silver=3 — METAPHYSICS AND INTERDISCIPLINARY MODELS — nota: Trata metafísica y modelos de sistemas naturales; no ontologías en el sentido de informática
- **H054 · en-10 · targeted** — human=0, silver=2 — Harmonies of Nature, in Three Volumes, Vol. I
- **H055 · fr-10 · targeted** — human=1, silver=3 — Epistemology and Ontology of AI — From Lagrange and Hamilton Genre-Shift to Agentic AI Cognitive Safety: Open-Source Framework, LNN, HNN, PINN and SciML within the Dorian Codex H_SAFE by Stefano Dorian Franco — Independent Research Modules Programme
- **H056 · en-10 · targeted** — human=0, silver=2 — The Dimensional Lattice: A Mathematical Framework for Consciousness Emergence and Coherence Dynamics
- **H057 · es-08 · targeted** — human=3, silver=1 — Federico Guillermo Hegel, Fenomenología Del Espíritu. Edición Bilingüe De Antonio Gómez.
- **H063 · es-08 · targeted** — human=3, silver=1 — Hegel Fenomenología Del Espíritu 2022, Traducción De Aurelio Díaz
- **H065 · en-05 · targeted** — human=1, silver=2 — Quanta, Alterity, And Love
- **H066 · de-07 · targeted** — human=0, silver=2 — Gabriel Cercel: Martin HEIDEGGER, Reden und andere Zeugnisse eines Lebensweges; Attila Szigeti: Emmanuel LEVINAS, Positivité et transcendance. Suivi de Lévinas et la phenomenology; Cristian Ciocan: Jean-Luc MARION, Crucea vizibilului; Gabriel Cercel: Mądąlina DIACONU, Blickumkehr. Mit Martin Heidegger zu einer relationalen ästhetik; Cristina Ionescu: Mark WRATHALL, Jeff MALPAS (eds.), Essays in Honour of Hubert L. Dreyfus; Cristian Ciocan: Ion COPOERU, Aparenţą şi sens. Repere ale fenomenologiei constitutive; Cristian Ciocan: Michael INWOOD, A Heidegger Dictionary; Cristian Ciocan: Linda FISCHER, Lester EMBREE (eds.), Feminist Phenomenology; Mądąlina Diaconu: Renato CRISTIN, Fenomeno storia. Fenomenologia e storicità in Husserl e Dilthey; Cristian Ciocan: Michel HAAR, La philosophie française entre phénoménologie et métaphysique; Gabriel Cercel: Otto PöGGELER, Heidegger in seiner Zeit; Roxana Albu: James RISSER (ed.), Heidegger toward the Turn, Essays on the work of the 1930s; Cristian Ciocan: Virgil Ciomoş, Timp şi Eternitate. Aristotel, Fizica IV 10-14, Interpretare fenomenologicą; Cristina Ionescu: William D. BLATTNER, Heidegger's Temporal Idealism; Bogdan Mincą: Gino ZACCARIA, L'inizio greco del pensiero. Heidegger e l'essenza futura della filosofia; Mądąlina Diaconu: Ute GUZZONI, Wohnen und Wandern; Bogdan Tątaru-Cazaban: Emmanuel LéVINAS, Totalitate şi infinit; Mihail Neamţu: Jean-Luc MARION, étant donné. Essai d'une phénoménologie de la donation; Gabriel Cercel: Robert PETKOVŠEK, Heidegger-Index (1919-1927); Cristian Ciocan: Einar ØVERENGET, Seeing The Self. Heidegger on Subjectivity Mihail Neamţu: Rolf KüHN, Husserls Begriff der Passivität. Zur Kritik der passiven Synthesis in der genetischen Phänomenologie.
- **H069 · fr-01 · targeted** — human=1, silver=2 — Kant y la construcción del significado — nota: El artículo se centra en Kant, pero aborda lenguaje, significado y estructuras trascendentales; no trata sustantivamente el problema kantiano de la libertad.
- … 14 more in benchmark/human-audit-v1.report.json

## Methodological cautions

- The random_stratified half is the appropriate subset for estimating ordinary AI-human agreement within the sampled Top-10 union; the targeted half is deliberately enriched for hard/error-prone cases.
- The 100-document audit is not a complete human judgment of either 1000-document pool.
- Human-corrected metrics are a sensitivity analysis, not pure human-gold metrics, because unaudited labels remain AI-silver.
- Recall@10 remains relative to each frozen Top-20 pool, not corpus-wide recall.
