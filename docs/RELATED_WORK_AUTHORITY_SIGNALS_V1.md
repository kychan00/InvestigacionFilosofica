# Related Work Index V1C — señales de autoridad verificadas

## Estado

**Fase 1C — integración del Author Authority Graph como generador de relaciones.**

Esta fase amplía el índice de relaciones para que la autoría confirmada pueda:

1. enriquecer un vecino semántico existente;
2. introducir un candidato nuevo aunque no aparezca entre los vecinos Qwen;
3. producir evidencia bibliográfica estructurada compatible con `RelatedWorkEdge V1`.

No modifica todavía la interfaz de las fichas y no congela el ranking final.

---

## 1. Principio

Una coincidencia de nombres nunca produce una relación de autoría.

La cadena autorizada es:

```text
author-index-v3 / work-authors
        │
        ▼
OpenAlex Author ID observado
        │
        ▼
Author Authority registry
        │
        ▼
AuthorityPerson confirmada
        │
        ▼
authority-work-map-v1
        │
        ▼
Related Work candidate generation
```

Si un OpenAlex Author ID no aparece en el `identifierRegistry` del Authority Graph, no participa en `same-author` ni en `shared-coauthor`.

---

## 2. Authority Work Map V1

Builder:

`scripts/related/build_authority_work_map_v1.mjs`

Comando:

```bash
npm run build:authority-work-map -- \
  --author-index <author-index-v2-root> \
  --authority <author-authority-v1-root> \
  --output <authority-work-map-v1>
```

### Entradas

#### Author index

Consume:

- `manifest.json`;
- `work-authors/*.jsonl`.

Cada fila `work-authors` aporta:

- OpenAlex Work ID;
- OpenAlex Author IDs;
- nombre observado;
- ORCID observado;
- posición;
- correspondiente.

El nombre y el ORCID del row no se usan para decidir identidad en este puente.

#### Authority Graph

Consume:

- `manifest.json`;
- `registry.json`.

Sólo se usa:

```text
identifierRegistry["openalex-author:<id>"]
→ AuthorityPerson.id
```

El registry contiene únicamente enlaces promovidos por la resolución de identidad confirmada.

---

## 3. Integridad de entrada

Antes de construir el mapa:

1. se valida el schema del author-index;
2. se valida el schema del batch de autoridad;
3. se valida el schema del registry;
4. se verifica SHA-256 del `registry.json` contra el manifest de autoridad;
5. se verifica tamaño y SHA-256 de cada archivo `work-authors` contra el manifest fuente.

Un mismatch aborta el build.

No se continúa con datos parcialmente verificados.

---

## 4. Contrato físico

Cada fila del bridge representa una obra OpenAlex con al menos una AuthorityPerson confirmada.

Ejemplo:

```json
{
  "w": "openalex:W1001",
  "n": 3,
  "u": 1,
  "a": [
    {
      "r": "authority:...",
      "p": ["first"],
      "i": ["123"],
      "c": true
    },
    {
      "r": "authority:...",
      "p": ["last"],
      "i": ["456"],
      "c": false
    }
  ]
}
```

Campos:

- `w`: identidad OpenAlex de la obra;
- `n`: cantidad total de autores observados en `work-authors`;
- `u`: autores sin AuthorityPerson confirmada;
- `a`: autoridades confirmadas;
- `r`: AuthorityPerson ID;
- `p`: posiciones observadas;
- `i`: OpenAlex Author IDs fuente que convergieron a esa autoridad;
- `c`: al menos una mención correspondiente.

---

## 5. Fusión de múltiples OpenAlex Author IDs

Dos OpenAlex Author IDs pueden converger a la misma AuthorityPerson.

En una obra no se duplican.

Ejemplo:

```text
A123 ─┐
      ├── AuthorityPerson X
A456 ─┘
```

Si ambos aparecen en la misma fila de obra, el bridge conserva:

- una AuthorityPerson;
- ambos source IDs;
- todas las posiciones observadas.

