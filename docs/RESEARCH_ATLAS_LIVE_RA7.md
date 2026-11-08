# RA7 — Integración experimental con búsqueda real

> **Nota RA11:** el fallback lexical de título descrito aquí fue sustituido por `title-abstract-tfidf-cosine-v1`, con fallback a título cuando falta abstract. El resto de la integración live permanece vigente.


## Estado

**Fase RA7 — SearchResponse real → Research Atlas en tiempo real.**

RA7 reemplaza el fixture visual de RA6 por el motor real de búsqueda del proyecto, manteniendo la ruta aislada:

`research-atlas.html`

La página principal `index.html` todavía no enlaza esta experiencia.

---

## 1. Pipeline real

```text
consulta del usuario
        │
        ▼
searchPhilosophy / semantic service
        │
        ├── parciales por proveedor
        │
        ▼
ResearchAtlasLiveSession
        │
        ▼
RA2 assembler
        │
        ▼
RA3 unresolved-author overlay
        │
        ▼
RA7 lexical fallback
        │
        ▼
RA5 incremental layout
        │
        ▼
RA6 view model + renderer
```

No existe un segundo motor de búsqueda para el Atlas.

---

## 2. OpenAlex Philosophy

La política queda ejecutable y visible.

`OpenAlex Philosophy` significa:

`CristianPelayo/openalex-philosophy`

en Hugging Face, revisión:

`09c329326ed24ccf986c4b4c47c9794f055516dc`

archivo:

`v3.2/philosophy-corpus-v3-2-search.parquet`

`src/sources/openalex-philosophy.js` exporta ahora:

`OPENALEX_PHILOSOPHY_HF_REVISION`

RA7 copia esa revisión a:

`ResearchAtlasSession.sourceRevisions.openAlexPhilosophy`

La política de `search-engine.js` sigue forzando:

`openAlex.enabled = false`

aunque un caller intente activarlo.

---

## 3. Búsqueda federada progresiva

RA7 consume directamente:

`searchPhilosophy(..., { onPartialResults })`

Cada parcial ya pasó por:

- providers;
- mergeResults;
- rankResults;
- buildSearchResponse.

Por tanto el Atlas no vuelve a:

- consultar fuentes;
- deduplicar;
- rankear.

Cada parcial se convierte en un nuevo snapshot.

WorkNode conserva su ID entre parciales gracias a RA2.

RA5 reutiliza el layout anterior.

---

## 4. Fuentes federadas

RA7 usa las mismas fuentes permitidas por Search Engine:

- OpenAlex Philosophy · Hugging Face;
- CUCSH Filosofía;
- Crossref;
- Internet Archive.

No habilita OpenAlex API.

---

## 5. Modo semántico

La ruta experimental ofrece:

- Federado;
- Semántico.

Modo semántico ejecuta en paralelo:

1. servicio semántico;
2. búsqueda federada compañera.

Cuando ambas terminan:

`combineSemanticWithFederated()`

produce el mismo tipo de respuesta híbrida que usa la página principal.

No se aplica reranker desde RA7.

---

## 6. Fallback semántico

RA7 utiliza `Promise.allSettled`.

Esto es deliberado.

Si el servicio semántico falla:

- no se lanza una segunda búsqueda federada;
- se reutiliza la única búsqueda federada compañera;
- el evento final marca `fallback = true`;
- `SearchResponse.errors` explica el respaldo.

Una cancelación no se convierte en fallback.

---

## 7. Cancelación y carreras

Cada nueva búsqueda:

1. aborta la anterior;
2. incrementa `runId`;
3. reinicia assembler y layout;
4. ignora callbacks tardíos de runs anteriores.

El renderer mantiene además un `uiRunId` para impedir que el `finally` de una búsqueda vieja reactive controles de una nueva.

---

## 8. Autores en RA7

El Author Authority Graph masivo todavía no se carga en runtime del Atlas.

RA7 no rebaja el estándar.

El assembler recibe un Authority Graph vacío y válido:

- ninguna AuthorityPerson confirmada;
- autores estructurados → AuthorMention;
- ORCID/OpenAlex Author ID sin registro Authority no basta;
- igualdad nominal nunca confirma.

Al finalizar la búsqueda se reutiliza:

`enrichResultsWithRemoteAuthors()`

para recuperar colaboradores/autores desde el snapshot Hugging Face cuando el SearchResult ligero carece de ellos.

Esos autores siguen siendo menciones hasta una autoridad confirmada.

---

## 9. Related Work remoto

El resolver y el contrato Related Work existen.

