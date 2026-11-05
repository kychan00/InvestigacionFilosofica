# T2DC — Resolución work-level de tesis MEF mediante OAI RIUdeG

**Fecha:** 5 de noviembre de 2026  
**Base:** T2DB / PR #193  
**Objetivo:** recuperar un identificador institucional estable para las tesis de
Mario Damián del Muro Silva y Adriel Manuel Hernández Guzmán.

## Por qué esta fase

T2DB ya cerró la pregunta de **programa**:

- Mario Damián del Muro Silva: Maestría en Estudios Filosóficos confirmada por
  fuentes oficiales UdeG.
- Adriel Manuel Hernández Guzmán: Maestría en Estudios Filosóficos confirmada
  ahora por una ficha oficial UdeG.
- Jesús Octavio Campos Ramos: programa todavía sin resolver.

Sin embargo, programa confirmado no equivale a identidad institucional de la
tesis. T2DC deja de buscar biografías y ataca directamente el repositorio
institucional.

## Fuente

RIUdeG expone OAI-PMH:

`https://riudg.udg.mx/oai/request`

Set de tesis:

`com_20.500.12104_9`

Metadata:

`dim`

El resolver reutiliza el mismo parser institucional de
`harvest_real_corpus_v1.py`.

## Alcance exacto

T2DC busca únicamente:

### Mario Damián del Muro Silva

**Análisis retórico del discurso político: Figuras a través del Twitter en la
elección presidencial 2018 en México**

### Adriel Manuel Hernández Guzmán

Forma bibliográfica T2DA/T2DB:

**El Estado propuesto por Platón en la República es una utopía**

Variante autoral preservada:

**¿El Estado que propone Platón en la República es una utopía?**

Ambas formas se consultan, pero no se fusionan fuera del resultado OAI.

## Regla de identidad

Una tesis puede ascender a `institutional-work-confirmed` sólo si un mismo
registro OAI contiene:

1. título exacto tras normalización;
2. autor exacto tras normalización de orden/puntuación;
3. al menos un handle persistente extraído de `dc.identifier.uri` o
   `dc.identifier`.

Una coincidencia sólo por título o sólo por autor se conserva como diagnóstico y
nunca confirma la obra.

## Exhaustividad

El script sigue todos los `resumptionToken` del set hasta:

- agotar el set; o
- alcanzar el límite de seguridad de 500 páginas.

El workflow usa una pausa de 150 ms entre páginas para no golpear el servicio.

El artifact registra:

- páginas recorridas;
- registros activos;
- tombstones;
- `completeListSize`;
- si el scan terminó realmente;
- coincidencias exactas;
- coincidencias sólo por título;
- coincidencias sólo por autor.

## Política reference-only

T2DC **no descarga tesis**.

No persiste:

- PDFs;
- bitstreams;
- endpoints de descarga;
- payload OAI crudo;
- cookies;
- sesiones;
- credenciales.

Sólo persiste metadata bibliográfica mínima y handles estables.

## Interpretación de un resultado negativo

Incluso si el scan completa todo el set y devuelve cero coincidencias exactas:

`not-found-in-completed-oai-scan`

no significa:

`thesis-does-not-exist`.

Significa únicamente que no se recuperó una identidad OAI estable en el set
consultado con las formas bibliográficas conocidas.

## Archivos

- `scripts/thesis/scan_riudg_mef_work_ids_t2dc.py`
- `scripts/thesis/config/mef-riudg-oai-work-resolution-t2dc-baseline.json`
- `tests/test_thesis_mef_work_ids_t2dc.py`
- `.github/workflows/thesis-mef-work-resolution-t2dc.yml`
- este documento.

## Resultado vivo verificado

La ejecución exhaustiva terminó correctamente en GitHub Actions:

- workflow run: `42102127791`;
- head: `3e83e29e7551e8f811452b4f15ec16a206cf4fbd`;
- artifact: `13449573845`;
- digest:
  `sha256:6925f92f45f45cbe70e5b46cfe170c044e61f149540ca02b55485abec8a2c72a`.

El OAI reportó:

- `completeListSize`: **27,431**;
- páginas recorridas: **275**;
- registros activos inspeccionados: **27,429**;
- tombstones: **2**;
- scan completado: **sí**.

La suma de registros activos y tombstones coincide exactamente con el tamaño
declarado del set.

### Adriel Manuel Hernández Guzmán

Para las dos formas conocidas del título:

- *El Estado propuesto por Platón en la República es una utopía*;
- *¿El Estado que propone Platón en la República es una utopía?*;

el set completo produjo:

- coincidencias título + autor: **0**;
- coincidencias sólo por título: **0**;
- coincidencias sólo por autor: **0**;
- handles recuperados: **0**.

Estado:

`not-found-in-completed-oai-scan`

### Mario Damián del Muro Silva

Para:

*Análisis retórico del discurso político: Figuras a través del Twitter en la
elección presidencial 2018 en México*

el set completo produjo:

- coincidencias título + autor: **0**;
- coincidencias sólo por título: **0**;
- coincidencias sólo por autor: **0**;
- handles recuperados: **0**.

Estado:

`not-found-in-completed-oai-scan`

## Interpretación

T2DC cierra de manera exhaustiva **RIUdeG/OAI para las formas bibliográficas
conocidas** de Mario y Adriel.

Esto es más fuerte que una búsqueda web negativa: se inspeccionaron todos los
registros activos que el propio set OAI declaró en ese momento.

Sin embargo, el resultado sigue sin demostrar que las tesis no existan. Puede
significar, entre otras posibilidades:

- que nunca fueron incorporadas a RIUdeG;
- que sólo existan en acervo físico;
- que estén registradas en otro catálogo institucional;
- que la metadata use una identidad bibliográfica todavía desconocida.

El resultado vivo quedó congelado en:

`scripts/thesis/config/mef-riudg-oai-work-resolution-t2dc-baseline.json`

para no depender del artifact temporal.

## Siguiente fase

T2DD debe **cambiar de proveedor**.

Prioridad:

1. Biblioteca CUCSH / Dr. Manuel Rodríguez Lapuente y catálogos físicos;
2. archivos o listados del programa de Maestría en Estudios Filosóficos;
3. Control Escolar únicamente como evidencia de egreso, nunca como identidad de
   tesis;
4. bibliografías institucionales que puedan aportar signatura, inventario,
   número de sistema o registro individual;
5. no repetir RIUdeG ni Aleph para Mario/Adriel salvo que otra fuente entregue
   un identificador concreto nuevo.

T2DC no modifica Effective Corpus V2, Program Authority ni la vista pública.
