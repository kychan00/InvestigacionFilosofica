---
type: data-contract
status: draft
version: 0.1
updated: 2026-09-27
---

# ResearchProject Contract

## Propósito

`ResearchProject` representa una investigación filosófica como proceso revisable, trazable y versionado.

No es sólo una carpeta de documentos. Debe conservar:

- cómo nació el problema;
- cómo cambió la pregunta;
- qué decisiones metodológicas tomó el investigador;
- qué corpus fue incluido y excluido;
- qué afirmaciones y argumentos fueron reconstruidos;
- qué evidencia sostiene cada atribución;
- qué controversias y problemas abiertos aparecieron;
- cómo cambió la hipótesis propia.

## Principio rector

```text
ResearchProject
      │
      ├── problema
      ├── preguntas versionadas
      ├── conceptos
      ├── disciplinas
      ├── métodos
      ├── corpus
      ├── evidencia
      ├── claims
      ├── argumentos
      ├── posiciones
      ├── controversias
      ├── genealogía
      ├── hipótesis
      └── decisiones del investigador
```

## Identidad mínima

```js
{
  id,
  title,
  createdAt,
  updatedAt,
  status,
  language,
  ownerMode
}
```

### status

Valores iniciales:

- `exploration`
- `delimitation`
- `state_of_art`
- `hypothesis`
- `argumentation`
- `writing`
- `archived`

`ownerMode` no implica cuentas en el MVP. Permite distinguir un proyecto personal de una plantilla o ejemplo público.

---

## 1. Inquiry

Registra la inquietud inicial antes de que exista una pregunta estable.

```js
inquiry: {
  rawText,
  initialConcepts: [],
  initialAuthors: [],
  initialWorks: [],
  motivations: []
}
```

La motivación pertenece al investigador y no debe ser inferida automáticamente.

---

## 2. Problem

```js
problem: {
  id,
  formulation,
  description,
  stakes,
  tensions: [],
  aporias: [],
  boundaries: {
    includes: [],
    excludes: []
  }
}
```

### Regla

El problema puede persistir aunque cambie su formulación.

No debe confundirse con una sola pregunta.

---

## 3. Question history

```js
questions: [
  {
    id,
    version,
    text,
    type,
    createdAt,
    status,
    changeReason,
    triggeredBy: [],
    replaces
  }
]
```

### type

Valores iniciales:

- `conceptual`
- `interpretive`
- `comparative`
- `critical`
- `historical`
- `genealogical`
- `dialectical`
- `argumentative`
- `interdisciplinary`

### Regla

Nunca sobrescribir silenciosamente una pregunta.

Toda reformulación debe conservar su genealogía:

```text
Q1 → Q2 → Q3
```

---

## 4. Concepts

```js
concepts: [
  {
    id,
    label,
    aliases: [],
    description,
    usages: [],
    relations: []
  }
]
```

Un mismo término puede representar sentidos distintos.

`usage` debe poder asociarse a autor, obra, periodo o tradición.

Esto permitirá diferenciar:

```text
palabra
≠ concepto
≠ uso histórico del concepto
```

---

## 5. Disciplines

```js
disciplines: [
  {
    id,
    name,
    role,
    contribution,
    importedConcepts: [],
    importedMethods: [],
    importedEvidenceTypes: [],
    transferLimits: []
  }
]
```

### role

- `primary`
- `auxiliary`
- `integrated`

### Regla

Una disciplina no entra sólo porque produjo resultados de búsqueda.

Debe registrarse qué función cumple dentro del problema.

→ [[Interdisciplinarity]]

---

## 6. Methodology

```js
methodology: {
  approaches: [],
  operations: [],
  rationale,
  revisions: []
}
```

Ejemplos de operaciones:

- delimitar;
- definir;
- analizar;
- comparar;
- reconstruir;
- contextualizar;
- identificar presupuestos;
- evaluar inferencias;
- buscar objeciones;
- integrar posiciones.

La metodología debe poder volverse progresivamente **ejecutable**: cada operación debe indicar qué entrada utiliza y qué salida produce.

---

## 7. Corpus

```js
corpus: {
  inclusionCriteria: [],
  exclusionCriteria: [],
  documents: []
}
```

Cada documento incluido:

```js
{
  documentId,
  role,
  inclusionReason,
  addedAt,
  decision: "included" | "excluded" | "pending",
  decisionBy: "researcher" | "system-suggestion",
  exclusionReason
}
```

### role

Valores iniciales:

- `primary_source`
- `commentary`
- `interpretation`
- `critique`
- `defense`
- `reformulation`
- `application`
- `comparison`
- `review`
- `dissertation`
- `divulgation`
- `other`

La clasificación automática siempre debe poder corregirse manualmente.

---

## 8. Evidence

```js
evidence: [
  {
    id,
    documentId,
    evidenceType,
    locator,
    text,
    provenance,
    confidence
  }
]
```

### evidenceType

