# RA2 — Research Atlas Graph Assembler V1

## Estado

**Fase RA2 — ensamblador determinista de SearchResponse. Sin UI.**

RA2 implementa el primer pipeline ejecutable:

```text
SearchResponse
      │
      ▼
ResearchAtlasAssembler
      │
      ▼
ResearchAtlasSnapshot V1
```

No añade todavía:

- autores canónicos;
- menciones de autor;
- Related Work edges;
- semantic-neighbor;
- layout;
- canvas;
- controles;
- cambios a producción.

---

## 1. Frontera de responsabilidad

RA2 consume `SearchResponse.results` después de:

```text
providers
   ↓
mergeResults
   ↓
rankResults
   ↓
SearchResponse
```

Por tanto RA2 no:

- vuelve a consultar proveedores;
- vuelve a hacer ranking;
- inventa deduplicación paralela;
- resuelve autores;
- genera semántica.

---

## 2. Identidad de obra compartida

Se expone:

`resultIdentityKey(result)`

desde `merge-results.js`.

El assembler usa exactamente esa función.

Esto evita dos implementaciones distintas de:

- DOI;
- OpenAlex ID;
- provider-id;
- fallback bibliográfico.

Si SearchResponse contiene dos resultados que todavía comparten identidad canónica, RA2 falla cerrado.

---

## 3. Snapshot producido

RA2 crea:

- exactamente un QueryNode;
- un WorkNode por resultado canónico;
- una arista query-result por WorkNode;
- evidencia factual de recuperación por proveedor;
- diagnostics.

No crea AuthorityPerson.

No convierte `result.authors[].name` en personas.

Los nombres pueden viajar dentro del WorkNode sólo como metadato de presentación.

---

## 4. ID estable

Los IDs de:

- sesión;
- query;
- obra;
- evidencia;
- arista;

se derivan determinísticamente de su identidad lógica mediante FNV-1a 64-bit.

El WorkNode depende de `resultIdentityKey`, no de:

- posición;
- proveedor que respondió primero;
- índice del array;
- título de presentación.

Por ello una obra conserva su node ID entre snapshots parciales.

---

## 5. Ranking separado de topología

La posición del resultado se guarda únicamente como evidencia:

`payload.searchPosition`

No forma parte del WorkNode ni de su ID.

Esto formaliza la regla RA0:

> ranking no es topología.

Si el mismo conjunto de resultados cambia de orden:

- los WorkNode son los mismos;
- las aristas estructurales son las mismas;
- puede cambiar la evidencia de posición.

---

## 6. Canonicalización de arrays

RA2 canonicaliza antes de emitir el snapshot:

- providers;
- matchedQueries;
- sourceRecordRefs;
- autores de presentación;
- ISBN;
- topics;
- object keys relevantes.

Esto elimina diferencias accidentales debidas al orden de llegada.

No cambia el SearchResponse original.

---

## 7. SourceRecord refs

RA2 no copia SourceRecord raw al snapshot.

Construye referencias estables desde:

- provider;
- sourceId.

Si no existe sourceId, utiliza un fallback determinista limitado a provider + query.

---

## 8. Evidencia query-result

Cada proveedor que sostiene un WorkNode genera una evidencia factual:

```json
{
  "class": "factual",
  "source": "search-response",
  "payload": {
    "provider": "Crossref",
    "searchPosition": 2,
    "matchedQuery": "freedom Kant"
  }
}
```

Una arista `query-result` referencia todas las evidencias correspondientes a esa obra.

---

## 9. Estado incremental

`ResearchAtlasAssembler` mantiene:

- contexto;
- graphRevision;
- snapshot actual.

Cada `ingest(SearchResponse)` reconstruye el snapshot desde el estado canónico actual de la búsqueda.

No aplica parches mutables sobre el grafo anterior.

Ventajas:

- menos drift;
- menos estado oculto;
- reconstrucción sencilla;
- invariantes del contrato en cada actualización.

Los IDs estables permiten que un renderer futuro anime la transición entre snapshots.

---

## 10. Estados

Si SearchResponse contiene `progress`:

`collecting`

Sin progress:

- `complete` si no hay errores;
- `partial` si existen errores.

Puede sobreescribirse mediante contexto explícito compatible con RA1.

---

## 11. Search mode

RA2 distingue:

- traditional;
- semantic-service;
- browser-semantic.

`SearchResponse.searchMode === "semantic"` se interpreta como semantic-service salvo que el caller declare explícitamente browser semantic.

Browser semantic conserva el gate RA1:

`browserOptIn === true`

---

## 12. Invariantes de RA2

Debe fallar si:

1. no existe query;
2. la query normaliza a vacío;
3. SearchResponse repite una identidad canónica;
4. un hit no tiene provider;
5. el snapshot viola RA1;
6. browser-semantic carece de opt-in.

Debe conservar:

1. SearchResponse sin mutaciones;
2. WorkNode IDs entre parciales;
3. session ID para query/filtros/modo iguales;
4. grafo estructural bajo reordenamiento de ranking;
5. snapshot idéntico bajo reordenamiento de providers/sourceRecords/matchedQueries.

---

## 13. Fixture RA2

`benchmark/research-atlas/v2/search-response-fixtures.json`

Incluye:

- un SearchResponse final;
- un resultado multi-provider;
- DOI;
- OpenAlex ID;
- provider-specific ID;
- matchedQueries;
- sourceRecords;
- dos snapshots parciales.

---

## 14. Qué queda para RA3

RA3 podrá consumir el WorkNode producido aquí y resolver:

```text
WorkNode
   │
   ▼
AuthorMention
   │
   ▼
Author Authority Graph
   │
   ├── AuthorityPerson
   └── unresolved mention
```

RA2 deliberadamente no hace ese trabajo.

---

## 15. Criterio de cierre

RA2 queda cerrado cuando:

- el contrato RA1 sigue verde;
- el assembler tiene tests propios;
- la suite completa sigue verde;
- el SearchResponse no cambia;
- no hay UI nueva;
- no hay llamadas de red nuevas;
- la identidad final es independiente del orden de providers.
