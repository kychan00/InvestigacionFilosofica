# T2AO — Veterinary Program Metadata Integrity + Conflict Protection V3

## Objetivo

Antes de crear Program Authority V26 para Medicina Veterinaria, se audita el grupo de mayor impacto que permanece unresolved:

`LICENCIATURA EN MEDICINA VETERINARIA ZOOTECNISTA`

Full observed:

**1,340 works**

T2AO es una fase de integridad de metadata.

No crea Program Authority V26 y no decide scope.

## Hallazgo

El audit genérico T2AK aplicado al full inventory detecta:

- exact-title cross-program conflicts: **7**
- exact-title + same-author structural conflicts: **3**
- warning-only: **4**
- no-detected-conflict: **1,333**

Los 3 structural conflicts apuntan a:

- Odontología: **1**
- Medicina: **1**
- Psicología: **1**

Uno de los tres pares ya estaba congelado por T2AL:

`Veterinaria 21932 ↔ Medicina 34005`

Los otros dos no estaban todavía protegidos item-level.

## Source provenance

Frozen artifact:

`13099541204`

Canonical works:

**27,576**

SHA-256:

`65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

Target group:

- provider RIUdeG: **1,340**
- unit CUCBA: **1,340**
- source `dc.degree.name` agreement: **1,340 / 1,340**
- accession day `2015-09-09`: **1,340**
- `dc.date.submitted`: **1,340**
- `dc.date.issued`: **0**
- abstract: **0**
- valid years: **1,325**
- visible valid range: **1970–2002**

La ausencia de issued/abstract y el accession day compartido describen provenance legacy, pero T2AO no convierte por ello las 1,340 works completas en low-trust.

El bloqueo sigue siendo estrictamente item-level.

## Tres pares estructurales

### Veterinaria ↔ Odontología

- Veterinary handle: `20.500.12104/21606`
- Dentistry handle: `20.500.12104/33113`
- pairId: `program-conflict:7ab435f671141492bbc2`

### Veterinaria ↔ Medicina

- Veterinary handle: `20.500.12104/21932`
- Medicine handle: `20.500.12104/34005`
- pairId: `program-conflict:3322dc3e62bae2076501`

Este par ya estaba protegido por T2AL/T2AM y debe permanecer estable.

### Veterinaria ↔ Psicología

- Veterinary handle: `20.500.12104/21949`
- Psychology handle: `20.500.12104/33882`
- pairId: `program-conflict:68c93d8fd08d35ae00aa`

## Simetría

Los dos pares nuevos añaden cuatro source records al structural-conflict matcher:

- veterinary 21606
- dentistry 33113
- veterinary 21949
- psychology 33882

La contraparte Psychology ya estaba blocked por la regla cohort-wide legacy.

Al pasar a `conflicted`:

- sigue blocked;
- cambia de low-trust a una clasificación más específica.

Los otros tres records eran unassessed/allowed y pasan a conflicted/blocked.

## Policy revision V3

Program Metadata Evidence Confidence pasa de:

`2026-11-02.v2`

a:

`2026-11-02.v3`

No cambia el schema.

La regla genérica:

`riudg-structural-program-metadata-conflicts-v1`

se amplía de:

**18 → 22 providerRecordIds**

No se agrega lógica específica de Veterinaria al motor.

## Full expected after V3

Confidence states:

- conflicted: **22**
- low-trust: **453**
- unassessed: **27,101**

Authority applicability:

- blocked: **475**
- allowed: **27,101**

Net new blocked:

**3**

La cuarta incorporación es Psychology 33882, que ya estaba blocked como low-trust.

## Program groups

### Psicología · 485

- conflicted: **7**
- low-trust: **453**
- unassessed: **25**
- blocked: **460**
- allowed: **25**

### Medicina · 1,383

Sin cambio:

- conflicted: **9**
- unassessed: **1,374**
- blocked: **9**
- allowed: **1,374**

### Odontología · 195

- conflicted: **3**
- unassessed: **192**
- blocked: **3**
- allowed: **192**

### Medicina Veterinaria Zootecnista · 1,340

- conflicted: **3**
- unassessed: **1,337**
- blocked: **3**
- allowed: **1,337**

Los cuatro grupos permanecen visibles en:

`metadata-review / metadata-confidence-review`

## Otras variantes veterinarias observadas

El full inventory contiene además:

- `Licenciatura en Médico Veterinario y Zootecnista`: **155**
- `Licenciatura en Veterinario y Zootecnista`: **5**
- `Licenciatura en Medicina Veterinaria y Zootecnia`: **1**

T2AO no las fusiona todavía en Program Authority.

La investigación institucional para V26 vendrá después de que la integridad item-level quede cerrada.

## Evidencia institucional para la fase siguiente

La Guía de Carreras UdeG vigente usa:

`Licenciatura en Medicina Veterinaria y Zootecnia`

y la clasifica en:

`Ciencias Biológico Agropecuarias`

CUSur usa simultáneamente:

- `Licenciatura en Médico Veterinario y Zootecnista`
- `Licenciatura en Medicina Veterinaria y Zootecnia`

Esto sugiere una misma línea programática, pero la decisión de aliases/lineage corresponde a V26, no a T2AO.

## Invariantes

T2AO no modifica:

- Program Authority V25;
- Institution Authority V2;
- Scope Policy V2;
- Admission Gate ordering;
- Boundary Closure V2;
- T2T;
- T2Y.

No usa topic semantics para decidir conflicto.

No crea V26.
