# RA12-D3 — vecindad semántica Qwen en el Atlas vivo

RA12-D3 conecta las publicaciones y transportes ya auditados con el grafo que ve el usuario.

## Qué cambia

El snapshot final de una búsqueda real ahora puede contener aristas `semantic-neighbor` calculadas entre **las obras que ya devolvió el SearchResponse federado**.

No se crea una segunda búsqueda. Qwen no descubre obras nuevas en esta fase; representa y compara las obras ya recuperadas.

Flujo:

```
SearchResponse
  → ResearchAtlasAssembler
  → D1: identidad exacta → ubicación V4/overlay
  → D2: vector 1024D autenticado y cacheado
  → D3: cosine pairwise
  → semantic-neighbor
  → RA11 solamente en pares sin representación Qwen
  → layout / vista
```

## Semántica de la arista

`semantic-neighbor` significa exclusivamente:

> proximidad representacional entre dos documentos bajo Qwen3-Embedding-0.6B.

No significa cita, influencia, respuesta, dependencia, pertenencia a escuela, identidad bibliográfica ni relación histórica.

Evidencia:

- model: `Qwen/Qwen3-Embedding-0.6B`
- revision: `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`
- metric: cosine
- status de arista: `derived`
- prueba de cada endpoint: SHA/Range/OID proveniente de D2.

## Selección de vecinos

Por defecto:

- sólo direct hits del SearchResponse;
- `topK = 3` por nodo;
- máximo 36 aristas;
- `minimumScore = 0`;
- orden determinista por score y par de IDs.

El umbral cero sólo excluye cosenos negativos. No se presenta como una frontera epistemológica de “relevancia”. El score queda visible como evidencia derivada.

Un par con dos vectores verificados se considera **evaluado semánticamente** aunque no sea seleccionado por topK/maxEdges. RA11 no rellena ese par.

## Fallback RA11

RA11 se restringe a pares donde **al menos un endpoint no tuvo vector Qwen verificado**.

Eso incluye:

- identidad no publicada en V4/overlay;
- transporte bloqueado;
- CORS/Range/HTTP inválido;
- SHA no coincidente;
- ausencia de representación publicada.

Una caída semántica no derriba el Atlas: los pares afectados degradan a TF-IDF título+abstract.

## Integración live

`ResearchAtlasLiveSession` mantiene Qwen desactivado por defecto para pruebas/consumidores programáticos existentes.

La página real `js/research-atlas.js` lo activa explícitamente con:

```js
enableQwenTopology: true
```

Las actualizaciones parciales siguen siendo rápidas y usan RA11. El snapshot final ejecuta D3 y publica una sola actualización final enriquecida.

La barra de estado final muestra:

- resultados canónicos;
- número de conexiones semánticas Qwen;
- número de obras con vector verificado.

## Cancelación

D3 propaga `AbortSignal` a D1/D2 y a los fetch de:

- manifest;
- índices;
- digest tiles;
- vector slices.

Cancelar una búsqueda impide publicar el snapshot final tardío.

## Invariantes

RA12-D3 no modifica:

- ranking de búsqueda;
- `SearchResponse.results`;
- orden de resultados;
- consultas a proveedores;
- identidad bibliográfica;
- corpus V4 congelado;
- overlay C5-C;
- Qwen weights.

No usa:

- OpenAlex live en browser;
- fuzzy title/year como autoridad;
- FAISS;
- descarga del modelo.

## Gates

1. pruebas deterministas D3:
   - Qwen gana sobre RA11 para pares evaluados;
   - RA11 aparece sólo donde falta vector;
   - falla de transporte degrada;
   - topK no provoca relleno lexical de pares ya evaluados.
2. regresión completa;
3. smoke Node real:
   - V4 `W4388864320`;
   - overlay DOI `10.12795/ambitos.2019.i43.10`;
   - tercera obra sin vector;
   - score V4↔overlay esperado `0.20802329168861472`.
4. smoke Chromium con `ResearchAtlasLiveSession` completo y `buildResearchAtlasViewModel`.
5. RA8 product gate existente.
6. aserción estática de activación explícita sólo en la página real.

Después del merge y deploy de Pages, una búsqueda en `research-atlas.html` puede mostrar aristas azules de “Vecindad semántica” cuando al menos dos resultados tengan vectores Qwen publicados.
