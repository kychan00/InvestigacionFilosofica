# RA1 — Contratos de datos V1 del Atlas de Investigación

## Estado

**Fase RA1 — contratos ejecutables y fixtures. Sin integración de producto.**

Este documento convierte `RESEARCH_ATLAS_ARCHITECTURE_V1.md` en estructuras verificables.

RA1 añade:

- `src/core/research-atlas-contract.js`;
- `benchmark/research-atlas/v1/fixtures.json`;
- `tests/research-atlas-contract.test.mjs`;
- `docs/RESEARCH_ATLAS_FIXTURES_V1.md`.

No añade UI, renderer, layout, llamadas de red ni integración con el buscador.

---

## 1. Unidad superior: ResearchAtlasSnapshot

Schema:

`research-atlas-snapshot-v1`

Un snapshot contiene exclusivamente:

- `session`;
- `nodes[]`;
- `edges[]`;
- `evidence[]`;
- `diagnostics`.

El snapshot es la frontera entre el futuro Graph Assembler y cualquier renderer.

La UI no deberá reconstruir reglas bibliográficas a partir de pixels.

---

## 2. ResearchAtlasSession

Representa una búsqueda concreta y efímera.

Campos obligatorios:

- `id`;
- `rawQuery`;
- `normalizedQuery`;
- `queryNodeRef`;
- `searchMode`;
- `state`;
- `filters`;
- `sourceRevisions`.

Modos V1:

- `traditional`;
- `semantic-service`;
- `browser-semantic`.

Si el modo es `browser-semantic`, el contrato exige:

`semantic.browserOptIn === true`

Esto no activa el modo: sólo impide representar como legítima una sesión browser-semantic sin consentimiento explícito.

La sesión rechaza campos sensibles como password, token, cookie, authorization o credentials en cualquier profundidad.

---

## 3. Nodos V1

### query

Existe exactamente uno por snapshot.

Representa la consulta, no una entidad bibliográfica.

### work

Representa una obra ya normalizada por la búsqueda.

Campos obligatorios:

- título;
- identidad;
- proveedores;
- estado de descubrimiento.

La identidad se expresa como:

```json
{
  "kind": "doi",
  "key": "doi:10.1234/example"
}
```

Dos WorkNode con la misma `identity.key` son inválidos.

Esto formaliza que el Atlas no conserva duplicados que el motor ya debería haber fusionado.

### authority-person

Sólo representa una AuthorityPerson existente.

Exige:

- `authorityRef`;
- nombre de presentación;
- estado `confirmed` o `probable`.

No admite `ambiguous` ni `unresolved` como persona canónica.

### author-mention

Representa una mención todavía no resuelta.

Exige:

- `mentionRef`;
- cadena original;
- `sourceRecordRefs`;
- estado `ambiguous` o `unresolved`.

RA1 añade una precisión necesaria a RA0: una mención no resuelta se conecta con su obra mediante una arista `author-mention`, nunca mediante `contribution`.

---

## 4. Descubrimiento

Cada WorkNode declara:

- `directHit`;
- `origins[]`.

Orígenes V1:

- `direct-search`;
- `related-work-expansion`;
- `author-expansion`;
- `manual-expansion`.

Toda obra con `directHit: true` debe:

1. declarar `direct-search`;
2. poseer una arista `query-result`.

Una obra expandida no puede recibir silenciosamente una arista `query-result`.

---

## 5. Evidencia

La evidencia vive en una colección separada.

Clases V1:

- `factual`;
- `derived`;
- `provisional`.

Cada evidencia exige:

- ID;
- clase;
- fuente;
- payload.

Las aristas referencian `evidenceRefs`.

No se permite una arista sin evidencia.

---

## 6. Aristas V1

### query-result

`query → work`

Debe probar que la obra fue un hit directo mediante evidencia factual de:

- proveedor;
- posición;
- matched query.

### contribution

`authority-person → work`

Debe incluir evidencia factual que contenga:

- role;
- authorityRef;
- sourceRecordRefs.

La AuthorityPerson de la evidencia debe coincidir con la del nodo.

### author-mention

`author-mention → work`

Siempre es `provisional`.

Nunca se transforma visualmente en autoría confirmada.

### semantic-neighbor

`work ↔ work`

Es `derived`.

Exige:

- modelId;
- modelRevision;
- metric;
- score.

Sin modelo/revisión no existe arista semántica publicable.

### lexical-neighbor

`work ↔ work`

Es `derived`.

Exige método y score propios.

No se mezcla con el score semántico.

### same-author

`work ↔ work`

Es derivada y exige `authorityRefs`.

La igualdad de strings no sirve.

### coauthor

`authority-person ↔ authority-person`

Es derivada desde obras con contribuciones verificadas.

Exige `supportWorkRefs`.

### shared-coauthor

`authority-person ↔ authority-person`

Exige:

- `sharedAuthorityRefs`;
- `supportWorkRefs`.

### related-work

`work ↔ work`

Consume una relación ya construida.

Exige:

- `relationEdgeRef`;
- `indexRevision`.

### citation

`work → work`

Sólo es válida con evidencia factual y:

- `explicitBibliographicEdge: true`;
- `sourceRecordRefs`.

Una relación semántica nunca satisface este contrato.

### influence

No existe en el vocabulario V1.

Por tanto se rechaza.

---

## 7. Estados de arista

V1 acepta:

- `confirmed`;
- `probable`;
- `derived`;
- `provisional`.

El tipo de arista impone reglas adicionales.

Ejemplo:

- `semantic-neighbor` debe ser `derived`;
- `author-mention` debe ser `provisional`.

---

## 8. Invariantes de snapshot

El validador rechaza:

1. schemas desconocidos;
2. sesión incompleta;
3. secretos dentro de sesión;
4. browser-semantic sin opt-in explícito;
5. IDs duplicados;
6. identidades de obra duplicadas;
7. AuthorityPerson duplicada;
8. referencias a nodos inexistentes;
9. referencias a evidencia inexistente;
10. self-edges;
11. más de un QueryNode;
12. queryNodeRef inconsistente;
13. hit directo sin query-result;
14. query-result hacia obra expandida;
15. contribution desde una mención;
16. author-mention marcada como confirmada;
17. semantic-neighbor sin modelo/revisión;
18. same-author sin Authority refs;
19. coauthor sin obras de soporte;
20. citation sin evidencia bibliográfica explícita;
21. influence o tipos desconocidos;
22. diagnostics que no correspondan con los nodos reales.

---

## 9. Diagnostics

V1 permite comprobar cuatro conteos:

- `directHits`;
- `expandedWorks`;
- `authorityPersons`;
- `unresolvedMentions`.

Estos números son derivados.

No son fuente de verdad.

---

## 10. Qué no resuelve RA1

RA1 todavía no define:

- Graph Assembler;
- orden de llegada;
- política de actualización de nodos;
- layout;
- clusters;
- pesos de fuerzas;
- renderer;
- UI;
- límites de expansión;
- thresholds de benchmark;
- ranking de relaciones.

Eso pertenece a RA2+.

---

## 11. Cierre de RA1

RA1 está completo cuando:

1. el contrato es ejecutable;
2. los fixtures cubren positivos y negativos;
3. `npm test` incluye el contrato;
4. no hay imports desde producción hacia el módulo;
5. ninguna regla exige una fuente nueva;
6. no cambia SearchResponse;
7. no cambia producción.
