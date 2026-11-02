# T2AQ — Agronomy Program Metadata Family Audit + Confidence V4

## Objetivo

Después de Program Authority V26, el unresolved de mayor volumen en la Queue
full es:

`Licenciatura en Ingeniero Agrónomo`

con:

**1,381 works**

Sin embargo, el full inventory muestra que el problema no es un solo label.

T2AQ audita la familia observada antes de cualquier Program Authority V27.

T2AQ no decide alcance y no crea aliases.

## Full family

Frozen artifact:

`13099541204`

Canonical:

**27,576 works**

SHA-256:

`65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Cohort de auditoría:

`^(?:licenciatura en ingeniero agronom|ingenieria en agronomia)`

Esta expresión regular sirve exclusivamente para construir el cohort de
auditoría.

No constituye una regla de identidad programática.

Full observed family:

- works: **2,493**
- normalized program groups: **64**
- CUCBA: **2,326**
- CUCSUR: **167**
- source degree agreement: **2,493 / 2,493**
- RIUdeG: **2,493**

## Provenance

Date quality:

- valid: **2,485**
- suspicious: **6**
- unknown: **2**

Visible valid span:

**1969–2020**

Accession days:

- 2015-09-09: **2,468**
- 2019-06-13: **20**
- 2021-10-05: **5**

Source field presence:

- submitted: **2,488**
- abstract: **25**
- issued: **3**

La fuerte concentración en 2015 describe provenance legacy.

No se transforma en una regla cohort-wide low-trust.

## Program groups principales

1. `licenciatura en ingeniero agronomo` — **1,381**
2. `licenciatura en ingeniero agronomo orientacion fitotecnia` — **516**
3. `licenciatura en ingeniero agronomo orientacion suelos` — **96**
4. `licenciatura en ingeniero agronomo orientacion zootecnia` — **68**
5. `licenciatura en ingeniero agronomo extensionista` — **63**
6. `licenciatura en ingeniero agronomo orientacion ganaderia` — **53**
7. `licenciatura en ingeniero agronomo zootecnista` — **50**
8. `licenciatura en ingeniero agronomo orientacion extension agricola` — **46**
9. `licenciatura en ingeniero agronomo orientacion bosques` — **44**

El resto se reparte entre variantes históricas, ortográficas y combinaciones
de orientaciones.

## Primary group

`licenciatura en ingeniero agronomo`

Full:

- works: **1,381**
- CUCBA: **1,225**
- CUCSUR: **156**
- source agreement: **1,381 / 1,381**
- valid: **1,375**
- suspicious: **4**
- unknown: **2**
- accession 2015-09-09: **1,372**
- accession 2019-06-13: **9**
- submitted: **1,379**
- abstract: **9**
- exact-title conflicts: **5**
- structural conflicts: **3**
- warning-only: **2**
- no detected conflict: **1,376**

## Family structural conflicts

Across the 2,493-work audit cohort:

- exact-title conflict works: **18**
- structural conflict works: **10**
- warning-only works: **8**
- no detected conflict: **2,475**
- unique structural pairs: **5**
- external structural pairs: **0**

All five structural pairs are internal to the observed agronomy cohort.

This does **not** prove that all 64 labels are one Program Authority.

It proves only that the corpus contains exact title+author duplicates with
different raw program labels inside this lexical/institutional family.

## Five frozen pairs

### Pair 1

`program-conflict:27c453054653ff58a4d3`

- 22430 · Orientación Fitotecnista/Ganadería/Agrícola
- 22565 · Orientación Fitotecnia/Ganadería/Extensión Agrícola

### Pair 2

`program-conflict:4f2d9ccb915239431756`

- 34304 · Ingeniero Agrónomo
- 73463 · Ingeniero Agrónomo Forestal

### Pair 3

`program-conflict:5ba498f603a8f9e6ef96`

- 34293 · Ingeniero Agrónomo
- 73466 · Ingeniero AgrónomoOrientaciónFitotecnia

### Pair 4

`program-conflict:b3d4c601c2a4c00c921a`

- 23902 · Orientación Suelos
- 34356 · Ingeniero Agrónomo

### Pair 5

`program-conflict:ed427a7a9e080aa40f30`

- 23366 · Orientación Fitotecnia
- 23825 · Orientación Fitotecnista

## Confidence V4

The generic rule:

`riudg-structural-program-metadata-conflicts-v1`

is extended from:

**22 → 32 providerRecordIds**

Program Metadata Evidence Confidence revision becomes:

`2026-11-02.v4`

The ten Agronomy source records become:

- confidenceState = `conflicted`
- authorityApplicability = `blocked`

No agronomy-specific engine branch is added.

## Expected full confidence after V4

- conflicted: **32**
- low-trust: **453**
- unassessed: **27,091**
- blocked: **485**
- allowed: **27,091**

Net new blocked:

**10**

## Queue impact

Eight normalized Agronomy groups contain the ten protected works and become
visible in:

`metadata-review / metadata-confidence-review`

The primary group has:

- count: **1,381**
- conflicted: **3**
- unassessed: **1,378**
- blocked: **3**
- allowed: **1,378**

No Program Authority is assigned.

## Institutional context for the next phase

Current CUCBA documentation publishes the program as:

`Ingeniero Agrónomo`

and classifies it in:

`Ciencias Biológicas y Agropecuarias`

The current program covers agricultural, livestock and forestry production,
technology transfer, rural development and resource management.

CUCBA also documents historical specialization/orientation structures,
including an `Ingeniero Agrónomo con Orientación Forestal`.

This is strong evidence for an eventual outside-scope authority for the
current/core program, but it does not by itself establish that every one of
the 64 historical raw labels is the same authority.

V27 remains HOLD until lineage/alias evidence is explicit.

## Invariants

T2AQ does not modify:

- Program Authority V26;
- Institution Authority V2;
- Scope Policy V2;
- Admission Gate precedence;
- Boundary Closure V2;
- T2T;
- T2Y.

T2AQ never admits, excludes or merges a program using thesis topic.

The audit regex is not an authority rule.
