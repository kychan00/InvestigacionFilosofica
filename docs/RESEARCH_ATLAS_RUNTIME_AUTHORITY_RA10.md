# RA10 — Authority runtime + expansión L1 por autor

## Estado

**Fase RA10 — enriquecimiento verificable del Atlas principal con Author Authority real y Related Work L1 de autoría.**

RA10 parte de RA9:

```text
SearchResponse
   ├── Resultados
   └── Atlas base
```

y añade, únicamente al completar una búsqueda:

```text
SearchResponse final
        │
        ▼
author-index-v3
work-authors exactos
        │
        ▼
Authority Graph de sesión
        │
        ├── AuthorityPerson
        ├── contribution
        ├── same-author
        └── coauthor
        │
        ▼
obras exactas del mismo OpenAlex Author ID
        │
        ▼
Related Work L1 de autoría
```

---

## 1. Regla epistemológica

RA10 no confirma personas por nombre.

Una AuthorityPerson runtime sólo puede promoverse cuando existe al menos un identificador determinista:

- OpenAlex Author ID;
- ORCID.

El nombre se conserva para presentación y evidencia auxiliar, nunca como llave de identidad.

---

## 2. Fuente

La fuente runtime sigue siendo el release ya publicado:

`author-index-v3`

materializado por `deploy.yml` bajo:

`data/authors/author-index-v2/`

El nombre del directorio conserva el schema histórico del índice; la revisión operativa es:

`AUTHOR_INDEX_RUNTIME_REVISION = author-index-v3`

---

## 3. No OpenAlex API

RA10 no llama:

`api.openalex.org`

Los Author IDs, ORCID y obras vienen del snapshot OpenAlex Philosophy publicado y versionado.

---

## 4. Enriquecimiento de autores

La búsqueda ligera puede devolver obras OpenAlex sin autores.

RA10 llama:

`enrichResultsWithRemoteAuthors()`

sólo después del SearchResponse final.

Presupuesto:

- máximo 20 resultados para recuperar autores;
- shards deduplicados;
- cancelación por AbortSignal.

La lista principal no se muta.

El enriquecimiento pertenece únicamente al Atlas.

---

## 5. Authority Graph de sesión

Archivo:

`src/core/research-atlas-runtime-authority.js`

Pipeline:

1. observa autores estructurados;
2. normaliza OpenAlex Author ID y ORCID;
3. agrupa identificadores compatibles;
4. bloquea conflictos;
5. crea AuthorityCandidate;
6. crea AuthorMention y SourceRecord;
7. ejecuta `buildAuthorityGraph()` oficial.

No existe un segundo identity engine.

---

## 6. Homónimos

```text
José Martínez · A111
José Martínez · A222
```

Resultado:

dos AuthorityPerson.

La igualdad nominal no las une.

---

## 7. ORCID compartido

```text
A111 + ORCID X
A222 + ORCID X
```

Resultado:

una AuthorityPerson.

Ambos OpenAlex Author IDs quedan registrados sobre la misma autoridad.

---

## 8. ORCID contradictorio

```text
A333 + ORCID X
A333 + ORCID Y
```

Resultado:

conflicto.

La agrupación no se promueve a AuthorityPerson.

Fail closed.

---

## 9. Nombre sin identificador

```text
José Martínez
sin OpenAlex Author ID
sin ORCID
```

Resultado:

`AuthorMention · unresolved`

Nunca AuthorityPerson.

---

## 10. Relaciones derivadas

Una vez confirmadas AuthorityPerson, RA3 produce:

- contribution;
- same-author;
- coauthor.

Estas relaciones provienen del mismo Author Authority Graph.

No se comparan nombres.

---

## 11. Related Work L1

RA10 añade:

`src/core/research-atlas-runtime-related.js`

No es búsqueda semántica.

Cada seed elegible:

1. debe ser una obra OpenAlex observada;
2. debe tener un autor con AuthorityPerson confirmada;
3. debe conservar un OpenAlex Author ID exacto;
4. consulta el shard `works` de ese Author ID;
5. excluye la obra semilla;
6. materializa hasta tres vecinos.

---

## 12. Tipo de relación

Toda expansión RA10 es:

`same-author`

