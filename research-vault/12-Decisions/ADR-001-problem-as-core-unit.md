# ADR-001 · Problem as core unit

**Status:** accepted  
**Date:** 2026-09-27

## Context

El motor actual organiza resultados bibliográficos alrededor de documentos. El nuevo Modo Investigación necesita representar el contenido intelectual que atraviesa esos documentos.

## Decision

La unidad epistemológica principal del nuevo sistema será `Problem`.

`Document` seguirá siendo una entidad fundamental, pero como fuente y evidencia.

## Consequences

El modelo deberá permitir que:

- un documento trate varios problemas;
- un problema aparezca en muchos documentos;
- un problema cambie de formulación;
- distintas posiciones respondan al mismo problema;
- una crítica abra un problema nuevo.

## Related

- [[Epistemological-Model]]
