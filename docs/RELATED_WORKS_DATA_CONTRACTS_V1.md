# Related Works — Contratos de datos V1

## Estado

**Fase 0 — contrato y evaluación.**

Este documento convierte `record-related-works-architecture-v1.md` en un contrato verificable. No construye todavía el índice de relaciones, no modifica la ficha y no define pesos finales de ranking.

El objetivo es fijar qué significa una relación válida antes de optimizar relevancia.

---

## 1. Principio central

El sistema no produce recomendaciones opacas.

Produce **aristas de relación bibliográfica** entre una obra semilla y una obra objetivo.

Toda arista debe responder:

1. qué obras conecta;
2. qué tipos de relación afirma;
3. qué evidencia sustenta cada afirmación;
4. qué señales numéricas fueron observadas;
5. qué versión del índice/algoritmo produjo la arista.

Una arista puede tener varias relaciones simultáneas.

Ejemplo:

- afinidad semántica;
- misma autora;
- concepto compartido.

No deben colapsarse en una sola etiqueta genérica.

---

# 2. RelatedWorkEdge

Entidad principal del contrato.

Campos conceptuales:

- `schemaVersion`;
- `id`;
- `seed`;
- `target`;
- `relationTypes[]`;
- `signals`;
- `evidence[]`;
- `reasons[]`;
- `identity`;
- `ranking` — reservado para fases posteriores;
- `provenance` — versión de artefactos y dataset.

## 2.1 seed / target

Cada extremo debe contener como mínimo:

- `identity`: identidad bibliográfica estable;
- título, año y autor pueden añadirse como información de presentación.

La identidad sigue el orden de autoridad ya definido en el proyecto:

1. DOI normalizado;
2. OpenAlex Work ID;
3. identificador estable de proveedor;
4. identidad curada;
5. fallback controlado de obra.

La identidad visible de un proveedor no debe convertirse automáticamente en identidad intelectual canónica.

## 2.2 Invariantes

- `seed.identity !== target.identity`;
- una versión de la misma obra intelectual no se presenta como «obra relacionada»;
- toda arista contiene al menos un tipo de relación;
- toda arista contiene evidencia;
- toda razón de UI apunta a evidencia existente;
- una señal numérica normalizada vive en `[0,1]`;
- la proximidad temporal por sí sola no crea una relación;
- la semántica por sí sola no prueba autoría, coautoría ni citación.

---

# 3. Familias de relación

La familia sirve para diversidad, interfaz y evaluación.

## 3.1 semantic

### semantic-affinity

La representación semántica de ambas obras muestra afinidad suficientemente alta.

Fuente prevista:

- índice Qwen3 precalculado.

Puede existir sin otra señal.

No implica:

- misma tradición;
- mismo autor;
- citación;
- acuerdo filosófico.

---

## 3.2 philosophical

### shared-topic

Comparte un topic estructurado.

No debe derivarse sólo de una palabra coincidente en título.

### shared-concept

Comparte un concepto filosófico estructurado, por ejemplo:

- libertad;
- causalidad;
- mente-cuerpo.

Las fuentes previstas son el corpus y `philosophy-map.json`.

### same-debate

Ambas obras participan justificadamente en el mismo problema/debate.

Es una relación más interpretativa que `shared-concept`.

V1 debe exigir señales estructuradas suficientes; no se construye únicamente por proximidad temporal.

---

## 3.3 authorship

### same-author

Las obras comparten al menos una autoridad personal resuelta.

No basta:

- el mismo string;
- el mismo apellido;
- una mención en el título.

La evidencia debe referenciar identidad estructurada.

### shared-coauthor

Las obras comparten una autoridad de colaboración resuelta.

La red de coautoría se deriva del Author Authority Graph o una fuente bibliográfica equivalente.

---

## 3.4 bibliographic

Estas relaciones son las más estrictas.

### cited-by-seed

La obra semilla contiene una referencia explícita a la obra objetivo.