Esto evita contar dos veces a la misma persona tras una fusión de identidad.

---

## 6. Obras sin autoridad confirmada

Una obra puede contener autores en `work-authors` pero ninguno estar confirmado en Authority Graph.

En ese caso:

- se cuenta en las métricas;
- no entra al mapa consumible;
- no genera relación de autoría.

La ausencia no se interpreta como autor desconocido universal ni como ausencia real de autor.

Sólo significa:

> el Authority Graph actual no dispone de una identidad confirmada utilizable para esta obra.

---

## 7. Sharding del bridge

Default:

- 256 shards;
- SHA-256 de la identidad de obra;
- primer byte módulo shard count.

Formato:

```text
shards/shard-00.jsonl
...
shards/shard-ff.jsonl
```

Cada shard:

- está ordenado por identidad;
- no admite una obra duplicada;
- conserva SHA-256 y tamaño en el manifest.

El bridge es un input offline del Related Work Builder, no un endpoint de UI.

---

## 8. Equivalencia DOI/OpenAlex

La identidad canónica del Related Work Index sigue prefiriendo DOI.

Ejemplo:

```text
registro A
DOI 10.x
sin OpenAlex ID

registro B
DOI 10.x
OpenAlex W777
```

Ambos representan la misma obra canónica.

V1C agrupa los OpenAlex IDs observados en cualquier registro equivalente y puede asociar la AuthorityPerson de `W777` al representante DOI.

No se cambia:

```text
doi:10.x
```

por:

```text
openalex:W777
```

La identidad bibliográfica y la evidencia de autoridad permanecen separadas.

---

## 9. Same Author

Se genera:

`same-author`

cuando seed y target comparten al menos una AuthorityPerson confirmada.

Evidencia expandida:

```json
{
  "class": "bibliographic",
  "strength": "strong",
  "source": "author-authority-graph-v1",
  "structuredIdentity": true,
  "authorityRefs": ["authority:..."]
}
```

Signal:

```json
{
  "author": 1.0
}
```

No existe score probabilístico de identidad dentro de esta arista.

La identidad ya fue resuelta por Authority Graph.

---

## 10. Shared Coauthor

Se genera:

`shared-coauthor`

únicamente cuando:

1. existe una AuthorityPerson compartida;
2. seed tiene más de un autor observado;
3. target tiene más de un autor observado.

V1C trata `shared-coauthor` como una relación adicional, no mutuamente excluyente con `same-author`.

Una arista puede declarar:

```json
[
  "same-author",
  "shared-coauthor"
]
```

porque ambas afirmaciones pueden ser verdaderas:

- las obras comparten una persona autora;
- las dos pertenecen además a contextos de coautoría.

Evidencia:

```json
{
  "class": "bibliographic",
  "strength": "strong",
  "source": "author-authority-graph-v1",
  "structuredIdentity": true,
  "sharedAuthorityRefs": ["authority:..."]
}
```

---

## 11. Candidatos independientes de Qwen

Antes de V1C:

```text
FAISS semantic candidates
→ relations
```

V1C:

```text
             ┌── FAISS semantic candidates
seed ────────┤
             └── Authority Graph candidates
                       │
                       ▼
                    union
                       │
                       ▼
                 relation-index
```

Default:

- 48 candidatos semánticos;
- hasta 24 candidatos adicionales de autoridad.

El máximo físico antes de deduplicación es 72.

El ranking final de producto todavía no usa estos números como pesos.

---

## 12. Orden de candidatos de autoridad

La selección offline V1C es determinista.

Prioridades:

1. mayor cantidad de AuthorityPerson compartidas;
2. menor distancia de año cuando ambos años existen;
3. menor `vector_id` como desempate estable.

Este orden sólo limita el candidate pool.

No representa el ranking final mostrado al usuario.

---

## 13. Enriquecimiento de candidatos semánticos

Si un target semántico ya comparte autoridad:

