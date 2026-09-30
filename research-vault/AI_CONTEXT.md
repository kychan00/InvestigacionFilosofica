---
type: ai-context
updated: 2026-09-30
---

# Contexto para asistentes

## Repositorio

Este vault pertenece a:

`kychan00/InvestigacionFilosofica`

No confundir con:

`kychan00/philosophia`

El segundo repositorio contiene materiales académicos y clases que pueden servir como fuentes metodológicas, pero no es el runtime de Investigación Filosófica.

## Objetivo del proyecto

Construir una infraestructura epistemológica para investigación filosófica.

El sistema debe acompañar el tránsito:

```text
inquietud
→ delimitación
→ problematización
→ pregunta
→ disciplinas
→ método
→ búsqueda
→ corpus
→ lectura
→ tesis y argumentos
→ controversias
→ genealogía
→ estado del arte
→ hipótesis propia
→ crítica
→ reformulación
→ protocolo
→ estructura de escritura
```

## Unidad central

**Problem**, no **Paper**.

Los documentos funcionan como fuentes y evidencia de posiciones, afirmaciones, argumentos y transformaciones.

## Principios

- No sustituir el juicio del investigador.
- No presentar inferencias de IA como hechos textuales.
- Mantener trazabilidad.
- No forzar tesis–antítesis–síntesis.
- Reconstruir problemas, no sólo redes de documentos.
- Modelar interdisciplinariedad explícitamente.
- Conservar versiones de la pregunta del investigador.
- Tratar el estado del arte como reconstrucción de una conversación, no como lista de referencias.

## Lectura inicial recomendada

1. [[01_PROJECT_STATE]]
2. [[02_ROADMAP]]
3. [[Research-Process]]
4. [[Epistemological-Model]]
5. [[Research-Mode]]

## Estado de implementación

El motor bibliográfico existente está funcionando. La nueva fase se encuentra todavía en diseño conceptual. No implementar cambios de runtime que comprometan el modelo antes de formalizar el contrato de `ResearchProject`.

Existe además una línea de ingeniería desacoplada para recuperación semántica sobre el corpus propio: [[Semantic-Retrieval-Service]]. Su código y artefactos canónicos pertenecen al repositorio principal, no al vault. Esta línea puede avanzar como infraestructura de retrieval sin introducir todavía el modelo de `ResearchProject` ni alterar el buscador público.