### cites-seed

La obra objetivo contiene una referencia explícita a la semilla.

### bibliographic-reference

Existe otra relación bibliográfica estructurada y verificable que no se expresa mejor con las dos anteriores.

Requisitos de V1:

- evidencia de clase `bibliographic` o superior;
- identidad estructurada;
- arista bibliográfica explícita.

**Prohibición:** similitud semántica, coincidencia de título o cercanía temática no pueden transformarse en una afirmación de citación.

---

## 3.5 historical

### historical-context

Refuerza otra relación mediante contexto temporal documentado.

Ejemplos futuros:

- mismo momento de un debate;
- recepción posterior;
- proximidad en una secuencia editorial.

**No puede ser la única relación de una arista.**

El año por sí solo nunca crea una recomendación.

---

# 4. Clases de evidencia

Las clases expresan qué tipo de dato es la evidencia, no un porcentaje de certeza.

## 4.1 deterministic

Identificador o relación que establece directamente una identidad compatible.

Ejemplos:

- DOI canónico;
- Work ID;
- resolución obra/version verificada.

## 4.2 bibliographic

Metadatos bibliográficos estructurados.

Ejemplos:

- AuthorityPerson compartida;
- coautor resuelto;
- tabla de referencias;
- relación explícita de fuente.

## 4.3 semantic

Resultado de representación vectorial.

Ejemplo:

- vecino Qwen3 con score semántico.

## 4.4 contextual

Señales estructuradas que apoyan una relación pero no prueban identidad.

Ejemplos:

- topic;
- concepto;
- área;
- fecha.

Jerarquía utilizada únicamente para mínimos contractuales:

```text
contextual < semantic < bibliographic < deterministic
```

Esto no significa que un identificador determinista sea «más filosóficamente relacionado» que un vecino semántico; sólo que es una evidencia más fuerte para afirmaciones que exigen identidad.

---

# 5. Fuerza de evidencia

Cada `EvidenceAssertion` dentro de una arista declara:

- `veto`;
- `strong`;
- `supporting`;
- `weak`.

La fuerza no sustituye a la clase.

Ejemplo:

- evidencia semántica strong sigue sin ser evidencia bibliográfica;
- evidencia contextual strong sigue sin demostrar autoría.

Una evidencia `veto` representa una contradicción que debe eliminar la arista antes de su publicación final.

---

# 6. EvidenceAssertion

Campos mínimos:

- `id`;
- `class`;
- `strength`;
- `source`.

Campos especializados posibles:

- `semanticScore`;
- `topicIds[]`;
- `conceptIds[]`;
- `areaIds[]`;
- `authorityRefs[]`;
- `sharedAuthorityRefs[]`;
- `sourceRecordRefs[]`;
- `structuredIdentity`;
- `explicitBibliographicEdge`;
- metadatos de dataset/revisión.

La evidencia conserva la fuente. Una razón nunca debe construirse a partir de información no conservada en la arista o recuperable por referencia.

---

# 7. RelationReason

Objeto destinado a explicar la relación sin generar texto libre arbitrario.

Campos:

- `code`;
- `relationType`;
- `evidenceRefs[]`.

En la interfaz, el texto se deriva de `code` + evidencia.

Ejemplos:

```text
same-author
→ Misma autora · Dinora Hernández López

shared-concept
→ Concepto compartido · libertad

semantic-affinity
→ Afinidad conceptual
```

La UI futura puede adaptar idioma y longitud sin cambiar la semántica del contrato.

---

# 8. signals

Vector de señales observado antes del ranking.

Campos previstos:

- `semantic`;
- `topic`;
- `philosophical`;
- `author`;
- `coauthor`;
- `citation`;
- `bibliographic`;
- `temporal`;
- `metadataConfidence`.

Los valores normalizados, cuando sean numéricos, deben vivir entre 0 y 1.

**Fase 0 no define la fórmula de combinación.**

Los pesos se calibrarán en el benchmark humano de la fase de ranking.