con evidencia:

- class = bibliographic;
- strength = strong;
- structuredIdentity = true;
- authorityRefs[].

Se valida con:

`assertRelatedWorkEdge()`

---

## 13. Lo que RA10 NO llama semántico

Una obra L1 encontrada porque comparte autor:

- no recibe semantic-neighbor;
- no recibe semantic score;
- no se etiqueta como afinidad conceptual;
- no implica influencia;
- no implica citación.

---

## 14. Presupuestos

Runtime default:

- authorResultLimit = 20;
- maxSeeds = 6;
- maxAuthorsPerSeed = 2;
- maxUniqueAuthors = 12;
- worksPerAuthor = 8;
- maxNeighborsPerSeed = 3;
- maxExpandedWorks = 12;
- concurrency = 4.

Estos límites protegen la experiencia móvil y el número de requests.

---

## 15. Dos tiempos de render

RA10 no bloquea la lista ni el Atlas base.

### Tiempo A

SearchResponse llega:

- Atlas RA9 aparece inmediatamente;
- lexical fallback y menciones provisionales funcionan.

### Tiempo B

SearchResponse final:

- comienza Authority runtime;
- autores confirmados sustituyen menciones cuando corresponde;
- aparecen contribution / same-author / coauthor;
- se añaden obras L1.

---

## 16. Cancelación

Nueva consulta:

- aborta enrichment anterior;
- incrementa revision de ejecución;
- callbacks viejos no pueden reescribir el Atlas nuevo.

---

## 17. Filtros principales y L1

Los filtros actuales siguen enviando los `resultIdentityKey` de obras directas visibles.

RA10 añade una regla:

> una obra L1 sólo permanece visible si al menos una seed directa que la sostiene permanece visible.

La topología no se recalcula al filtrar.

---

## 18. Identidad de obras directas

Si una obra directa tiene DOI y OpenAlex Work ID:

- SearchResponse conserva DOI como identidad canónica;
- L1 detecta su OpenAlex Work ID únicamente para localizarla;
- la relación reutiliza la identidad DOI existente.

Esto evita duplicados:

```text
doi:10.x/example
≠
nuevo nodo openalex:w123
```

cuando ambos representan el mismo resultado directo.

---

## 19. Cero red por toggle

La red Authority/L1 empieza al recibir el SearchResponse final.

No empieza al pulsar:

`Atlas`

El smoke RA10 espera a que Authority runtime termine y después comprueba:

`Resultados → Atlas = 0 requests nuevos`

incluidos requests same-origin.

---

## 20. Semántica Related Work

El índice semántico completo todavía no se publica.

El builder actual requiere:

- FAISS congelado;
- metadata SQLite;
- semantic manifest.

El dataset público Browser Static V4 conserva shards int8 y metadata, pero no constituye por sí mismo el release del Related Work Index.

RA10 no reconstruye una topología semántica aproximada sólo para habilitar la feature.

---

## 21. Bloqueo semántico

Hasta que exista un release inmutable de Related Work:

- semantic-neighbor remoto = apagado;
- shared-topic remoto = apagado;
- same-debate remoto = apagado;
- citation remoto = apagado.

Lexical RA7 sigue siendo claramente lexical.

Authority L1 RA10 sigue siendo claramente same-author.

---

## 22. Tests RA10

Se validan:

- identificador fuerte → AuthorityPerson;
- mismo nombre + IDs distintos → dos personas;
- ORCID compartido → merge;
- ORCID contradictorio → bloqueo;
- name-only → AuthorMention;
- coauthor sólo con autoridades;
- L1 usa Author ID exacto;
- target directo reutiliza DOI;
- L1 no inventa semantic-neighbor;
- lookup exacto no usa Wikidata;
- AbortSignal;
- toggle sin red;
- responsive.

---

## 23. Próxima fase

**RA11 — publicación del Related Work Index semántico.**

Debe resolver primero el artefacto de build:

```text
Qwen3 frozen semantic source
      ↓
Related Work production builder
      ↓
independent validator
      ↓
immutable release
      ↓
deploy.yml
      ↓
one-shard runtime resolver
```

Sólo después RA11 podrá habilitar semantic-neighbor real en el Atlas principal.
