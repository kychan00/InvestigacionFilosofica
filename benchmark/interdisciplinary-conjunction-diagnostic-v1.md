# Interdisciplinary conjunction diagnostic v1

Development-only diagnostic over the frozen 68-row held-out A/B delta after human adjudication. It measures whether explicit philosophical-area and academic-domain terms are jointly evidenced in title alone or title+abstract. Because these labels are now being inspected for tuning, this set must not be reused as independent validation for a future conjunction-ranking change.

## Overall

- judged changed rows: 68
- relevant rows (>=2): 29/68 (0.4265)
- rows with abstract: 36/68
- title conjunction: 2/2 relevant (1)
- title+abstract conjunction: 5/5 relevant (1)

## Buckets

| evidence | bucket | rows | relevant | relevant rate |
|---|---|---:|---:|---:|
| title | both | 2 | 2 | 1 |
| title | area-only | 24 | 7 | 0.2917 |
| title | domain-only | 19 | 14 | 0.7368 |
| title | neither | 23 | 6 | 0.2609 |
| title+abstract | both | 5 | 5 | 1 |
| title+abstract | area-only | 25 | 7 | 0.28 |
| title+abstract | domain-only | 21 | 15 | 0.7143 |
| title+abstract | neither | 17 | 2 | 0.1176 |

## Translation-only B rows

- total relevant: 20/30 (0.6667)
- title conjunction relevant: 0/0 (n/a)
- title+abstract conjunction relevant: 2/2 (1)

## By family

| family | total rel/rows | title conjunction rel/rows | title+abstract conjunction rel/rows |
|---|---:|---:|---:|
| epistemology-psychology | 8/20 | 0/0 | 0/0 |
| philosophy-science-physics | 17/32 | 1/1 | 3/3 |
| logic-linguistics | 0/12 | 0/0 | 0/0 |
| ethics-artificial-intelligence | 4/4 | 1/1 | 2/2 |

## Relevant rows lacking conjunction evidence

These are important false-negative risks for any hard conjunction filter.

- HAB003 · val-de-03 · rel=3 · B-only · More than the conscience of physics? From physics to philosophy
- HAB007 · val-de-03 · rel=2 · B-only · The Art of Science : From Perspective Drawing to Quantum Randomness
- HAB008 · val-pt-03 · rel=2 · B-only · The Art of Science : From Perspective Drawing to Quantum Randomness
- HAB009 · val-fr-03 · rel=2 · B-only · Reflections on science, philosophy and art
- HAB010 · val-de-03 · rel=2 · B-only · Holism in philosophy of mind and philosophy of physics
- HAB015 · val-es-03 · rel=2 · B-only · The Art of Science : From Perspective Drawing to Quantum Randomness
- HAB017 · val-pt-02 · rel=2 · A-only · GEPEGE – Grupo de Estudo e Pesquisa em Epistemologia Genética e Educação
- HAB018 · val-pt-02 · rel=2 · B-only · Inductive inference and its natural ground : an essay in naturalistic epistemology
- HAB021 · val-de-02 · rel=2 · B-only · Inductive inference and its natural ground : an essay in naturalistic epistemology
- HAB023 · val-fr-03 · rel=3 · B-only · The philosophy of physics
- HAB026 · val-pt-01 · rel=3 · B-only · To The Artificial Intelligence Of The Future
- HAB028 · val-fr-01 · rel=3 · B-only · To The Artificial Intelligence Of The Future
- HAB032 · val-es-02 · rel=2 · B-only · Inductive inference and its natural ground : an essay in naturalistic epistemology
- HAB034 · val-fr-02 · rel=2 · B-only · Inductive inference and its natural ground : an essay in naturalistic epistemology
- HAB037 · val-es-02 · rel=2 · A-only · Formación en Psicología Comunitaria
- HAB042 · val-de-03 · rel=3 · B-only · Time in fundamental physics
- HAB044 · val-fr-03 · rel=2 · B-only · The Art of Science : From Perspective Drawing to Quantum Randomness
- HAB047 · val-de-03 · rel=3 · B-only · The philosophy of physics
- HAB048 · val-de-03 · rel=3 · A-only · Physik am normativen Gängelband?
- HAB056 · val-fr-02 · rel=2 · A-only · Épistémologie et méthodologie en psychanalyse et en psychiatrie
- HAB057 · val-fr-02 · rel=2 · A-only · Épistémologie et méthodologie en psychanalyse et en psychiatrie
- HAB060 · val-fr-03 · rel=3 · B-only · More than the conscience of physics? From physics to philosophy
- HAB061 · val-fr-03 · rel=2 · B-only · Holism in philosophy of mind and philosophy of physics
- HAB065 · val-de-03 · rel=2 · A-only · Von der mathematischen zur kritischen Metaphysik der Natur. Lambert und Kant

## Irrelevant/tangential rows with conjunction evidence

These are important false-positive risks for a conjunction bonus.

