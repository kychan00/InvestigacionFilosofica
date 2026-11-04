# T2CT — Proyección pública de corroboración externa

## Objetivo

T2CS creó un ledger separado para evidencia externa sobre tesis filosóficas
todavía no reconciliadas con una identidad institucional exacta. T2CT define
qué parte de esa evidencia puede mostrarse en la vista pública de Filosofía
sin alterar la admisión, identidad bibliográfica o paradero físico.

La regla de publicación es deliberadamente mínima:

1. T2CT **no crea nuevas fichas públicas** desde corroboración externa.
2. Sólo puede enriquecer una ficha que ya exista y permanezca
   `philosophyStatus=review`.
3. La coincidencia entre ledger y ficha pública requiere título y primer autor
   normalizados; no se hace matching semántico.
4. Cada proyección publica
   `identityConfirmed=false` y `physicalLocationConfirmed=false`.
5. Los enlaces adicionales pasan por la misma allowlist de referencias del
   navegador y nunca apuntan a PDF, bitstream o descarga.

## Resultado actual

La vista pública sigue teniendo **18 referencias: 16 INCLUDE y 2 REVIEW**.
Las únicas dos fichas enriquecidas son las que ya existían en T2CI:

- **Daniel Galarza Santiago** — *Filosofía de la pseudociencia…*;
- **Adriel Manuel Hernández Guzmán** — *¿El Estado que propone Platón en la
  República es una utopía?*

Francisco Guízar Vázquez y Ammiel Misraim García Diosdado permanecen en el
ledger T2CS, pero **T2CT no los añade como nuevas fichas**. Antes de hacerlo
debe recuperarse y reconciliarse su identidad CUCSH exacta dentro del flujo
bibliográfico institucional.

## Superficie pública

En cada ficha REVIEW corroborada, la sección «Ver evidencia y metadatos»
muestra:

- la evidencia filosófica original;
- el nivel de validación existente;
- una sección «Corroboración adicional»;
- una nota que explica que la identidad exacta y el paradero siguen en revisión;
- enlaces adicionales únicamente cuando cumplen la política de URL de la vista.

La búsqueda local también indexa la nota de corroboración, pero esto no cambia
el `philosophyRole`, el programa real ni el estatus REVIEW.

## Contrato técnico

`build_philosophy_public_index_v1.py` ahora consume
`philosophy-external-corroboration-v1.json` y produce la revisión
`2026-11-04.t2ct-v1`.

Métricas esperadas:

- `records=18`;
- `byStatus={include:16, review:2}`;
- `corroboratedReviewRecords=2`;
- cero promociones de identidad;
- cero promociones de holdings.

GitHub Actions y el despliegue de Pages verifican las mismas invariantes antes
de publicar.

## Lo que queda fuera

T2CT no resuelve:

- los paraderos físicos de los 217 registros históricos CUCSH;
- los cuatro casos T2CR sin corroboración externa independiente;
- la identidad bibliográfica exacta de Guízar o García Diosdado;
- la expansión de la vista pública desde 18 referencias hacia el inventario
  histórico completo.

Esos objetivos requieren una fase posterior con reconciliación institucional,
no una ampliación basada sólo en fuentes externas.