- `metadata`
- `title`
- `keywords`
- `abstract`
- `introduction`
- `full_text`
- `citation_context`
- `researcher_note`

### provenance

Debe registrar de dónde provino el contenido y cuándo fue recuperado.

---

## 9. Claims

```js
claims: [
  {
    id,
    text,
    subject,
    attributedTo,
    claimType,
    epistemicLayer,
    evidenceIds: [],
    confidence,
    status
  }
]
```

### epistemicLayer

- `bibliographic_fact`
- `textual_extraction`
- `interpretive_inference`
- `researcher_claim`

### Regla

Una inferencia de IA nunca puede presentarse como si fuera una extracción textual.

→ [[ADR-002-ai-traceability]]

---

## 10. Arguments

```js
arguments: [
  {
    id,
    conclusionClaimId,
    premiseClaimIds: [],
    type,
    attributedTo,
    evidenceIds: [],
    reconstructionStatus,
    confidence
  }
]
```

### reconstructionStatus

- `explicit`
- `reconstructed`
- `researcher_confirmed`
- `contested`

---

## 11. Relations

Las relaciones conectan problemas, conceptos, claims, argumentos y posiciones.

```js
relations: [
  {
    id,
    sourceType,
    sourceId,
    relationType,
    targetType,
    targetId,
    evidenceIds: [],
    epistemicLayer,
    confidence,
    confirmedByResearcher
  }
]
```

### relationType inicial

- `formulates`
- `addresses`
- `defines`
- `distinguishes`
- `presupposes`
- `supports`
- `entails`
- `objects_to`
- `refutes`
- `concedes`
- `responds_to`
- `qualifies`
- `reframes`
- `extends`
- `integrates`
- `transforms`
- `inherits`
- `applies`
- `historicizes`
- `opens_problem`

→ [[Dialectical-Genealogy]]

---

## 12. Positions and controversies

```js
positions: [
  {
    id,
    label,
    problemIds: [],
    claimIds: [],
    argumentIds: [],
    representatives: [],
    period
  }
]
```

```js
controversies: [
  {
    id,
    label,
    problemId,
    positionIds: [],
    centralQuestionIds: [],
    unresolvedPoints: []
  }
]
```

Una posición no debe inferirse sólo por similitud semántica. Debe haber evidencia suficiente para agrupar claims y argumentos.

---

## 13. Hypothesis history

```js
hypotheses: [
  {
    id,
    version,
    text,
    createdAt,
    status,
    supportingClaimIds: [],
    challengingClaimIds: [],
    assumptions: [],
    revisionReason
  }
]
```

El sistema puede buscar evidencia que fortalezca o desafíe una hipótesis, pero el investigador decide si la mantiene, restringe o abandona.

---

## 14. Researcher layer

Debe existir una capa explícita separada de la interpretación automática.

```js
researcher: {
  notes: [],
  interpretations: [],
  objections: [],
  decisions: [],
  citations: [],
  links: []
}
```

El objetivo es que la plataforma ayude a pensar, no que haga desaparecer al investigador.

---

## 15. State of the art

No se almacena sólo como texto final.

Debe derivarse de estructuras verificables:

```js
stateOfArt: {
  periods: [],
  positions: [],
  controversies: [],
  continuities: [],
  transformations: [],
  openProblems: [],
  apparentGaps: [],
  synthesisArtifacts: []
}
```

### Regla epistemológica

Un `apparentGap` significa:

> dentro del corpus y criterios consultados no se recuperó evidencia suficiente.

Nunca:

> nadie ha investigado esto.

---

## 16. Audit trail

Toda modificación sustantiva debe poder registrar:

```js
{
  timestamp,
  actor,
  action,
  entityType,
  entityId,
  reason
}
```

Esto permitirá reconstruir no sólo la historia del problema sino también la historia de la investigación.

---

## Contrato MVP

La primera implementación no necesita cubrir todo lo anterior.

El MVP debe soportar como mínimo:

1. `ResearchProject`
2. `Inquiry`
3. `Problem`
4. historial de `Question`
5. `Disciplines`
6. `Methodology`
7. `Corpus`
8. `Evidence`
9. `Claims`
10. decisiones del investigador
11. exportación JSON + Markdown

El resto puede incorporarse progresivamente sin romper el contrato.

## Preguntas abiertas

- ¿Qué identificadores deben ser UUID y cuáles pueden derivarse?
- ¿Qué parte se persiste en navegador durante el MVP?
- ¿Cómo versionar grandes corpus sin duplicar datos?
- ¿Qué relaciones requieren confirmación humana obligatoria?
- ¿Cómo representar páginas, párrafos y ubicaciones cuando una fuente no ofrece texto estable?
- ¿Cómo distinguir una posición histórica de una clasificación retrospectiva?

## Relacionado

- [[Epistemological-Model]]
- [[Research-Mode]]
- [[Research-Spiral]]
- [[ADR-001-problem-as-core-unit]]
- [[ADR-002-ai-traceability]]
