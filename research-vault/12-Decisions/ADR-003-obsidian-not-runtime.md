# ADR-003 · Obsidian is not a runtime dependency

**Status:** accepted  
**Date:** 2026-09-27

## Context

Obsidian es útil para organizar el conocimiento del proyecto y puede ser una excelente exportación para investigadores.

## Decision

Obsidian no será requisito para usar Investigación Filosófica.

El vault del repositorio utiliza Markdown estándar.

## Consequences

- La web pública funciona sin Obsidian.
- El formato de conocimiento interno sigue siendo portable.
- Obsidian puede utilizarse como workspace de desarrollo y como exportación opcional.
- `.obsidian/` no se versiona.

## Related

- [[00_HOME]]
