---
type: project-state
updated: 2026-09-28
status: design
---

# Project State

## Producción actual

**Investigación Filosófica** funciona como motor federado de recuperación bibliográfica especializado en filosofía.

Flujo actual:

```text
consulta
→ parser
→ expansión conceptual y multilingüe
→ recuperación federada
→ normalización
→ deduplicación
→ ranking
→ presentación
```

Fuentes activas principales:

- OpenAlex Philosophy
- Crossref
- Internet Archive
- CUCSH Filosofía

La arquitectura actual está documentada en el `ARCHITECTURE.md` del repositorio.

## Nueva fase estratégica

Diseñar e implementar **Modo Investigación**.

La nueva fase no reemplaza el buscador existente. Construye sobre él una metodología completa para acompañar una investigación desde la inquietud inicial hasta un estado de la cuestión trazable y una estructura argumentativa propia.

## Decisiones adoptadas

1. La unidad epistemológica principal no será el paper sino el **problema filosófico**.
2. El sistema debe ayudar a formar la pregunta, no exigir que el usuario llegue con una pregunta perfecta.
3. La interdisciplinariedad forma parte de la construcción del objeto de estudio.
4. El estado del arte debe reconstruir posiciones, tensiones, transformaciones, problemas abiertos y evidencia.
5. La dialéctica no se reducirá mecánicamente a tesis–antítesis–síntesis.
6. Las relaciones filosóficas serán explícitas: objeta, responde, matiza, reformula, presupone, integra, transforma, etc.
7. La IA debe conservar trazabilidad hasta la fuente y distinguir:
   - dato bibliográfico;
   - extracción textual;
   - inferencia interpretativa.
8. El sistema debe conservar la genealogía de la pregunta del propio investigador.
9. Obsidian será herramienta de control conceptual y exportación opcional, nunca dependencia del producto público.
10. El investigador conserva la decisión final sobre pregunta, interpretación, hipótesis y escritura.

## En diseño

- Modelo formal de `ResearchProject`.
- Modelo de `Problem`, `Question`, `Concept`, `Claim`, `Argument`, `Evidence`, `Relation`, `Position` y `Controversy`.
- Constructor socrático de preguntas.
- Modelo de investigación interdisciplinaria.
- Corpus primario/secundario y roles documentales.
- Genealogía dialéctica.
- Genealogía conceptual.
- Laboratorio de argumentos.
- Prueba adversarial de hipótesis.
- Metodología ejecutable.
- Estado del arte narrativo y matricial.

## Próximo hito

Definir el **contrato de datos del proyecto de investigación** y el **flujo completo del Modo Investigación** antes de modificar el runtime.

## Documentos clave

- [[Research-Process]]
- [[Question-Formation]]
- [[Epistemological-Model]]
- [[Research-Mode]]
- [[Research-Mode-Architecture]]

## Research Vault · evaluación Qwen3

Se añadió [[Evaluation-Hub]] como mapa epistemológico de los experimentos Qwen3.

La sección documenta:

- protocolo de juicio humano;
- linaje entre development y validaciones frescas;
- artefactos científicos históricos;
- separación entre AI silver, Qwen scorer/reranker y juicio humano;
- estado del holdout confirmatorio browser-q8 v2.

Los informes originales permanecen preservados como snapshots en `07-Evaluation/Source-Reports/`, mientras que los artefactos canónicos siguen perteneciendo a `benchmark/qwen3/`.

El experimento confirmatorio permanece separado del vault documental y congelado en su rama experimental. Su A/B determinista, la muestra ciega de 212 ítems y los 212 juicios humanos 0–3 ya están congelados. La normalización se realizó sin leer A/B y aplicó la aclaración humana explícita `Q8C070 = 2`; el siguiente límite es construir y congelar el analizador post-juicio antes de cualquier unblinding o evaluación de H1/H2/H3. Los artefactos y hashes canónicos permanecen bajo `benchmark/qwen3/` en el worktree experimental.
