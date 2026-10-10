---
type: validation
area: semantic-retrieval
status: audit-complete-no-production-change
updated: 2026-10-09
---

# Higiene de metadata e identidad de obra V1

## Propósito

Separar tres problemas observados en el smoke público:

1. anomalías de presentación, como título vacío, HTML literal o mojibake;
2. identidad bibliográfica exacta entre IDs distintos;
3. semejanza suficiente para sospechar la misma obra, pero no para suprimir automáticamente un registro.

La auditoría no cambia corpus, embeddings, FAISS, candidatos, scores, orden ni API. Tampoco usa juicios humanos de relevancia.

## Contrato congelado

El runner se congeló en `39c5b21c8a688c27207a64b24dbd58268271dd56` antes de aplicarse a los resultados.

Identidad exacta significa:

- DOI normalizado compartido; o
- título, año y abstract normalizados exactamente iguales.

Identidad probable significa título y año normalizados iguales, sin evidencia suficiente para colapso automático.

Los valores normalizados se usan únicamente para comparar. La metadata original y todos los IDs se preservan.

## Ejecución única

La auditoría se aplicó a las 50 filas del smoke público congelado, cuyo SHA-256 permaneció:

`ad2f581a1c5714721b088ff24c716876c86bdba6b531abc6200349875cf0490e`

Resultado:

- un grupo `exact_identity` con dos IDs OpenAlex;
- un colapso conservador potencial;
- un grupo `probable_same_work` con tres IDs, incluido el par exacto;
- un título vacío;
- un campo con HTML literal;
- tres campos con posible mojibake, distribuidos entre dos documentos;
- cero cambios de scores, orden o IDs;
- cero labels humanos.

Los resultados quedaron congelados en `40fe59f`. Los artefactos canónicos están en `benchmark/semantic-retrieval/metadata-hygiene-v1/`.

## Interpretación

La auditoría confirma que existe al menos un duplicado exacto presentacionalmente colapsable, pero no demuestra todavía que la regla sea segura para toda la base. El grupo probable no debe colapsarse automáticamente.

Este hito no autoriza cambios de producción ni tuning. La deriva temática observada en el smoke pertenece a una futura evaluación de relevancia, no a la capa de higiene bibliográfica.

## Siguiente gate

1. El contrato separado y su primera validación están documentados en [[Semantic-Presentation-Hygiene-V1]].
2. Ampliar la validación a una muestra más extensa del corpus antes de cualquier integración.
3. Mantener HTML sanitizado sólo en la vista, nunca en la fuente canónica.
4. Mantener identidad probable como señal de auditoría, no como supresión automática.
5. Exigir provenance completa si posteriormente se propone conectar la capa a la API.
