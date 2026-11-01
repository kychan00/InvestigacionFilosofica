# Related Work Index V1A — Builder offline, identidad y sharding

## Estado

**Fase 1A — implementación del generador offline y contrato físico.**

Esta fase no integra todavía "Obras relacionadas" en la ficha y no publica todavía el índice completo de 451,823 documentos.

Objetivos cerrados en 1A:

- identidad canónica de obra para seeds/targets;
- deduplicación determinista por identificadores fuertes;
- generación de vecinos a partir del FAISS congelado;
- enriquecimiento con topics estructurados;
- formato compacto compatible con `RelatedWorkEdge V1`;
- sharding determinista por identidad;
- hashes SHA-256 por artefacto;
- validador independiente;
- compatibilidad Python ↔ JavaScript;
- fixture reproducible y CI.

---

## 1. Fuente semántica congelada

Related Work Index V1A se diseña sobre la misma genealogía de Qwen3 Browser Static V4.

### Corpus

- documentos: **451,823**
- dimensión: **1,024**
- modelo de referencia: Qwen3-Embedding-0.6B
- Static V4 artifact version: `20261010-v4`

### FAISS congelado

`SHA-256`:

`31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`

### Metadata SQLite congelada

`SHA-256`:

`e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`

### Static V4 manifest

`SHA-256`:

`0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`

El builder de producción verifica el SHA del FAISS contra el manifest Static V4 antes de generar ninguna arista.

---

## 2. Por qué el build maestro usa FAISS y no los shards int8 públicos

Los shards del navegador fueron diseñados para consulta interactiva y están cuantizados a int8.

Static V4 demostró una fidelidad de recuperación muy alta, pero no son byte-equivalentes al índice original.

Para construir el grafo maestro de relaciones no se debe cambiar silenciosamente la fuente semántica.

Por eso:

- runtime futuro podrá consumir artefactos estáticos;
- generación maestra usa el FAISS congelado;
- los shards int8 no sustituyen al FAISS original durante 1A.

---

## 3. Identidad de obra

Función implementada:

`canonical_work_identity(document)`

Orden:

1. DOI normalizado;
2. OpenAlex Work ID;
3. Crossref ID;
4. hash estable de proveedor + ID de registro.

Ejemplos:

```text
https://doi.org/10.1000/ABC
→ doi:10.1000/abc

https://openalex.org/W123
→ openalex:W123
```

### Regla de representante

Si varios vectores resuelven a la misma identidad fuerte:

- se conserva el vector ID más bajo como representante canónico;
- el seed duplicado no genera una segunda entrada;
- targets duplicados se colapsan por identidad.

No se utiliza similitud de título para fusionar obras.

---

## 4. Proveniencia del vector observado

Una obra duplicada puede ser encontrada semánticamente mediante un vector distinto del representante canónico.

El formato compacto conserva:

- `v`: vector ID representante del target;
- `o`: vector ID realmente observado, sólo cuando difiere.

Así el score semántico nunca se atribuye falsamente a otro embedding.

---

## 5. Generación de candidatos

Producción:

`scripts/related/build_related_work_index_v1.py`

El modo FAISS:

1. carga metadata;
2. canonicaliza identidades;
3. deduplica seeds;
4. reconstruye los vectores seed;
5. ejecuta `index.search` por lotes;
6. elimina self-relations;
7. colapsa targets duplicados;
8. aplica un piso semántico de generación configurable;
9. conserva hasta N vecinos por seed;
10. extrae topics estructurados compartidos;
11. escribe shards deterministas.

### Defaults de ingeniería

- vecinos por seed: 48;
- multiplicador de búsqueda: 4;
- batch size: 256;
- shards: 256;
- semantic floor: 0.0.

Estos valores son de **candidate generation**, no pesos ni thresholds finales de producto.

Fase 1B/2 calibrará ranking y publicación con golden set humano.

---

## 6. Relaciones generadas en 1A

El builder puede afirmar únicamente:

- `semantic-affinity`;
- `shared-topic`.

### No genera todavía

- `same-author`;
- `shared-coauthor`;
- `cited-by-seed`;
- `cites-seed`;
- `bibliographic-reference`;
- `same-debate` fuerte.

Razón:

esas relaciones requieren Authority Graph, Reference Graph o evidencia filosófica adicional.

La ausencia es deliberada.

---

## 7. Topics

Sólo se utiliza un topic cuando existe un identificador estructurado.

Se aceptan formas como:

- OpenAlex Topic URL;
- `T123`;
- IDs estructurados de fuente.

No se convierte un label libre en topic ID.

