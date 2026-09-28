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

El experimento confirmatorio browser-q8 v2 está cerrado y congelado en su rama experimental. El unblinding se ejecutó una sola vez desde un analizador previamente congelado: H1 recibió apoyo direccional (`ΔP@10` interdisciplinario `+0.060`), mientras H2 (`−0.010`) y H3 (`−0.010`) no lo recibieron. El efecto descriptivo global fue `ΔP@10 = +0.070`, pero la auditoría no identifica P@10 absoluto ni introduce significancia formal. El resultado es mixto, interno y no autoriza un cambio automático de producción. Los artefactos y hashes canónicos permanecen bajo `benchmark/qwen3/` en el worktree experimental.

El gate post-resultado conserva el candidato como **research-only** y fija `production_ranking_action = no-change`. El siguiente estudio admisible es una validación humana externa realmente independiente; su protocolo conceptual está en [[Qwen3-External-Validation-Protocol]]. El profesor externo confirmó un rol exclusivamente adjudicador, ausencia de participación previa, cobertura en español e inglés y capacidad temática en francés y portugués, con un máximo aproximado de 250 pares. El diseño provisional usa 12 consultas y la unión completa de ambos Top 10 para un máximo de 240 ítems únicos más 10 repeticiones ciegas.

La ruta API del marco público de Philosophy Stack Exchange quedó preservada como historia de adquisición fallida y fue sustituida prospectivamente por Stack Exchange Data Explorer debido al `throttle_violation` del proveedor. La consulta SQL, el contrato y el normalizador offline se congelaron antes de adquirir datos. La ejecución única de SEDE produjo 9.846 preguntas públicas elegibles y el snapshot sanitizado quedó congelado canónicamente en `fea8553`: JSONL SHA-256 `3dc7ce68a91f7fbc5d46550a12d61d438a84c40528ad859ee1e743d2ef222374` y metadata SHA-256 `454af13ddc5c8d712f2f6da9817c61424b60ef2b64b05dc3a79c0bd3aea77965`. La validación independiente confirmó esquema, orden, unicidad, elegibilidad, corte temporal, licencias, privacidad y linaje.

El clasificador determinista de intención se congeló antes de aplicarse en `401102e` y se ejecutó una sola vez sin red, modelo o labels. El frame aceptado quedó congelado en `8b9484c` con 3.570 candidatos explicables: 1.743 `philosopher-concept`, 84 `work` y 1.743 `interdisciplinary-challenge`; JSONL SHA-256 `b01f07c121007512294a30e4ac59d2c45d3ade787a5a210dc859019a01f30ce0` y metadata SHA-256 `9cc891a999612b3e78b0b757128d462bcf92fe6a3cb477ced7dbfa1bba75b3a6`.

Después se congelaron las colisiones con 150 consultas previas, la exclusión semántica y la selección SHA-256. Un primer intento falló sin outputs por un locator de esquema y se corrigió antes de leer candidatos. El selector corregido `b898d6d98127370321b8c2aa87dbb82c7947c0e7` produjo 12 asignaciones —cuatro por intención y tres por idioma—, congeladas en `b8df0db2ddcd55a875e12d030dc77d2ae14e9165`: JSONL SHA-256 `ba03242da8a3e44440b9baf1de5deb3a009af072c3ac122ec640bb55f977b65d` y metadata SHA-256 `75634c79e91569575d244643d1f21fda0b1cd6b9f38d31eb0a3d11ce0d6dfe6d`. Una reconstrucción independiente confirmó colisiones, orden, linaje y asignación lingüística.

El paquete ciego para las nueve traducciones no inglesas quedó congelado en `ea7f58e13edf0d0c8b0d248cfa5535eaf0cfd07b`: JSONL SHA-256 `fad140a7ef765147f5fc365a82f184391fc90e81c7a34d39f4dfcddf6abe8f30` y metadata SHA-256 `93e7cc23b4cc4ed55b7c6e8e0780c68812dfae72237b347d0b000089ebfdb4ab`. Todos los campos humanos siguen vacíos. El siguiente límite requiere un preparador humano y un verificador humano distinto; ninguno puede ser el profesor adjudicador. No hubo traducción, retrieval, inferencia ni juicio humano.
