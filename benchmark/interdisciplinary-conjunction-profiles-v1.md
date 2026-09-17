# Interdisciplinary conjunction profile simulation v1

Development-only simulation on the 68 already-adjudicated changed rows. Human metrics measure score separation and within-query relevant-vs-nonrelevant pairwise ordering only; they are not Top-10 effectiveness estimates. Structural B metrics rerank the frozen B pools without assigning relevance to newly entering rows.

> This dataset is now tuning data and must not be reused as independent validation for the eventual conjunction ranking change.

## Profiles

| profile | rel mean | nonrel mean | separation | Δ separation | pairwise acc. | Δ pairwise | B queries changed | B changed Top10 pairs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 29.414 | 24.564 | 4.85 | +0 | 0.8609 | +0 | 0 | 0 |
| both-plus-1 | 29.586 | 24.564 | 5.022 | +0.172 | 0.8609 | +0 | 3 | 8 |
| area-minus-1 | 29.172 | 24.103 | 5.07 | +0.22 | 0.8609 | +0 | 5 | 14 |
| area-minus-2 | 28.931 | 23.641 | 5.29 | +0.44 | 0.8478 | -0.0131 | 9 | 22 |
| area-minus-3 | 28.69 | 23.179 | 5.51 | +0.66 | 0.8217 | -0.0392 | 9 | 24 |
| conservative | 29.069 | 23.436 | 5.633 | +0.783 | 0.8652 | +0.0043 | 10 | 24 |
| moderate | 29.241 | 23.436 | 5.805 | +0.955 | 0.8652 | +0.0043 | 11 | 28 |
| asymmetric | 28.828 | 22.974 | 5.853 | +1.003 | 0.8391 | -0.0218 | 10 | 26 |

## Profile definitions

- baseline: both=0, area-only=0, domain-only=0, neither-with-abstract=0, neither-without-abstract=0
- both-plus-1: both=1, area-only=0, domain-only=0, neither-with-abstract=0, neither-without-abstract=0
- area-minus-1: both=0, area-only=-1, domain-only=0, neither-with-abstract=0, neither-without-abstract=0
- area-minus-2: both=0, area-only=-2, domain-only=0, neither-with-abstract=0, neither-without-abstract=0
- area-minus-3: both=0, area-only=-3, domain-only=0, neither-with-abstract=0, neither-without-abstract=0
- conservative: both=1, area-only=-2, domain-only=0, neither-with-abstract=-1, neither-without-abstract=0
- moderate: both=2, area-only=-2, domain-only=0, neither-with-abstract=-1, neither-without-abstract=0
- asymmetric: both=1, area-only=-3, domain-only=0, neither-with-abstract=-1, neither-without-abstract=0

## Structural B changes by profile

### both-plus-1

- val-pt-02: changedPairs=2
  - enters: old-rank=13 · bucket=both · score=30 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=32 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=21 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=21 · Logic and Linguistics

### area-minus-1

- val-pt-02: changedPairs=4
  - enters: old-rank=12 · bucket=domain-only · score=29 · EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET
  - enters: old-rank=13 · bucket=both · score=29 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=31 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-es-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=28 · La normalización lingüística en la toponimia de Canarias 73
- val-en-04: changedPairs=2
  - enters: old-rank=14 · bucket=neither · score=18 · Logos et formalisation du langage
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=20 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=20 · Logic and Linguistics

### area-minus-2

- val-es-02: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=29 · Formación en Psicología Comunitaria
- val-de-02: changedPairs=2
  - enters: old-rank=13 · bucket=both · score=24 · Social Epistemology and Psychology
- val-fr-02: changedPairs=2
  - enters: old-rank=13 · bucket=domain-only · score=28 · ERIC ED389230: The Discontinuity of Human Existence, Part I. The Fundamental Concepts of Human Existence and the Relation between the Singular and the Super Singular. No. 50.
- val-pt-02: changedPairs=4
  - enters: old-rank=12 · bucket=domain-only · score=29 · EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET
  - enters: old-rank=13 · bucket=both · score=29 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=31 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-es-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=28 · La normalización lingüística en la toponimia de Canarias 73
- val-en-04: changedPairs=2
  - enters: old-rank=14 · bucket=neither · score=18 · Logos et formalisation du langage
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=20 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=20 · Logic and Linguistics
- val-pt-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=27 · Caminhos em Linguística Aplicada

### area-minus-3

- val-es-02: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=29 · Formación en Psicología Comunitaria
- val-de-02: changedPairs=4
  - enters: old-rank=13 · bucket=both · score=24 · Social Epistemology and Psychology
  - enters: old-rank=14 · bucket=domain-only · score=24 · ERIC ED281238: Toward a Theory of Psychological Type Congruence for Advertisers.
- val-fr-02: changedPairs=2
  - enters: old-rank=13 · bucket=domain-only · score=28 · ERIC ED389230: The Discontinuity of Human Existence, Part I. The Fundamental Concepts of Human Existence and the Relation between the Singular and the Super Singular. No. 50.
