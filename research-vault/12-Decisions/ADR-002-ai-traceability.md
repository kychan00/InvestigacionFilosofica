# ADR-002 · AI traceability

**Status:** accepted  
**Date:** 2026-09-27

## Context

El Modo Investigación utilizará IA para extraer, comparar y reconstruir contenido filosófico. Una inferencia interpretativa no debe confundirse con evidencia textual.

## Decision

Toda salida analítica relevante deberá distinguir:

1. `BibliographicFact`
2. `TextualExtraction`
3. `InterpretiveInference`

Las inferencias deben enlazar con evidencia identificable y nivel de confianza.

## Consequences

No se aceptará una arquitectura donde una síntesis generada sea imposible de rastrear hasta sus fuentes.

## Related

- [[Epistemological-Model]]