Sin embargo, la documentación actual del repositorio indica que la publicación masiva estable del índice remoto sigue pendiente.

RA7 no inventa un endpoint.

Por tanto:

- no hay crawling Related Work automático en esta fase;
- `expandedWorks` puede permanecer en 0;
- RA4 queda listo para activarse cuando el artefacto remoto sea publicado y versionado.

---

## 10. Fallback lexical

Para que un Atlas live federado no sea sólo una nube de puntos, RA7 activa la relación ya prevista desde RA0:

`lexical-neighbor`

Método:

`title-token-jaccard-v1`

Input:

- título normalizado;
- tokens sin stopwords comunes;
- sólo WorkNodes directos por default.

No usa:

- abstract;
- autores;
- programa;
- ranking;
- proveedor;
- semantic score.

---

## 11. Gate lexical

Una pareja es elegible cuando:

- comparte al menos 2 tokens útiles;
- Jaccard >= 0.12;

o cuando:

- comparte al menos 1 token;
- Jaccard >= 0.34.

Cada WorkNode conserva como máximo 3 vecinos lexicales.

Máximo global default:

36 aristas.

---

## 12. Evidencia lexical

Toda arista incluye evidencia derivada:

- method;
- revision;
- score;
- sharedTokens;
- unionSize;
- representation.

UI:

`Vecindad lexical de títulos`

Nunca:

`Vecindad semántica`

---

## 13. Prioridad frente a semántica

Si una pareja ya tiene:

`semantic-neighbor`

RA7 no agrega fallback lexical duplicado.

Esto preserva la prioridad geométrica RA5:

```text
semantic-neighbor
        >
lexical-neighbor
        >
related-work
```

La función lexical también es idempotente.

---

## 14. Estado incremental

Federado:

```text
provider settled
      ↓
partial SearchResponse
      ↓
snapshot
      ↓
layout
      ↓
Canvas update
```

El status muestra qué proveedor acaba de contribuir.

El mapa no se reconstruye desde cero visualmente.

---

## 15. URL experimental

RA7 acepta:

`research-atlas.html?q=libertad%20en%20Kant&mode=federated`

o:

`mode=semantic`

El query se guarda sólo en la URL del navegador mediante:

`history.replaceState`

No se crea historial server-side.

---

## 16. Filtro interno

El campo secundario sigue siendo filtro del Atlas ya construido.

No inicia otra búsqueda.

No cambia:

- ranking;
- identidad;
- aristas;
- layout.

---

## 17. Capas visuales

RA7 permite mostrar/ocultar:

- semantic-neighbor;
- lexical-neighbor;
- related-work;
- contribution;
- author-mention.

En el estado live actual son especialmente relevantes:

- lexical-neighbor;
- author-mention.

---

## 18. Fallos cerrados

RA7 no debe:

- activar OpenAlex API;
- presentar lexical como semantic;
- promover menciones a AuthorityPerson sin graph;
- duplicar búsqueda federada en fallback semántico;
- publicar callbacks de búsqueda abortada;
- mutar SearchResponse para cambiar ranking;
- cargar browser Qwen automáticamente;
- inventar Related Work remoto.

---

## 19. Qué sigue aislado

RA7 sigue sin modificar:

- `index.html`;
- navegación principal;
- lista de resultados principal;
- filtros principales;
- ranking principal.

La validación live ocurre en una superficie experimental.

---

## 20. Gate RA7

RA7 se cierra cuando:

1. federado emite partial + final;
2. WorkNode IDs permanecen estables;
3. OpenAlex Philosophy revision queda en manifest/session;
4. OpenAlex live permanece deshabilitado;
5. cancelación corta callbacks tardíos;
6. semantic fallback reutiliza una sola búsqueda federada;
7. lexical-neighbor tiene evidencia y nombre propios;
8. autores no confirmados siguen como AuthorMention;
9. la ruta ya no carga fixture;
10. RA1–RA6 + npm test permanecen verdes.

---

## 21. Próxima fase

**RA8 — gate de producto e integración con la búsqueda principal.**

Antes de colocar `Resultados ⇄ Atlas` en `index.html` deberán medirse al menos:

- tiempo al primer Atlas significativo;
- FPS y main-thread blocking;
- estabilidad de nodos en búsquedas reales;
- densidad lexical;
- legibilidad móvil;
- accesibilidad por teclado;
- comportamiento con 5, 20, 50+ resultados;
- coste de author enrichment;
- degradación cuando una fuente falla.

RA8 decidirá si el Atlas entra como toggle dentro de la búsqueda principal o si requiere una fase adicional de rendimiento.
