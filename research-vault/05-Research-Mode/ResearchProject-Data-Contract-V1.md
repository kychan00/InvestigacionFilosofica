---
type: data-contract
project: InvestigacionFilosofica
schema_version: 1.0.0-draft
status: proposed
updated: 2026-10-10
---

# ResearchProject · contrato de datos V1

## Propósito

`ResearchProject` es el registro portable y trazable de una investigación
filosófica. No es una carpeta de papers ni una conversación efímera con un
modelo. Debe conservar cómo una inquietud se convierte en problema, pregunta,
corpus, interpretación, hipótesis y protocolo.

Este contrato precede al runtime. Mientras permanezca `proposed`, ninguna
implementación debe tratarlo como formato estable.

## Principios normativos

1. La unidad organizadora es `Problem`; `Document` funciona como fuente.
2. Las revisiones importantes son inmutables: una nueva formulación sustituye
   a otra por referencia, no por sobrescritura silenciosa.
3. Toda interpretación puede recorrerse en sentido inverso hasta la evidencia
   y el documento.
4. Una propuesta de IA nunca se convierte automáticamente en decisión del
   investigador.
5. Los scores de retrieval describen recuperación, no verdad, calidad ni
   relevancia humana.
6. Una apertura encontrada en el corpus no autoriza afirmar que nadie ha
   investigado el tema.
7. La búsqueda básica sigue siendo independiente de `ResearchProject`.
8. El JSON canónico debe poder exportarse, importarse y validarse sin conexión.

## Identidad y versionado

Todos los IDs son opacos, estables dentro del proyecto y llevan prefijo de
tipo. Ejemplos: `rp_`, `pr_`, `q_`, `scope_`, `doc_`, `ev_`, `cl_`, `arg_`.

El proyecto contiene:

- `schema_version`: versión del contrato;
- `project_id`: identidad estable;
- `revision`: entero que aumenta en cada guardado aceptado;
- `created_at` y `updated_at`: fechas ISO 8601;
- `active_*_id`: punteros a las revisiones vigentes;
- `history`: eventos append-only con actor, motivo y objetos afectados.

`status` sigue la máquina de estados: `forming`, `scoping`,
`problematizing`, `questioning`, `designing`, `building_corpus`, `reading`,
`synthesizing`, `hypothesizing`, `testing`, `protocol_ready`, `completed` o
`archived`.

## Sobre común de entidades

Las entidades conservan, cuando corresponda:

- ID y tipo;
- `created_at`, `updated_at` y `created_by`;
- `status` de aceptación;
- `epistemic_layer`;
- `evidence_refs` y `source_refs`;
- `supersedes_id` para revisiones;
- `model_info` cuando intervino IA: proveedor, modelo, versión del prompt y
  fecha, sin almacenar secretos;
- `confidence` y justificación sólo para inferencias;
- `notes` separadas de los campos normativos.

La provenance describe origen y transformación; no convierte por sí sola una
inferencia en hecho.

## Capas epistémicas

Todo objeto que formule contenido debe declarar `epistemic_layer`:

- `bibliographic_fact`: dato procedente de metadata identificable;
- `textual_extraction`: cita breve o paráfrasis localizable en una fuente;
- `interpretive_inference`: reconstrucción o clasificación inferida;
- `researcher_assertion`: formulación adoptada por el investigador;
- `methodological_decision`: decisión de alcance, método o corpus.

`confidence` sólo es obligatorio para `interpretive_inference`. No se usa para
puntuar decisiones humanas ni para disfrazar ausencia de evidencia.

## Estado de aceptación

Los objetos interpretativos usan:

- `proposed`: sugerido, todavía no adoptado;
- `accepted`: aceptado explícitamente por el investigador;
- `rejected`: rechazado, conservando el motivo;
- `superseded`: reemplazado por una revisión posterior;
- `contested`: aceptado como objeto de trabajo, pero discutido;
- `unresolved`: no decidido por insuficiencia de evidencia.

Una propuesta creada por `system` o `ai` sólo puede pasar a `accepted` mediante
un evento posterior con actor `researcher`.

## Estructura raíz