`shared-topic` se emite sólo si seed y target comparten al menos un ID estructurado.

---

## 8. Formato físico

Cada shard es gzip JSONL determinista.

Ejemplo:

```json
{
  "s": "doi:10.1000/seed",
  "v": 100,
  "n": [
    {
      "t": "openalex:W200",
      "v": 200,
      "s": 0.91,
      "r": ["semantic-affinity", "shared-topic"],
      "e": {
        "semanticScore": 0.91,
        "topicIds": ["openalex:T10"]
      }
    }
  ]
}
```

Campos:

### Seed

- `s`: identidad canónica;
- `v`: vector ID representante;
- `n`: vecinos.

### Neighbor

- `t`: identidad canónica target;
- `v`: vector ID representante;
- `o`: vector observado cuando difiere;
- `s`: señal semántica normalizada;
- `r`: relation types;
- `e`: evidencia compacta.

---

## 9. Expansión al contrato V1

JavaScript:

`src/core/related-work-index-format.js`

Python:

`expand_compact_edge(...)`

Ambos convierten el formato físico en:

`RelatedWorkEdge V1`

incluyendo:

- evidence;
- reasons;
- relation types;
- signals;
- trazabilidad del vector observado.

La expansión JavaScript utiliza el validador autoritativo:

`assertRelatedWorkEdge(...)`

---

## 10. Sharding

Producción usa 256 shards.

La ruta se deriva directamente de la identidad:

```text
SHA-256(identity)[0]
→ shard byte
→ shards/shard-xx.jsonl.gz
```

No existe locator global.

El navegador puede saber qué archivo pedir únicamente con la identidad canónica.

Ventajas:

- una petición pequeña;
- cache inmutable;
- distribución estable;
- sin diccionario global identidad → shard.

---

## 11. Metadata de presentación

El relation index no duplica título, autores, journal y abstract dentro de cada arista.

Los vecinos conservan `vector_id`.

Runtime podrá recuperar presentación desde las metadata pages ya publicadas por Static V4:

- page size: 512;
- página = `floor(vector_id / 512)`.

Esto evita repetir metadata millones de veces dentro del grafo.

---

## 12. Manifest

`manifest.json` registra:

- schema/generator version;
- document count;
- unique seed count;
- neighbors per seed;
- candidate search K;
- semantic floor;
- fuente y SHA;
- política de identidad;
- partition contract;
- relaciones generadas/no generadas;
- metadata lookup;
- cada shard con bytes/SHA/seed count/edge count;
- totales de deduplicación y descartes.

---

## 13. Validador independiente

`scripts/related/validate_related_work_index_v1.py`

Verifica:

- hashes;
- tamaños;
- número/ruta de shards;
- sorting determinista;
- routing SHA-256;
- seeds únicos;
- targets únicos;
- ausencia de self-relations;
- rango de vector IDs;
- rango de scores;
- evidencia compacta;
- shared-topic con topicIds;
- expansión contractual;
- totals;
- manifest SHA.

---

## 14. Fixture y reproducibilidad

Fixture:

`benchmark/related-works/v1/index-builder-fixture.json`

Contiene deliberadamente:

- DOI duplicado;
- seed duplicado;
- self-neighbors;
- target duplicado;
- topic compartido;
- vecino bajo piso semántico;
- registro local sin DOI/OpenAlex.

Tests construyen el índice dos veces y exigen:

- manifest SHA idéntico;
- shard SHA idéntico;
- mismas counts;
- misma deduplicación.

---

## 15. CI

Workflow:

`.github/workflows/related-work-index-v1.yml`

Debe ejecutar:

1. tests JavaScript del formato;
2. tests Python del builder;
3. build del fixture;
4. validación independiente;
5. upload del fixture artifact.

El full build no corre en cada PR.

---

## 16. Estado del build completo

El repo conserva los hashes del FAISS y metadata originales, pero actualmente no documenta una URL pública recuperable de esos dos archivos originales.

Los artefactos públicos Static V4 son derivados.

Por tanto:

> **No se habilita todavía un full build automático usando una fuente distinta.**

Pendiente para Fase 1B:

- recuperar ubicación original o volver a publicar exactamente esos archivos con SHA verificado;
- ejecutar full build;
- validar artefacto;
- medir tamaño/latencia;
- publicar revisión inmutable.

---

## 17. Criterio de cierre de 1A

Fase 1A se considera cerrada cuando:

- builder y validator pasan fixture;
- JavaScript expande el formato al contrato V1;
- output es determinista;
- CI queda verde;
- full build permanece bloqueado si no existe la fuente exacta.

No se requiere todavía publicar los 451,823 seeds.