---

# 9. Separación entre señales y afirmaciones

Ésta es una regla crítica.

Una señal responde:

> ¿Qué observamos?

Una relación responde:

> ¿Qué estamos autorizados a afirmar?

Ejemplos:

### Permitido

```text
semantic = .94
→ semantic-affinity
```

### Prohibido

```text
semantic = .94
→ cites-seed
```

### Permitido

```text
authorityRef compartida
→ same-author
```

### Prohibido

```text
nombre normalizado idéntico
→ same-author
```

---

# 10. Identidad obra/version

El resolver debe distinguir:

- misma obra;
- versión/edición de la misma obra;
- obra distinta relacionada.

Una versión distinta de la misma obra puede aparecer dentro de la propia ficha como información de edición en el futuro, pero **no debe ocupar un espacio de Obras relacionadas**.

El contrato utiliza conceptualmente:

```js
identity.sameIntellectualWork
```

Si es `true`, la arista no es publicable como RelatedWorkEdge.

---

# 11. Contrato del índice offline

La Fase 1 producirá un artefacto `related-work-index-v1`.

El contrato lógico de un registro será compatible con RelatedWorkEdge, aunque el formato físico use nombres compactos.

Debe conservar, como mínimo:

- identidad seed;
- identidad target;
- señales necesarias;
- evidencia/referencias mínimas;
- tipos de relación preliminares o datos suficientes para reconstruirlos;
- revisión del corpus;
- versión de generador.

Los scores semánticos no sustituyen a metadatos bibliográficos.

---

# 12. Contrato de runtime futuro

Interfaz conceptual:

```js
getRelatedWorks(seed, {
  limit: 6,
  diversity: true,
  signal
})
```

Respuesta conceptual:

```js
{
  schemaVersion: "related-work-response-v1",
  seed,
  edges,
  coverage: {
    indexed: true,
    fallbacksUsed: [],
    partial: false
  },
  provenance: {
    relationIndexVersion,
    datasetRevision,
    algorithmVersion
  }
}
```

La sección puede fallar sin romper la ficha.

---

# 13. Diversidad: contrato, no peso

La Fase 0 sólo fija la intención:

- evitar versiones duplicadas;
- evitar seis obras consecutivas del mismo autor cuando existan alternativas relevantes;
- conservar relaciones de familias diferentes cuando la calidad lo permita;
- nunca introducir una relación débil sólo para llenar una cuota.

La fórmula exacta pertenece a una fase posterior.

---

# 14. Umbral de publicación

Una arista no se publica si:

- es autorelación;
- es otra versión de la misma obra intelectual;
- carece de evidencia;
- carece de una razón explicable;
- alguna relación exige identidad estructurada y no existe;
- una relación bibliográfica carece de arista explícita;
- una contradicción `veto` sigue activa;
- sólo existe proximidad histórica;
- el candidato fue descartado por deduplicación.

---

# 15. Compatibilidad con Author Authority Graph

Related Works no crea un segundo modelo de autor.

Debe consumir:

- AuthorityPerson;
- Contributions;
- obra/versión;
- decisiones de identidad.

Toda relación de autoría usa IDs canónicos cuando estén disponibles.

Esto evita que la sección de relacionadas vuelva a introducir problemas ya resueltos en perfiles de autor.

---

# 16. Compatibilidad con futura constelación 2D

La arista debe ser directamente representable como:

```text
seed node
   │
   ├── relationTypes
   ├── signals
   ├── reasons
   └── evidence
   │
target node
```

La vista 2D no tendrá un algoritmo alternativo.

Sólo será otra proyección del mismo grafo.

---

# 17. Contrato ejecutable

La primera versión se implementa en:

`src/core/related-work-contract.js`

y se congela con:

`tests/related-work-contract.test.mjs`

`benchmark/related-works/v1/fixtures.json`

La implementación del builder de Fase 1 deberá producir objetos que superen este validador antes de publicarse.
