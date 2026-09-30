---
type: product-experiment
area: evaluation
updated: 2026-09-29
status: experimental-opt-in
---

# Qwen3 browser q8 · prototipo opt-in

## Decisión

Qwen3 browser q8 puede probarse como un **reordenador experimental opcional**, pero no sustituye el ranking de producción ni se activa por defecto.

Esta decisión no reinterpreta el gate externo. La validación independiente terminó formalmente inconclusa por una abstención primaria y no produjo p-value, aunque el ΔP@10 pareado quedó exactamente identificado en `+0.108333`. El artefacto de decisión conserva `production_ranking_action = no-change` y el candidato como research-only.

## Alcance del prototipo

```text
consulta
→ retrieval y ranking normal
→ Top 20 ya recuperado
→ acción manual del usuario
→ Qwen3 q8/WebGPU puntúa esos mismos 20
→ orden experimental por raw score
```

Invariantes:

- activación explícita mediante `?qwen3=1`;
- ninguna ejecución automática;
- misma membresía Top 20;
- raw score descendente;
- empate exacto resuelto por rango productivo original;
- sin threshold ni blending;
- sin labels humanos, condición A/B, score/rango productivo o provenance de proveedor en la entrada del modelo;
- cancelación o error conserva exactamente el orden normal;
- ninguna modificación de `src/core/rank.js` ni de retrieval.

El contrato ejecutable canónico vive en `benchmark/qwen3/product/qwen3-browser-q8-opt-in-v1.contract.json`. El vault sólo interpreta su lugar metodológico.

## Límite de rendimiento

La inferencia no es interactiva en sentido estricto. En las 240 filas congeladas de external-validation-v1:

- mediana por documento: `17.083 s`;
- p90: `44.137 s`;
- media: `22.328 s`.

Por tanto, puntuar veinte documentos requiere típicamente varios minutos, además de la descarga inicial del modelo. La interfaz debe mostrar progreso, mantener visible el orden normal y permitir cancelación entre documentos. Esta latencia impide activar el reranker por defecto aunque futuros estudios fortalecieran la evidencia de calidad.

## Garantía WebGPU

La garantía tiene dos niveles:

1. **Build:** esbuild usa plataforma browser, debe resolver `transformers.web.js`, exige al menos una entrada `onnxruntime-web` y aborta si el grafo incluye `onnxruntime-node`, `transformers.node` o un backend ONNX de Node.
2. **Runtime:** el scorer rechaza Node y ausencia de `navigator.gpu`, solicita un adaptador de alto rendimiento no fallback, crea el modelo con `device=webgpu`, `dtype=q8` y `executionProviders=[webgpu]`, y valida que cada sesión ONNX reporte WebGPU/q8.

El host WASM permanece con un hilo sólo para handles de sesión y tensores; no se habilita como execution provider alternativo. Si WebGPU falla, no hay degradación a CPU/WASM: se conserva el ranking normal.

## Pesos y privacidad

Los pesos no se descargan ni se versionan en Git. El navegador obtiene desde el repositorio remoto fijado el artefacto `onnx/model_quantized.onnx` de la revisión `9995c50e2310679108a55f5ccd16ba8be9f17c20` y puede conservarlo en su caché local.

La puntuación ocurre en el navegador. No se añadió telemetría de aplicación. La entrada se limita a consulta, título, autores, año, idioma documental y resumen.

## Qué no demuestra

La existencia del prototipo no implica:

- promoción científica del candidato;
- mejora confirmatoria externa;
- permiso para cambiar el ranking por defecto;
- viabilidad de latencia para uso general;
- autorización para tuning con los labels ya observados.

## Próximo gate

Separar dos preguntas:

1. **Calidad:** una réplica prospectiva nueva debe resolver el gate estadístico sin reutilizar labels para tuning.
2. **Producto:** una evaluación de factibilidad debe fijar por adelantado presupuesto de descarga, memoria, latencia, cancelación y compatibilidad de hardware.

Sólo evidencia suficiente en ambos ejes podría justificar discutir una activación más amplia. Hasta entonces, el modo seguirá oculto, manual y experimental.

## Relacionado

- [[Qwen3-External-Validation-Protocol]]
- [[Qwen3-Reranker-Laboratory]]
- [[Evaluation-Lineage]]
- [[Judgment-Protocol]]