```json
{
  "schema_version": "1.0.0-draft",
  "project_id": "rp_...",
  "revision": 1,
  "title": "...",
  "status": "forming",
  "locale": "es-MX",
  "created_at": "...",
  "updated_at": "...",
  "active_problem_id": "pr_...",
  "active_question_id": "q_...",
  "active_scope_id": "scope_...",
  "active_method_plan_id": "method_...",
  "active_hypothesis_id": null,
  "active_protocol_id": null,
  "intake": {},
  "problems": [],
  "questions": [],
  "concepts": [],
  "scope_revisions": [],
  "discipline_contributions": [],
  "method_plans": [],
  "query_plans": [],
  "documents": [],
  "corpus_entries": [],
  "evidence": [],
  "claims": [],
  "arguments": [],
  "positions": [],
  "relations": [],
  "controversies": [],
  "research_gaps": [],
  "hypotheses": [],
  "adversarial_tests": [],
  "protocols": [],
  "outputs": [],
  "history": []
}
```

## Núcleo metodológico

### `intake`

Conserva la entrada del investigador sin reinterpretarla:

- `concern_text`: inquietud original;
- `initial_terms`: autores, obras o conceptos mencionados;
- `motivation`: por qué importa al investigador;
- `desired_outcome`: exploración, artículo, tesis, curso u otro;
- `researcher_notes`: notas libres.

### `Problem`

- `problem_id` y `problem_kind`: problem o aporia;
- `statement`: dificultad filosófica, no pregunta gramatical;
- `stakes`: asunto teórico o práctico en juego;
- `tensions`: incompatibilidades, ambigüedades o aporías;
- `concept_ids`;
- `parent_problem_id`, cuando deriva de otro;
- `status`, autoría y provenance.

### `Concept`

- término y definición de trabajo;
- autor, obra, tradición, disciplina o periodo al que se atribuye el sentido;
- distinciones respecto de conceptos cercanos;
- evidencia y capa epistémica;
- relaciones con otras versiones del concepto;
- estado de aceptación.

### `Question`

- `question_id`;
- `problem_id`;
- `text`;
- `question_type`: conceptual, comparativa, crítica, histórica,
  genealógica, dialéctica, argumentativa, interdisciplinaria o
  interpretativa;
- `operation`: definir, relacionar, comparar, reconstruir, criticar,
  evaluar, seguir transformación, explicar tensión o examinar presupuesto;
- `supersedes_question_id`;
- `revision_reason`;
- `trigger_refs`: evidencia, lectura o decisión que produjo el cambio;
- `status` y autoría.

### `ScopeRevision`

- inclusiones y exclusiones explícitas;
- autores, obras, tradiciones, periodos, lenguas y regiones;
- conceptos que requieren definición;
- límites conocidos;
- `supersedes_scope_id` y motivo de revisión.

### `DisciplineContribution`

- disciplina y papel `primary` o `auxiliary`;
- aporte conceptual, evidencial, metodológico o contextual;
- función respecto de la pregunta;
- límite de transferencia;
- tipo de conclusión que permite y que no permite.

### `MethodPlan`

Versión explícita del diseño metodológico:

- operaciones elegidas;
- justificación por operación;
- orden previsto;
- evidencia requerida;
- limitaciones;
- criterios de revisión;
- referencias a pregunta, alcance y disciplinas vigentes.

## Búsqueda y corpus

### `Document`

Snapshot bibliográfico portable de una fuente incorporada al proyecto:

- identidad local y todos los identificadores originales;
- título, autores, año, revista, idioma y tipo de publicación;
- abstract cuando pueda conservarse;
- URL, DOI y fuente de metadata;
- fecha de importación;
- provenance de identidad exacta.

No almacena embeddings ni pesos. Su finalidad es que el proyecto siga siendo
comprensible y validable al importarse sin acceso inmediato a la API.

### `QueryPlan`

Es un artefacto derivado y regenerable, no la pregunta filosófica:

- pregunta y alcance de origen;
- consulta principal;
- variantes conceptuales y multilingües;
- subconsultas disciplinares;
- filtros;
- motor solicitado y motor realmente usado;
- fecha y versión del generador.

### `CorpusEntry`

No duplica el documento completo. Vincula una identidad bibliográfica con una
decisión del proyecto:

- `document_ref` e identificadores originales;
- `decision`: candidate, included o excluded;
- `document_role`: primary_work, secondary_source, commentary, critique,
  defense, reinterpretation, application, review o reference;
- razones de inclusión o exclusión;
- consulta que lo recuperó;
- scores de retrieval separados por nombre;
- actor y fecha de la decisión;
- grupo de identidad exacta y provenance, si existe.

La inclusión y exclusión son decisiones del investigador. El sistema puede
proponerlas, nunca confirmarlas silenciosamente.

## Lectura y evidencia

### `Evidence`

- `document_ref`;
- `evidence_type`: metadata, abstract, excerpt, section, table o full_text;
- `locator`: página, sección, párrafo, posición o URL estable;
- contenido breve o paráfrasis permitida;
- idioma;
- método de obtención;
- actor;
- fecha de acceso;
- límites de la evidencia.

