# T2CI — Vista pública de tesis de Filosofía

## Objetivo

Publicar en `tesis.html` una vista de **Filosofía** que haga visibles, en una misma superficie bibliográfica, los programas filosóficos documentados y las tesis interdisciplinarias cuyo contenido filosófico fue curado explícitamente.

La vista no redefine programas, no cambia admisiones del corpus efectivo y no convierte una tesis interdisciplinaria en una tesis de un programa de Filosofía.

## Base documental

T2CI reutiliza tres capas ya aprobadas: `thesis-effective-corpus-v2`, `philosophy-official-supplement-v1.json` y `philosophy-curated-content-v1.json`. No se ejecuta clasificación semántica automática para decidir pertenencia a Filosofía.

## Programas documentados

La vista publica exactamente:

- `program:udg:lic-filosofia` — Licenciatura en Filosofía;
- `program:udg:mae-estudios-filosoficos` — Maestría en Estudios Filosóficos;
- `program:udg:mae-filosofia-historica` — Maestría en Filosofía (histórica).

No se crea `Doctorado en Filosofía`. `Doctorado en Humanidades` permanece distinto y no se relabela.

## Superficie T2CI

`build_philosophy_public_index_v1.py` genera `data/theses/philosophy-v1/index.json` durante el deploy.

Contrato actual:

- 18 referencias;
- 16 `include`;
- 2 `review`;
- 9 `program-core`;
- 2 `program-core-candidate`;
- 6 `philosophical-content`;
- 1 `curated-manual-classification`;
- 10 programas académicos reales representados.

Programas filosóficos:

- Licenciatura en Filosofía: 6 referencias, 5 incluidas y 1 en revisión;
- Maestría en Estudios Filosóficos: 3 referencias, 2 incluidas y 1 en revisión;
- Maestría en Filosofía: 2 referencias incluidas.

## Preservación del programa real

Los cruces conservan el programa observado. Filosofía + TIC permanece Maestría en Tecnologías para el Aprendizaje; ontología de la relatividad permanece Licenciatura en Física; Ricoeur y Rulfo permanece Maestría en Estudios de Literatura Mexicana.

## Estados y reference-only

`review` se publica sólo para transparencia y no se promociona a admisión canónica. T2CI almacena 0 PDFs, 0 bitstreams y 0 texto completo; URLs con `.pdf`, `/bitstream` o `/download` fallan cerrado.

## UI y cierre

`tesis.html` ofrece **Humanidades** (566) y **Filosofía** (18), con filtros por programa real, grado, unidad, años y relación filosófica. Antes del merge se exigen builder Python, contrato JS, smoke browser y generación desde V2/566. Después del merge se verifica `tesis.html?scope=philosophy` por navegador.
