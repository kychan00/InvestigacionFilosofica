# Related Works Runtime V1 — Resolver shardeado

## Estado

**Fase 2A — runtime sin UI.**

Esta fase implementa la lectura del futuro `related-work-index-v1` desde el navegador sin descargar modelos de embeddings, sin ejecutar búsquedas federadas y sin modificar todavía el folio bibliográfico.

Componentes:

- `src/core/related-works-resolver.js`
- `src/core/related-work-index-format.js`
- `tests/related-works-resolver.test.mjs`

---

## 1. Objetivo

Dada una identidad canónica de obra:

```text
doi:10.x/...
openalex:W...
record:...
```

el runtime debe:

1. cargar el manifest del índice;
2. calcular localmente qué shard contiene la seed;
3. descargar sólo ese shard;
4. localizar la seed mediante búsqueda binaria;
5. expandir vecinos compactos a `RelatedWorkEdge V1`;
6. opcionalmente hidratar la metadata de presentación;
7. devolver un objeto de respuesta explicable y trazable.

Abrir una ficha no ejecuta Qwen3.

---

## 2. Contrato de red

### Sin hidratación

Primera apertura:

```text
GET related-work-index/manifest.json
GET related-work-index/shards/shard-xx.jsonl.gz
```

No se autoriza ninguna otra llamada.

### Con hidratación

Además:

```text
GET Static-V4/manifest.json
GET Static-V4/metadata/page-NNNN.jsonl.gz
```

Sólo se descargan las páginas necesarias para los targets visibles.

### Prohibido automáticamente

- modelo Qwen3;
- servicio semántico;
- `api.openalex.org`;
- Crossref;
- Internet Archive;
- búsqueda federada general.

Los fallbacks externos pertenecen a una fase posterior y deben ser explícitos.

---

## 3. RelatedWorkIndexClient

Responsabilidades:

- validación del manifest;
- routing SHA-256;
- cache de shards;
- búsqueda de seed;
- expansión a contrato V1;
- cache de metadata pages;
- hidratación.

No contiene lógica de UI.

---

## 4. RelatedWorksResolver

Interfaz:

```js
resolver.resolve(seed, {
  limit: 6,
  hydrate: true,
  signal
})
```

Respuesta:

```js
{
  schemaVersion: "related-work-response-v1",
  seed: { identity },
  edges,
  items,
  coverage,
  provenance
}
```

---

## 5. Coverage

### Seed indexada

```js
{
  indexed: true,
  partial: true,
  reason: "candidate-index-v1a"
}
```

Aunque existan vecinos, V1A sigue marcado como parcial porque todavía contiene únicamente señales semánticas/topic y no constituye el ranking final.

### Seed ausente o sin vecinos elegibles

```js
{
  indexed: false,
  partial: true,
  reason: "seed-not-indexed-or-no-eligible-neighbors"
}
```

Esto no es un error de la ficha.

La UI futura puede ocultar la sección o mostrar un estado metodológico discreto.

---

## 6. Caché

### Manifest

Se carga una vez por cliente.

### Shards

`Map<path, Promise<rows>>`

Reabrir una seed del mismo shard no repite descarga.

Si una descarga falla, la promesa fallida se elimina del cache y se permite retry.

### Metadata

`Map<page, Promise<Map<vectorId, document>>>`

Varios vecinos en la misma página generan una sola descarga.

### Resolver

Cache por:

```text
identity | limit | hydrated/edges
```

---

## 7. Localización de seed

Los seeds dentro de cada shard están ordenados por identidad.

El runtime usa búsqueda binaria, no recorre linealmente todo el shard.

La función sólo opera después de validar que la cantidad de rows coincide con el manifest.

---

## 8. Metadata de presentación

El índice de relaciones no duplica metadata pesada.

Cada target usa su vector ID representante.

La hidratación utiliza Static V4:

- revisión pública: `5a4a195085de54bf607a6c4397092ffb32716dcc`;
- page size: 512;
- page = `floor(vectorId / 512)`.

Campos posibles:

- title;
- authors;
- year;
- journal;
- language;
- DOI;
- URL;
- abstract;
- topics.

La ausencia de metadata no invalida la arista; la UI podrá degradar la presentación.

---

## 9. Abort y errores

Todas las llamadas aceptan `AbortSignal`.

Un error de infraestructura:

- rechaza la resolución;
- no queda atrapado permanentemente en cache;
- no debe cerrar ni romper la ficha principal cuando se integre la UI.

Un empty válido no se trata como error.

---

## 10. Garantías de 2A

Tests exigen:

- manifest + un shard cuando `hydrate=false`;
- cero llamadas a modelo/semantic API/OpenAlex;
- hidratación sólo de páginas necesarias;
- cache efectivo;
- empty/partial para seed ausente;
- retry después de fallo de shard;
- expansión válida a RelatedWorkEdge V1.

---

## 11. Lo que 2A no hace

No realiza todavía:

- ranking final;
- MMR/diversidad;
- integración con Author Authority Graph;
- citaciones;
- fallback federado;
- UI;
- `Ver más relaciones`;
- constelación 2D.

Esas capas consumen este resolver; no lo sustituyen.

---

## 12. Siguiente gate

Antes de integrar UI se necesitan:

1. full index publicado o un subset real suficientemente representativo;
2. benchmark humano para ranking/diversidad;
3. política de fallback para seeds fuera del corpus;
4. smoke de latencia y bytes sobre artefacto remoto real.

Sólo entonces el folio puede empezar a mostrar relaciones de producción.