Un abstract no prueba por sí solo la estructura completa de un argumento.

### `Claim`

- proposición;
- sujeto o autor atribuido;
- `claim_kind`: source_claim, researcher_claim o system_interpretation;
- evidencia directa y evidencia contraria;
- capa epistémica, confianza cuando corresponde y estado.

### `Argument`

- premisas como `claim_id`;
- conclusión como `claim_id`;
- supuestos;
- objeciones y respuestas vinculadas;
- tipo `textual` o `reconstructed`;
- evidencia y estado de aceptación.

### `Position`

Agrupa claims y argumentos coherentes respecto de un problema. No equivale
automáticamente a una persona: puede representar una obra, etapa, tradición o
familia de respuestas, siempre que esa decisión quede explícita.

## Relaciones, controversias y genealogía

### `Relation`

Arista tipada entre entidades:

- `source_ref` y `target_ref`;
- `relation_type`: formulates, addresses, defines, distinguishes,
  presupposes, supports, entails, objects_to, refutes, concedes,
  responds_to, qualifies, reframes, extends, integrates, transforms,
  inherits, applies, historicizes, opens_problem o closes_partially;
- evidencia;
- capa epistémica;
- actor, confianza y estado.

### `Controversy`

- problema organizador;
- posiciones participantes;
- puntos de desacuerdo;
- coincidencias parciales;
- evidencia por posición;
- cuestiones abiertas.

### `ResearchGap`

- descripción prudente de la apertura;
- corpus y fecha sobre los que se observa;
- estrategias de búsqueda ya realizadas;
- evidencia que apoya la apertura;
- explicaciones alternativas;
- formulación obligatoria como hallazgo limitado al corpus.

## Hipótesis y examen adversarial

### `HypothesisRevision`

- formulación del investigador;
- pregunta a la que responde;
- alcance vigente;
- evidencia favorable y contraria;
- supuestos;
- `supersedes_hypothesis_id` y motivo.

### `AdversarialTest`

- hipótesis objetivo;
- objeciones, contraejemplos e hipótesis rivales;
- fuentes y evidencia;
- respuesta del investigador;
- resultado: survives, revise, reject o unresolved;
- cambios recomendados, siempre como propuesta.

### `ProtocolRevision`

Snapshot aceptado de pregunta, alcance, disciplinas, método, corpus, hipótesis,
límites y criterios de continuación. Declara los IDs y revisiones exactos que
lo componen; no copia ni borra sus historiales.

## Historial y autoría

Cada evento de `history` registra:

- `event_id`, fecha y actor;
- acción;
- objeto y revisión afectados;
- motivo;
- inputs y outputs;
- modelo o herramienta, si intervino IA;
- aceptación humana posterior, cuando exista.

Los actores posibles son `researcher`, `system`, `ai`, `import` y
`external_reviewer`.

## Persistencia MVP

- Fuente portable: un archivo JSON canónico validable.
- Estado de trabajo local: IndexedDB.
- Importación y exportación deben conservar IDs, revisiones e historial.
- Markdown es una vista derivada, no la fuente de verdad.
- Obsidian es una exportación opcional, nunca requisito del runtime.
- No se requiere cuenta, backend de proyectos ni sincronización para el MVP.

## Subconjunto obligatorio para el primer MVP

El primer incremento sólo necesita implementar:

1. raíz e historial;
2. intake;
3. problemas;
4. preguntas versionadas;
5. alcance versionado;
6. aportes disciplinares;
7. plan metodológico;
8. query plan;
9. corpus seleccionable;
10. evidencia y notas;
11. hipótesis versionada;
12. exportación/importación JSON y Markdown.

Claims, argumentos, posiciones, controversias, genealogía y examen adversarial
permanecen en el contrato para evitar incompatibilidades futuras, pero pueden
llegar en incrementos posteriores.

## Gates antes de implementación

- revisión humana del vocabulario y los estados;
- fixture mínimo y fixture completo válidos;
- prueba conceptual de versionado Q1 → Q2 sin pérdida;
- prueba de trazabilidad interpretación → evidencia → documento;
- prueba de que una propuesta de IA no puede autoaceptarse;
- round-trip JSON sin pérdida;
- decisión explícita sobre migraciones entre versiones del esquema.

## Relacionado

- [[Research-Mode-Flow-V1]]
- [[Epistemological-Model]]
- [[Research-Spiral]]
- [[Interdisciplinarity]]
- [[ADR-002-ai-traceability]]
- [[ADR-003-obsidian-not-runtime]]
