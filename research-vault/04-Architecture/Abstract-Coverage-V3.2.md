---
type: architecture-gate
area: retrieval
status: needs-enrichment
updated: 2026-10-05
---

# Cobertura de abstracts V3.2

## Pregunta del gate

¿El corpus filosófico V3.2 contiene suficiente materia textual para justificar la generación de 451.823 embeddings, o la transformación perdió abstracts disponibles en el mirror de OpenAlex?

## Contrato auditado

- dataset: `CristianPelayo/openalex-philosophy`;
- revisión: `09c329326ed24ccf986c4b4c47c9794f055516dc`;
- archivo: `v3.2/philosophy-corpus-v3-2-full.parquet`;
- SHA-256 del Parquet: `81f39d5ae5ea192897a7c3cd405b3b0a3494a032658895219c7906e5f34e93c0`;
- elegibilidad idéntica a semantic retrieval: `CORE` o `PROBABLE`, excluyendo roles `LOW_QUALITY` y `PARATEXT`.

## Resultado

| Medida | Resultado |
| --- | ---: |
| Filas totales | 822.445 |
| Documentos elegibles | 451.823 |
| Con abstract no vacío | 207.470 |
| Sin abstract | 244.353 |
| Cobertura | 45,918% |
| Abstracts de al menos 200 caracteres | 200.265 |

La mediana de los abstracts presentes es 1.017 caracteres; 96,527% de ellos tiene al menos 200. La carencia central es cobertura, no una mayoría de strings mínimos.

El contraste por tier es diagnóstico:

- `CORE`: 85.463 de 263.737, cobertura 32,405%;
- `PROBABLE`: 122.007 de 188.086, cobertura 64,868%.

## Linaje causal

El builder histórico reconstruyó abstracts únicamente para:

- `PROBABLE` y `BORDERLINE`;
- `CORE` con ancla conceptual ambigua.

La tabla separada de abstracts se relacionaba mediante `work_id`. El extractor histórico esperaba `work_id`, `word` y `positions`, y reconstruía el texto ordenando cada palabra por posición. La fuente se consultaba desde `Mearman/OpenAlex` en `main`, sin una revisión upstream registrada.

Esto explica la brecha sistemática entre `CORE` y `PROBABLE`: el V3.2 full no intentó incorporar todos los abstracts disponibles.

## Verificación del smoke

Se reconstruyeron cinco inputs de los veinte documentos del smoke real mediante las mismas funciones que usa el job de embeddings. Los cinco contienen un bloque `Abstract:` exacto.

El documento *Imaginative blocks and impossibility: an essay in modal psychology* entró con un abstract de 1.178 caracteres. El smoke no funcionó sólo por título.

## Decisión

`NEEDS_ENRICHMENT`

El build masivo de embeddings queda bloqueado. No se modifica V3.2, producción, retrieval ni `src/core/rank.js`.

La ruta siguiente debe:

1. fijar una revisión exacta de `Mearman/OpenAlex`;
2. inspeccionar el esquema real de `works__work_abstracts` en esa revisión;
3. leer sólo lo necesario para los 451.823 `work_id` elegibles;
4. enriquecer los faltantes sin reclasificar el corpus;
5. publicar una nueva versión, previsiblemente V3.3, con hashes y linaje;
6. repetir la auditoría y el smoke antes de generar embeddings masivos.

El preflight de la fuente está documentado en [[Abstract-Enrichment-V3.3-Preflight]]. Ya se fijaron los 244.353 targets y el esquema real, pero la ruta inmutable exige una lectura casi completa del subset de 177,3 GB; la API selectiva es una fuente viva. El gate siguiente es `SOURCE_DECISION_REQUIRED`.

## Canonicalidad

El auditor, el resumen técnico y el reporte JSON canónico pertenecen al worktree de código. El JSON completo y las tres muestras JSONL permanecen fuera de Git bajo `artifacts/semantic-retrieval/audits/`. Esta nota conserva la decisión metodológica, no sustituye los artefactos ejecutables.
