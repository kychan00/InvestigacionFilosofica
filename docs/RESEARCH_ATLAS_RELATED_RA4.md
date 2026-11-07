# RA4 — Related Work + expansión L1 del Atlas de Investigación

## Estado

**Fase RA4 — territorio intelectual derivado de relaciones precalculadas.**

RA4 conecta el Atlas con el sistema ya existente de Related Works sin activar Qwen ni ejecutar búsquedas adicionales.

```text
SearchResponse
    ↓
RA2 WorkNodes
    ↓
RA3 Authority
    ↓
RelatedWorksResolver
    ↓
RA4 Expansion
    ├── Related Work edges
    ├── Semantic neighbor edges
    └── WorkNodes L1 expandidos
```

---

## 1. Separación de responsabilidades

RA4 no hace fetch.

El transporte sigue perteneciendo a:

`RelatedWorksResolver`

RA4 consume `related-work-response-v1` ya resuelto.

Esto permite:

- testear el grafo sin red;
- mantener cache/transporte fuera del modelo;
- controlar presupuestos;
- no convertir el Atlas en un segundo motor de búsqueda.

---

## 2. Compatibilidad de identidad OpenAlex

Se detectó una diferencia previa:

- Search / merge-results: `openalex:w123`
- Related Work Index: `openalex:W123`

RA4 formaliza dos funciones:

- `normalizeResearchAtlasWorkIdentity()`
- `relatedWorkSeedIdentityForAtlasIdentity()`

Además `RelatedWorkIndex` normaliza sus seeds antes del hashing y lookup.

Esto garantiza que:

`openalex:w123`

y

`openalex:W123`

ruteen al mismo shard del índice.

---

## 3. L0 y L1

### L0

Hits directos de SearchResponse.

`discovery.directHit = true`

### L1

Obras descubiertas desde Related Work.

`discovery.directHit = false`

`origins = ["related-work-expansion"]`

Una obra L1 nunca recibe `query-result`.

---

## 4. Identidad estable entre L1 y L0

RA4 reutiliza el mismo generador de WorkNode ID de RA2.

Por tanto:

```text
hoy:    obra X = expansión L1
mañana: obra X = hit directo L0
```

conserva el mismo node ID si su identidad canónica es la misma.

El renderer futuro podrá cambiar su estado sin destruir/recrear la entidad visual.

---

## 5. Hidratación obligatoria para nodos nuevos

Una relación puede existir aunque el metadata target no esté cargado.

RA4 no inventa un WorkNode sin título.

Para crear un nuevo nodo L1 exige:

- identidad de target;
- metadata hidratada;
- título.

Si el target ya existe como hit directo, la relación sí puede agregarse aunque la hidratación del target no sea necesaria.

---

## 6. Related Work edge

Toda relación elegible se conserva como:

`related-work`

Su evidencia contiene:

- `relationEdgeRef`;
- `indexRevision`;
- `relationTypes`;
- `signals`;
- `reasons`.

Esto evita colapsar una relación compuesta.

Ejemplo:

```text
semantic-affinity
+ shared-topic
+ same-author
```

sigue siendo una arista Related Work explicable.

---

## 7. Semantic Neighbor

Cuando el RelatedWorkEdge declara:

`semantic-affinity`

RA4 puede añadir además:

`semantic-neighbor`

pero sólo si existe una revisión semántica conocida.

Evidencia mínima:

- modelId;
- modelRevision;
- metric = cosine;
- score.

Si falta revisión:

- se conserva `related-work`;
- no se publica `semantic-neighbor`;
- diagnostics registra el skip.

Nunca se fabrica un modelRevision.

---

## 8. Authority-only

Una relación del índice puede ser:

- same-author;
- shared-coauthor;

sin semantic-affinity.

En ese caso RA4:

- crea Related Work;
- puede expandir el target;
- no crea semantic-neighbor.

Las relaciones de identidad continúan gobernadas por RA3.

RA4 no transforma authority-only en similitud semántica.

---

## 9. Target directo ya existente

Si Related Works apunta a una obra que ya era L0:

- no crea otro WorkNode;
- no cambia `directHit`;
- no agrega `related-work-expansion` a su origen;
- sí agrega la relación.

La recuperación directa tiene prioridad ontológica sobre su descubrimiento secundario.

---

## 10. Target compartido entre seeds

Si dos hits directos apuntan al mismo target L1:

- existe un solo WorkNode;
- conserva todas las seeds en `relatedDiscovery.seedWorkRefs`;
- conserva los RelatedWorkEdge refs que explican su aparición.

---

## 11. Presupuestos

Defaults RA4:

- máximo 6 neighbors por seed;
- máximo 24 WorkNodes L1 nuevos por snapshot.

El presupuesto global aplica sólo a nodos nuevos.

Una relación hacia un WorkNode ya visible no se bloquea por ese presupuesto.

No existe crawling L2 automático.

---

## 12. Orden determinista

Responses se procesan por identidad de seed.

Nodes, edges y evidence se ordenan por ID estable.

El orden en que terminaron los fetches no cambia el snapshot final.

---

## 13. Diagnostics

`diagnostics.related` añade:

- revision;
- responses;
- indexedSeeds;
- candidateEdges;
- relatedWorkEdges;
- semanticNeighborEdges;
- expandedWorks;
- reusedDirectTargets;
- skippedUnhydratedTargets;
- skippedByGlobalBudget;
- skippedSemanticWithoutRevision.

---

## 14. Qué RA4 no hace

No:

- dibuja el mapa;
- ejecuta Qwen;
- calcula embeddings;
- consulta Crossref;
- consulta OpenAlex API;
- resuelve personas por nombre;
- crea citaciones desde similitud;
- expande L2 automáticamente;
- mezcla ranking de búsqueda con distancia.

---

## 15. Resultado arquitectónico

Después de RA4 ya existe el primer territorio intelectual completo a nivel de datos:

```text
                     QUERY
                    /     \
                   ▼       ▼
               WORK A     WORK B
                 │ \       / │
                 │  \sem  /  │
                 │   \   /   │
                 ▼    ▼ ▼    ▼
             WORK C  WORK D  WORK E
               │
               └── related-work
```

Si RA3 está presente, AuthorityPerson y Contributions pueden coexistir en el mismo snapshot.

---

## 16. Siguiente fase

RA5 debe experimentar con layout incremental.

No debe modificar identidad ni relaciones.

Su input será exclusivamente:

`ResearchAtlasSnapshot`

y su output:

`layout coordinates + visual state`.

Ese aislamiento permite comparar force-directed, UMAP/PACMAP anclado u otras estrategias sin cambiar el conocimiento representado.
