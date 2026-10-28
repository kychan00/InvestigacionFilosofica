---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-27
---

# Remote Author Identity V1

## Propósito

Resolver consultas de autor aunque el usuario altere el orden del nombre, use
una variante conocida o el catálogo conserve formas distintas. La capa debe
poner primero obras atribuidas al autor identificado, sin convertir una mención
del nombre en autoría y sin descargar el corpus completo al navegador.

Esta fase extiende [[Author-Intent-Ranking-V1]]. La regla anterior sólo podía
reordenar resultados que los proveedores federados ya hubieran recuperado. La
nueva capa consulta un índice estático del propio corpus OpenAlex Philosophy y
puede añadir obras de autoría directa antes de los resultados federados.

## Decisiones

- El corpus OpenAlex Philosophy alojado en Hugging Face es la fuente
  bibliográfica; no se llama a la API de OpenAlex.
- Wikidata se usa únicamente como evidencia remota de identidad y alias. Sólo
  se aceptan entidades humanas (`P31 = Q5`).
- ORCID se conserva como evidencia cuando ya está presente en el snapshot de
  autores; no es necesario consultar la API de ORCID para resolver cada
  búsqueda.
- El navegador descarga sólo un shard de alias y, tras identificar al autor,
  un shard de obras. No descarga modelos, embeddings ni gigabytes de datos.
- La firma del nombre normaliza Unicode, diacríticos, puntuación y ordena tokens;
  por eso `Immanuel Kant`, `Kant, Immanuel` y `Kant Emmanuel` pueden converger en
  una misma identidad cuando existe evidencia suficiente.
- Si varias personas siguen siendo plausibles, la interfaz muestra candidatos y
  exige selección. No elige silenciosamente un homónimo.
- Si Wikidata no responde o el autor no existe en el snapshot, la búsqueda
  federada continúa sin bloquearse.

## Índice público

El builder se ejecutó en GitHub Actions sobre revisiones fijadas:

- `Mearman/OpenAlex` @ `ef02effac13bfbd0991612f444cebcef8a882453`;
- `CristianPelayo/openalex-philosophy` @
  `5a4a195085de54bf607a6c4397092ffb32716dcc`;
- corpus `v3.2/philosophy-corpus-v3-2-search.parquet`.

Resultado:

- 451.823 obras en el corpus;
- 362.036 obras con authorship;
- 443.792 relaciones autor–obra;
- 215.024 IDs de autor distintos;
- 215.015 autores resueltos;
- 443.604 filas de obra publicadas después de excluir 164 títulos vacíos;
- 852.230 filas de alias;
- 1.024 shards de alias y 1.024 shards de obras.

La release inmutable es `author-index-v1`. El archivo comprimido pesa
45.093.858 bytes y tiene SHA-256
`07f6076cb042ef3665ca159048e90cff2815c80aec937ce6c93e458c6d3106ba`.
El manifest tiene SHA-256
`5b42d423de84e6f93513060b1aeda400b691a0154d3f96eda1293ba2125df1fa`.
GitHub Pages publica el índice bajo
`data/authors/author-index-v1/`.

## Resolución

```text
consulta con forma de nombre
→ firma Unicode independiente del orden
→ shard de alias del corpus
→ alias canónico conocido y/o Wikidata humano
→ identidad única, dominante o ambigua
→ shard de obras del autor seleccionado
→ deduplicación por OpenAlex ID
→ obras del autor antes de resultados federados
```

Una coincidencia duplicada sólo se resuelve automáticamente como identidad
dominante cuando la primera variante tiene al menos diez obras y cinco veces el
conteo de la segunda. Las coincidencias cercanas que no cumplen esa regla
permanecen ambiguas.

## Implementación y verificación

- PR de producto: `#22`.
- Merge: `1e70854210fea74d411652d22c9442898874e56e`.
- Builder/release: workflows `40621067439` y `40621047955`.
- Suite tras la integración: 94/94 pruebas JavaScript.
- Prueba de núcleo público: `Kant`, `Emmanuel Kant` y `Kant Emmanuel`
  convergen en `Immanuel Kant`, ID de autor OpenAlex `A5020923463`, con 142
  obras del corpus.

## Límites

- El índice sólo puede añadir obras cuya relación de autoría exista en los
  snapshots fijados. `Alonso Nava Amezcua`, por ejemplo, no aparece en esa
  tabla de authorships; en ese caso sigue operando la prioridad federada de
  [[Author-Intent-Ranking-V1]].
- Wikidata puede aplicar límites o quedar temporalmente indisponible. La capa
  degrada a coincidencia exacta del corpus o a búsqueda tradicional.
- La forma del nombre no demuestra por sí sola identidad. Los casos ambiguos
  conservan intervención humana explícita.
- Esta corrección de producto no es un resultado Qwen, no usa labels humanos,
  no modifica retrieval semántico ni `src/core/rank.js`, y no toca los
  artefactos congelados de `benchmark/qwen3`.
