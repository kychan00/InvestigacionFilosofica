---
type: architecture
area: retrieval
status: pr-open-default-off
updated: 2026-10-12
---

# Recuperación semántica estática en navegador V4

## Decisión

La V4 demuestra una ruta gratuita de recuperación semántica que no depende de
que el Mac del proyecto permanezca encendido. El navegador calcula el embedding
de la consulta con Qwen3 mediante WebGPU y recupera candidatos desde artefactos
estáticos públicos en Hugging Face.

No sustituye todavía la búsqueda federada predeterminada. La integración queda
oculta tras `?semantic=browser-v4`, muestra el coste de la descarga inicial y
conserva las rutas semántica local y federada como fallbacks.

## Arquitectura material

```text
consulta
→ Qwen3-Embedding-0.6B fp16 en WebGPU
→ selección de 32 de 256 clusters
→ shards int8 publicados en Hugging Face
→ similitud coseno sobre candidatos
→ metadata JSONL comprimida
→ resultados trazables
```

El corpus conserva 1.024 dimensiones. Los vectores documentales se comprimen a
int8, pero los embeddings de consulta se generan en fp16. No intervienen un LLM
generativo, el reranker, labels humanos ni un backend Node.

## Artefacto publicado

- dataset: `CristianPelayo/openalex-philosophy`;
- revisión inmutable: `5a4a195085de54bf607a6c4397092ffb32716dcc`;
- prefijo: `semantic-retrieval/v3.3/browser-static-v4/20261010-v4`;
- documentos: 451.823;
- archivos: 1.397;
- shards vectoriales: 256;
- páginas de metadata gzip: 883;
- manifest SHA-256:
  `0f8af3920c385e33b84debc9220fc644f4d7194145605fc09cd9e6aa44525cfa`.

El payload vectorial total es 464.474.044 bytes. El modelo fp16 fijado pesa
1.200.510.818 bytes, aproximadamente 1,12 GiB, y constituye el principal coste
de la primera búsqueda. Los pesos se cargan desde el artefacto upstream fijado:
no se subieron a Hugging Face del proyecto ni se incorporaron a Git.

## Validación

La V4 aprobó los gates de ingeniería sobre el índice completo:

- paridad browser/canónica del embedding: media `0,9997217`, mínimo
  `0,9996973`;
- Recall@10: media `0,96`, mínimo por consulta `0,90`;
- Recall@50: media `0,948`;
- cinco consultas y cincuenta resultados por consulta reproducidos exactamente
  en Chrome tanto desde archivos locales como desde las URL públicas;
- árbol remoto con exactamente los 1.397 archivos declarados, sin faltantes,
  extras o discrepancias de tamaño.

El loader implementa filtros por año, idioma, fuente, tipo de publicación,
autor, revista y tema únicamente cuando existe metadata material para
evaluarlos.

## Integración y revisión

La integración default-off quedó publicada en la rama
`codex/browser-semantic-static-v1` y abierta para revisión en el PR 15:

`https://github.com/kychan00/InvestigacionFilosofica/pull/15`

La suite final aprobó 81/81 pruebas JavaScript y 3/3 pruebas Python del builder.
GitHub Push Protection rechazó inicialmente los bundles porque confundió el
nombre público de clase `Mistral3ForConditionalGeneration`, incluido por
Transformers.js, con una clave de API. No se usó bypass. El build conserva el
mismo nombre en ejecución, pero lo construye desde dos fragmentos; después de
reescribir esa representación en la historia de la rama, GitHub aceptó el push.
No había una credencial real.

## Significado epistemológico

Éste es un gate de ingeniería de paridad, recuperación y distribución. No es
una adjudicación humana de relevancia y no autoriza afirmar calidad filosófica
absoluta de los resultados. Tampoco modifica `src/core/rank.js`, el retrieval
federado ni los experimentos Qwen3 congelados.

La evidencia ejecutable canónica permanece en el repositorio principal bajo
`benchmark/semantic-retrieval/browser-static-v4/` y
`docs/QWEN3_BROWSER_SEMANTIC_STATIC_V4.md`. Esta nota sólo conserva la
interpretación arquitectónica e histórica.

## Mapa de salida

1. ✓ Publicar la integración en una rama/PR separada y mantenerla default-off.
2. Medir experiencia de descarga, memoria y caché en dispositivos reales.
3. Decidir con evidencia si se expone como alfa pública explícita.
4. Mantener la ruta federada como predeterminada y fallback hasta cerrar ese
   gate de producto.

## Relaciones

- [[Semantic-Retrieval-Service]]
- [[Full-Semantic-Index-V3.3]]
- [[Semantic-Durable-Runtime-V1]]
- [[Public-Semantic-API]]
