# T2BV — Maestría en Estudios de Género · Revisión por obra

## Resultado
**No admisivo.** La autoridad `program:udg:mae-estudios-genero` permanece en `REVIEW`; se cierra la discusión binaria programática ya estudiada en T2P/V11 y se habilita evaluación individual basada en fuentes primarias para su única tesis RIUdeG/CUCSH de 2026. No se crean alias, no se altera el programa, no se reclasifica la obra ni se modifica el corpus de origen.

## Fuentes institucionales y alcance
- [UdeG, ficha de programa y plan curricular](https://www.udg.mx/sites/default/files/2024-01/maestria_en_estudios_de_genero_cucsh_snp.pdf): investigación, teoría de género I–III, teoría social, investigación feminista, metodologías cualitativas y cuantitativas, seminarios de investigación y áreas de especialización.
- [CUCSH, LGAC](https://www.cucsh.udg.mx/maestrias/maestria_estudios_genero/lineas_generacion): (1) desigualdad, justicia y poder; (2) educación, arte y cultura; (3) sexualidad, cuerpo, identidades y masculinidades.
- [CUCSH, perfil de egreso](https://www.cucsh.udg.mx/maestrias/maestria_estudios_genero/perfil_egreso): capacidad de investigación, pensamiento crítico, transformación cultural y construcción de categorías de análisis.
- [UdeG, oferta académica](https://ww1.udg.mx/es/oferta-academica/maestria-en-estudios-de-genero): área de Ciencias Sociales y Humanidades; orientación de investigación.
- Auditoría preexistente `docs/THESIS_HUMANITIES_ESTUDIOS_GENERO_BOUNDARY_V1.md` (T2P/V11).

## Juicio académico editorial
La identidad es **interdisciplinaria y estructuralmente mixta**: incluye teoría/interpretación/arte/cultura e investigación social sobre instituciones, justicia, política, desigualdad y métodos cuantitativos. La adscripción a CUCSH, el nombre del programa y la presencia de cultura no justifican `INCLUDE` general; la existencia de investigación social tampoco justifica `EXCLUDE` general. V11 ya identificó correctamente esta frontera y T2BV **no la contradice**.

La decisión disciplinaria programática está agotada. Sólo se puede evaluar cada obra en su propio contexto: leer texto oficial completo o front matter sustantivo, contrastar registro institucional, establecer objeto, método y encuadre disciplinario y exigir revisión humana. Título, resumen, palabras clave, embeddings o un modelo lingüístico son señales de apoyo, nunca criterios suficientes de admisión. Hasta adjudicación explícita, conservar `REVIEW`.

## Contrato técnico
- Base `main@fe5669ae9feacffd90a4c90be8997f69b06cafe3` (merge #155).
- Program Authority `2026-11-03.v47` **sin cambio**.
- Scope Policy `2026-11-02.v5` **sin cambio**.
- Metadata Confidence `2026-11-02.v5` **sin cambio**.
- Work Review Policy `2026-11-03.boundary-v4`.
- Fuente de verdad: corpus congelado de **27,576** obras, artifact `13099541204`.
- Cohorte: **1**, RIUdeG, CUCSH, 2026, `REVIEW`; baseline de la última reproyección: 1 unassessed, 1 allowed, 0 blocked.
- Delta de admisión: **0**. `560 INCLUDE · 194 REVIEW · 18,971 QUARANTINE · 7,849 EXCLUDE · 2 REJECT_SOURCE`.
- Delta de colas propuesto para comprobar en CI full: Humanities Action `6/14 → 5/13`; Ready `1/1 → 0/0`; Work Review `3/180 → 4/181`; HOLD `5/13`.

## Salvaguardas
No decidir por tema de una tesis; no fusionar esta autoridad con otros programas de género o de ciencias sociales; no alterar las 152 tesis DCTS, 4 de Cognición, 24 de Derechos Humanos ni 13 de MCA Arte y Comunicación/HOLD. La política `boundary-work-review-does-not-change-admission` sigue vigente.

## Continuación
Tras validación full, comprobar el nuevo `nextHumanitiesReadyAction` sin inventar otro cursor. El lote de esta obra exige lectura primaria y una decisión humana trazable. T3–T9 siguen pendientes según la arquitectura general.