```text
semantic-affinity
+ same-author
+ shared-coauthor
+ shared-topic
```

pueden coexistir en una sola arista.

No se crea una segunda arista duplicada.

---

## 14. Candidatos authority-only

Una obra puede entrar sin `semantic-affinity`.

Ejemplo compacto:

```json
{
  "t": "openalex:W200",
  "v": 200,
  "r": [
    "same-author",
    "shared-coauthor"
  ],
  "e": {
    "authorityRefs": [
      "authority:..."
    ],
    "sharedAuthorityRefs": [
      "authority:..."
    ]
  }
}
```

No contiene:

- `s`;
- `semanticScore`;
- `observedVectorId`.

El validador falla si se adjunta evidencia semántica sin declarar `semantic-affinity`.

---

## 15. Browser contract

`src/core/related-work-index-format.js`

puede expandir una arista authority-only a un `RelatedWorkEdge V1`.

Por tanto el runtime creado en Fase 2A no depende de que todas las relaciones tengan embedding similarity.

Esto es necesario para que el futuro grafo pueda incorporar también:

- citaciones;
- referencias;
- relaciones históricas verificadas;

sin fingir que todas son semánticas.

---

## 16. Invariantes nuevas

El validador V1C exige:

### same-author

- `authorityRefs` no vacío;
- refs únicos;
- evidencia bibliográfica;
- `structuredIdentity: true`.

### shared-coauthor

- `sharedAuthorityRefs` no vacío;
- refs únicos;
- subset de `authorityRefs`;
- `same-author` presente;
- evidencia bibliográfica;
- identidad estructurada.

### Authority-only

No puede contener:

- score semántico;
- `semanticScore`;
- observed semantic vector.

---

## 17. Métricas del manifest

Cuando existe Authority Work Map:

- `authority_candidates`;
- `authority_only_edges`;
- `same_author_edges`;
- `shared_coauthor_edges`;
- `authority_neighbors_per_seed`;
- procedencia del Authority Work Map.

El manifest declara:

```text
generated:
  semantic-affinity
  shared-topic
  same-author
  shared-coauthor
```

Si el bridge no se suministra, el builder conserva compatibilidad V1A y declara autoría como no generada.

---

## 18. Tests de bloqueo

La suite cubre:

- work-authors con SHA incorrecto;
- Authority registry con SHA incorrecto;
- OpenAlex IDs fusionados a una sola AuthorityPerson;
- autor no resuelto excluido;
- output determinista;
- obra authority-only fuera del top semántico;
- misma persona entre obra individual y multi-autorial;
- coautoría sólo cuando ambas obras son multi-autoriales;
- expansión JS a contrato V1;
- `same-author` sin AuthorityPerson rechazado;
- equivalencia DOI/OpenAlex entre registros duplicados.

---

## 19. Lo que V1C no hace

Todavía no genera:

- citaciones;
- referencias bibliográficas;
- `same-debate`;
- conceptos filosóficos fuertes;
- ranking final;
- MMR/diversidad;
- UI.

Tampoco utiliza nombres para suplir identidades no confirmadas.

---

## 20. Estado de datos masivos

El código necesario para autoría está implementado de forma independiente del full build.

Pero la publicación masiva requiere dos gates distintos:

### Authority side

Construir/validar el Author Authority Batch real y generar después:

`authority-work-map-v1`.

### Semantic side

Recuperar o republicar los originales congelados:

FAISS:

`31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`

Metadata SQLite:

`e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`

No se sustituye ninguno por una aproximación.

---

## 21. Siguiente gate

Después de V1C:

1. ejecutar un Authority Batch real suficientemente grande;
2. construir `authority-work-map-v1`;
3. medir cobertura de obras con AuthorityPerson confirmada;
4. recuperar el FAISS/SQLite exactos;
5. ejecutar full Related Work Index;
6. construir benchmark humano;
7. calibrar ranking/diversidad;
8. sólo entonces integrar la sección visual.
