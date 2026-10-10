---
type: ai-context
updated: 2026-10-10
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

Existe además una línea de ingeniería desacoplada para recuperación semántica sobre el corpus propio: [[Semantic-Retrieval-Service]]. Su código y artefactos canónicos pertenecen al repositorio principal, no al vault. La ruta semántica se expone ya como alfa pública opt-in: no introduce todavía el modelo de `ResearchProject`, no cambia `src/core/rank.js`, conserva la búsqueda federada como predeterminada y vuelve automáticamente a ella cuando el backend local no está disponible.

La interfaz pública comprueba el endpoint ligero `/health` sin ejecutar inferencia y muestra tanto la disponibilidad semántica como el motor seleccionado, activo y finalmente usado. Este estado es informativo: la petición conserva siempre el fallback tradicional porque la disponibilidad puede cambiar después del chequeo.

El primer smoke operacional público reproducible está cerrado como `PASS_WITH_DATA_QUALITY_FINDINGS`: cinco consultas congeladas devolvieron 50 resultados directos del motor semántico, sin fallback y sin reranker. No es una evaluación humana de relevancia. Reveló un título vacío, duplicados o casi duplicados, mojibake, HTML literal y un caso visible de deriva temática. La evidencia ejecutable y sus hashes permanecen en `benchmark/semantic-retrieval/public-smoke-v1/`; véase [[Public-Semantic-Smoke-V1]].

La auditoría prospectiva [[Semantic-Metadata-Hygiene-V1]] separa anomalías de metadata, identidad exacta e identidad probable sin modificar el corpus ni el ranking. Su ejecución única encontró un grupo exacto de dos IDs y un grupo probable de tres IDs, además de cinco hallazgos de metadata. El resultado no autoriza integración productiva: el siguiente gate debe validar por separado cualquier limpieza de presentación o colapso conservador.

La capa experimental [[Semantic-Presentation-Hygiene-V1]] preserva fuente, IDs, ranks y scores mientras produce campos `display` sanitizados y provenance de grupos exactos. Pasó 44 pruebas y una validación held-out de 25 documentos sin solapamiento con el Top 10. El gate corpus-wide posterior validó sus reglas sobre el índice completo.

El gate [[Semantic-Corpus-Identity-Audit-V1]] extendió esa comprobación a los 451.823 registros V3.3: encontró 9.266 grupos exactos, 21.351 miembros y 12.085 repeticiones presentacionales potenciales. La validación independiente reprodujo todos los hashes de contenido, confirmó unicidad global de IDs y no encontró conflictos de autor. El corpus carece de DOI, por lo que la rama DOI permanece sólo sintéticamente probada. El gate autorizó únicamente una integración presentacional separada y default-off; no autorizó cambios de ranking ni de producción.

La integración [[Semantic-Presentation-API-Integration-V1]] conectó esa transformación a la API mediante doble opt-in: capacidad del servidor y consentimiento explícito de la petición. Pasó 53/53 pruebas y un smoke local sobre Top 10 que conservó IDs, orden y scores al colapsar un único par exacto.

El rollout [[Semantic-Presentation-Public-Rollout-V1]] activó después la capacidad en el daemon y en la ruta pública `Semántica · alfa`. El smoke público reprodujo el comportamiento 10→9, conservó provenance y scores, y mantuvo el reranker apagado. El frontend de PR 14 pasó 75/75 pruebas y GitHub Pages desplegó correctamente. La búsqueda federada sigue siendo la predeterminada y el cambio no afecta retrieval ni ranking.

La instalación [[Semantic-Durable-Runtime-V1]] sacó después código, entorno Python e índice del worktree administrado por Codex. Conservó el commit de servicio, el índice de 451.823 documentos, sus hashes y la política pública. Salud local/pública y una consulta de aceptación pasaron sin cambiar primer ID o score. Sigue siendo un servicio del Mac, no hosting cloud; falta únicamente comprobar recuperación tras login o reinicio completo para cerrar su gate operacional.