- val-pt-02: changedPairs=4
  - enters: old-rank=12 · bucket=domain-only · score=29 · EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET
  - enters: old-rank=13 · bucket=both · score=29 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=31 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-es-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=28 · La normalización lingüística en la toponimia de Canarias 73
- val-en-04: changedPairs=2
  - enters: old-rank=14 · bucket=neither · score=18 · Logos et formalisation du langage
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=20 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=20 · Logic and Linguistics
- val-pt-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=27 · Caminhos em Linguística Aplicada

### conservative

- val-es-02: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=29 · Formación en Psicología Comunitaria
- val-de-02: changedPairs=2
  - enters: old-rank=13 · bucket=both · score=25 · Social Epistemology and Psychology
- val-fr-02: changedPairs=2
  - enters: old-rank=13 · bucket=domain-only · score=28 · ERIC ED389230: The Discontinuity of Human Existence, Part I. The Fundamental Concepts of Human Existence and the Relation between the Singular and the Super Singular. No. 50.
- val-pt-02: changedPairs=4
  - enters: old-rank=13 · bucket=both · score=30 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
  - enters: old-rank=12 · bucket=domain-only · score=29 · EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET
- val-fr-03: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=25 · The physics of idealism ..
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=32 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-es-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=28 · La normalización lingüística en la toponimia de Canarias 73
- val-en-04: changedPairs=2
  - enters: old-rank=14 · bucket=neither · score=17 · Logos et formalisation du langage
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=21 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=21 · Logic and Linguistics
- val-pt-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=27 · Caminhos em Linguística Aplicada

### moderate

- val-pt-01: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=33 · Inteligência Artificial na Educação: Proposta de um Framework para Adoção Ética
- val-es-02: changedPairs=2
  - enters: old-rank=19 · bucket=both · score=30 · Epistemología y psicología
- val-de-02: changedPairs=4
  - enters: old-rank=13 · bucket=both · score=26 · Social Epistemology and Psychology
  - enters: old-rank=16 · bucket=both · score=25 · Putting Epistemology into Practice: Normative Disputes in Psychology
- val-fr-02: changedPairs=2
  - enters: old-rank=13 · bucket=domain-only · score=28 · ERIC ED389230: The Discontinuity of Human Existence, Part I. The Fundamental Concepts of Human Existence and the Relation between the Singular and the Super Singular. No. 50.
- val-pt-02: changedPairs=4
  - enters: old-rank=13 · bucket=both · score=31 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
  - enters: old-rank=12 · bucket=domain-only · score=29 · EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET
- val-fr-03: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=25 · The physics of idealism ..
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=33 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-es-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=28 · La normalización lingüística en la toponimia de Canarias 73
- val-en-04: changedPairs=2
  - enters: old-rank=14 · bucket=neither · score=17 · Logos et formalisation du langage
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=22 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=22 · Logic and Linguistics
- val-pt-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=27 · Caminhos em Linguística Aplicada

### asymmetric

- val-es-02: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=29 · Formación en Psicología Comunitaria
- val-de-02: changedPairs=4
  - enters: old-rank=13 · bucket=both · score=25 · Social Epistemology and Psychology
  - enters: old-rank=14 · bucket=domain-only · score=24 · ERIC ED281238: Toward a Theory of Psychological Type Congruence for Advertisers.
- val-fr-02: changedPairs=2
  - enters: old-rank=13 · bucket=domain-only · score=28 · ERIC ED389230: The Discontinuity of Human Existence, Part I. The Fundamental Concepts of Human Existence and the Relation between the Singular and the Super Singular. No. 50.
- val-pt-02: changedPairs=4
  - enters: old-rank=13 · bucket=both · score=30 · Psicologia, Diferença e Epistemologia: Percorrendo os (des)caminhos de uma constituição paradoxal DOI - 10.5752/P.1678-9563.2013v19n3p462
  - enters: old-rank=12 · bucket=domain-only · score=29 · EQUÍVOCOS EM RELAÇÃO À PSICOLOGIA MORAL DE JEAN PIAGET
- val-fr-03: changedPairs=2
  - enters: old-rank=11 · bucket=domain-only · score=25 · The physics of idealism ..
- val-pt-03: changedPairs=2
  - enters: old-rank=11 · bucket=both · score=32 · História e Filosofia da ciência: um panorama em eventos e periódicos de ensino de Física
- val-es-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=28 · La normalización lingüística en la toponimia de Canarias 73
- val-en-04: changedPairs=2
  - enters: old-rank=14 · bucket=neither · score=17 · Logos et formalisation du langage
- val-fr-04: changedPairs=4
  - enters: old-rank=12 · bucket=both · score=21 · Logic in linguistics
  - enters: old-rank=13 · bucket=both · score=21 · Logic and Linguistics
- val-pt-04: changedPairs=2
  - enters: old-rank=15 · bucket=domain-only · score=27 · Caminhos em Linguística Aplicada

