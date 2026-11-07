# RA3 — Integración del Author Authority Graph

## Estado

**Fase RA3 — identidad de personas y relaciones de autoría dentro del Research Atlas.**

RA3 extiende el pipeline:

```text
SearchResponse
      │
      ▼
RA2 Graph Assembler
      │
      ▼
WorkNodes
      │
      ├──────── structured authors ────────┐
      │                                     │
      └──────── authority-work-map-v1 ─────┤
                                            ▼
                                  Author Authority Graph
                                            │
                         ┌──────────────────┴──────────────────┐
                         ▼                                     ▼
                 AuthorityPerson                       AuthorMention
                   confirmed                         unresolved/ambiguous
                         │                                     │
                         ▼                                     ▼
                   contribution                         provisional edge
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
        same-author               coauthor
```

RA3 no añade UI ni llamadas de red.

---

## 1. Problema que resuelve

El payload ligero de OpenAlex Philosophy utilizado por la búsqueda principal contiene:

`authors: []`

Esto es deliberado para mantener ligera la recuperación.

Por tanto el Atlas no puede depender exclusivamente de `SearchResponse.result.authors`.

El proyecto ya dispone del puente epistemológicamente correcto:

`authority-work-map-v1`

que fue construido mediante:

```text
author-index work-authors
       ↓
OpenAlex Author IDs
       ↓
Author Authority registry
       ↓
AuthorityPerson confirmadas
       ↓
work → AuthorityPerson
```

RA3 reutiliza ese puente.

---

## 2. Dos rutas de evidencia

### Ruta A — Authority Work Map

Cuando una obra OpenAlex aparece en el bridge:

- se leen únicamente AuthorityPerson confirmadas;
- se recupera su metadata desde `authorityGraph.authorities`;
- se crea una Contribution factual;
- los autores sin autoridad confirmada declarados en `u` no se convierten en personas anónimas.

### Ruta B — autores estructurados del SearchResponse

Cuando el resultado ya incluye autores:

- se crea internamente un AuthorMention con los adaptadores existentes;
- se inspeccionan ORCID/OpenAlex Author ID/Wikidata;
- sólo un identificador que ya existe en `identifierRegistry` puede confirmar automáticamente una AuthorityPerson.

La igualdad nominal nunca confirma.

---

## 3. Conflicto de identificadores

Si una misma mención contiene identificadores que apuntan a dos AuthorityPerson distintas:

```text
OpenAlex A123 → Authority A
ORCID X       → Authority B
```

RA3 produce:

`AuthorMention · ambiguous`

No elige una.

No crea Contribution.

---

## 4. Menciones nominales sin identificador

Ejemplo:

`José Martínez`

sin ORCID/OpenAlex Author ID y sin ResolutionDecision previo.

Resultado:

`AuthorMention · unresolved`

Puede aparecer en el Atlas como mención provisional.

No se convierte en AuthorityPerson.

No participa en:

- same-author;
- coauthor;
- shared-coauthor.

---

## 5. Contribution

Endpoint:

`AuthorityPerson → WorkNode`

Toda Contribution exige evidencia factual con:

- authorityRef;
- role;
- sourceRecordRefs;
- método de resolución.

Fuentes RA3:

- `authority-work-map-v1`;
- `author-authority-graph-v1`.

Si ambas rutas sostienen la misma pareja persona/obra, RA3 conserva **una sola arista** y acumula ambas evidencias.

---

## 6. AuthorityPersonNode

RA3 no crea una persona nueva.

El nodo referencia exactamente:

`AuthorityPerson.id`

del Author Authority Graph.

Incluye como metadata de presentación:

- canonicalName;
- names;
- externalIdentifiers;
- affiliations;
- revisión observada.

---

## 7. AuthorMentionNode

Una mención no resuelta conserva:

- rawName;
- normalizedName;
- sourceRecordRefs;
- identificadores embebidos;
- role;
- estado;
- candidatos en conflicto cuando existan.

Su arista hacia WorkNode siempre es:

`author-mention · provisional`

---

## 8. Same Author

Se deriva sólo después de tener Contributions confirmadas.

Dos obras reciben `same-author` cuando comparten al menos una AuthorityPerson.

La evidencia contiene:

`authorityRefs[]`

No se compara el texto de nombres.

---

## 9. Coauthor

Se deriva cuando dos AuthorityPerson tienen Contribution confirmada sobre la misma WorkNode.

La evidencia contiene:

`supportWorkRefs[]`

Si colaboran en varias obras, se conserva una arista con múltiples obras de soporte.

---

## 10. Authority Work Map incompleto

El campo:

`u`

indica autores observados sin AuthorityPerson confirmada.

RA3:

- los cuenta en diagnostics;
- no inventa nombre;
- no crea nodo anónimo;
- no concluye que la obra sea individual.

La ausencia de una autoridad confirmada es ausencia de resolución, no ausencia de autoría.

---

## 11. Identidad de obra

RA3 no define otra identidad.

Reutiliza:

`resultIdentityKey()`

de RA2/merge-results.

Para localizar el Authority Work Map extrae además OpenAlex Work IDs observados desde:

- openalexId;
- id;
- URL canónica;
- SourceRecord.

Esto permite que la identidad visual siga siendo la obra canónica mientras la evidencia de autoridad conserve su origen OpenAlex.

---

## 12. Determinismo

El resultado no cambia por:

- orden de AuthorityPerson;
- orden de filas del Authority Work Map;
- orden de autores confirmados dentro de una fila;
- doble evidencia de la misma Contribution.

Nodes, edges y evidence se ordenan por IDs estables.

---

## 13. Fallos cerrados

RA3 aborta si:

- Authority Work Map apunta a una AuthorityPerson inexistente;
- identifierRegistry apunta a una AuthorityPerson inexistente;
- un SearchResult no encuentra su WorkNode RA2;
- el snapshot enriquecido viola RA1.

No degrada silenciosamente esos casos.

---

## 14. Diagnostics RA3

Se añade:

`diagnostics.authority`

con:

- revision;
- graphBuildRevision;
- workMapBuildRevision;
- structuredMentions;
- resolvedMentions;
- ambiguousMentions;
- unresolvedMentions;
- workMapRowsMatched;
- workMapConfirmedContributions;
- unresolvedAuthorityObservations;
- confirmedContributionEdges;
- sameAuthorEdges;
- coauthorEdges.

Los diagnostics no son fuente de verdad.

---

## 15. Integración con ResearchAtlasAssembler

Si el contexto no contiene `authorityGraph`:

RA2 se comporta exactamente igual.

Si contiene:

- `authorityGraph`;
- opcionalmente `authorityWorkMap`;

el assembler ejecuta RA3 después de construir y validar el snapshot base.

Por tanto la integración es opt-in y sin red.

---

## 16. Límites actuales

RA3 todavía no:

- descarga shards de Authority Graph;
- publica Authority Work Map al navegador;
- resuelve nombres por heurística;
- crea ConceptNode;
- genera semantic-neighbor;
- carga Related Work Index;
- dibuja el mapa.

La futura capa de runtime deberá cargar únicamente los shards necesarios.

---

## 17. Próxima fase

RA4 conectará:

- Related Work Index;
- semantic-neighbor;
- relaciones authority-only existentes;
- expansión L1;

sin convertir los nodos expandidos en hits directos.
