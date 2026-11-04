# T2CB — DCTS · Captura y adjudicación primaria del batch 002

## Resultado

**Dos fuentes primarias oficiales capturadas y revisadas. Fase no admisiva.**

T2CB continúa el batch `urban-territory-002` integrado en T2CA y produce dos juicios work-level distintos:

- `thesis:work:00024461 → include-candidate`;
- `thesis:work:00024462 → retain-review`.

Ambas obras **permanecen REVIEW** en T2CB. AcademicProgramAuthority del Doctorado en Ciudad, Territorio y Sustentabilidad también permanece REVIEW.

El merge manual de este PR constituirá la validación humana de estas dos candidatas. Cualquier cambio de admission deberá ocurrir en una fase posterior y explícita.

## 1. Captura reproducible

Workflow de descubrimiento y captura inicial:

- run: `41753014224`;
- artifact: `13286768116`;
- artifact digest: `sha256:7f92a0d86805154f9e6c9aa9baad7dc0ab63d56410436260853704f7c3e5ea8c`.

El fetcher:

`scripts/thesis/fetch_riudg_primary_source_v1.py`

sólo acepta un documento como fuente primaria si el payload real tiene magic bytes `%PDF-`.

Además:

1. conserva los intentos de descarga;
2. calcula SHA-256 del PDF;
3. obtiene páginas con `pdfinfo`;
4. extrae texto con `pdftotext -layout`;
5. calcula SHA-256 del texto extraído.

No se sustituye el full text por abstract, keywords, tabla de contenido, embedding o clasificación automática.

## 2. Obra 00024461

Work ID:

`thesis:work:00024461`

Título:

*Mecanismos sociales en el hábitat popular latinoamericano. Metateoría, teoría y explicación.*

Autor:

Ariel García Núñez.

Registro institucional:

https://www.riudg.udg.mx/handle/20.500.12104/84204

PDF oficial:

https://www.riudg.udg.mx/bitstream/20.500.12104/84204/1/DCUAAD10072FT.pdf

Captura:

- fichero: `DCUAAD10072FT.pdf`;
- páginas: **366**;
- bytes: **3,807,442**;
- PDF SHA-256: `b6ae86dfbeec25fc54507e1edb240e155d8f34bbb0c6a46953259064d1c71695`;
- texto extraído: 1,017,405 caracteres;
- text SHA-256: `4e2011e53d8b457d9a1333ce364eb6d9e2239f9b9f2569ac3249d5057041d1aa`.

### Objeto y preguntas

La pregunta general estudia qué clases de **mecanismos sociales** son referidas por explicaciones de teorías sobre el hábitat popular latinoamericano.

Las preguntas particulares no se limitan al fenómeno urbano: interrogan explícitamente la:

- organización lógica;
- estructura presuposicional;
- ontología;
- epistemología;
- validez de las explicaciones mecanísmicas.

El propio texto caracteriza la pregunta general como de naturaleza **metateórica**.

### Método y operación intelectual

El trabajo construye y aplica un esquema metateórico para analizar teorías del hábitat popular.

Su arquitectura incluye:

1. sistematización de relaciones entre ontología, epistemología y explicación;
2. axiomatización/operacionalización de un esquema metateórico;
3. análisis de teorías de marginalidad, marxista-dependentistas, Abramo y Jaramillo;
4. construcción de un esquema de explicación mecanísmica;
5. validación empírica posterior sobre fenómenos de evolución urbana.

El caso urbano aparece como validación de una construcción conceptual previa, no como sustituto de ella.

### Marco conceptual y disciplinario

Son estructurales:

- Mario Bunge y el sistemismo;
- Roy Bhaskar y el realismo crítico;
- Margaret Archer y estructura/agencia;
- ontología social;
- epistemología social;
- mecanismos y explicación;
- filosofía y metateoría de las ciencias sociales.

La tesis sostiene de forma reiterada que la explicación social requiere presupuestos ontológicos, epistemológicos y metodológicos explícitos.

### Juicio work-level

**`include-candidate`**

La obra no se admite por pertenecer al DCTS ni porque su título contenga un término determinado.

El fundamento es el full text: su objeto intelectual primario es el análisis metateórico y filosófico de explicación, ontología y epistemología en teorías sociales. La investigación urbana proporciona el dominio sobre el que se analizan y validan esos problemas.

Bajo el target estricto `humanities-only`, esta obra concreta presenta un encuadre filosófico-metateórico suficientemente estructural para justificar una candidata INCLUDE sin reclasificar el programa.

## 3. Obra 00024462

Work ID:

`thesis:work:00024462`

Título:

*El borde fronterizo como espacio público. Caso de estudio: Ciudad Juárez y El Paso TX.*

Autora:

Susana Gutiérrez Luna.

Registro institucional:

https://www.riudg.udg.mx/handle/20.500.12104/84205

PDF oficial:

https://www.riudg.udg.mx/bitstream/20.500.12104/84205/1/DCUAAD10073FT.pdf

Captura:

- fichero: `DCUAAD10073FT.pdf`;
- páginas: **258**;
- bytes: **12,154,620**;
- PDF SHA-256: `c3df45c25348fa5929d9c170446a110cdf515df1bded228475bdb3c37aacc527`;
- texto extraído: 470,834 caracteres;
- text SHA-256: `9177fc0f36506e7d715990c6d534b7284009183fc755c96c1d2a9f76db5d1e08`.

### Objeto y preguntas

La pregunta general es si el borde fronterizo puede catalogarse como **espacio público**.

Las preguntas particulares estudian:

- sus características como espacio público;
- su relación con la configuración de Ciudad Juárez y El Paso;
- significado e identidad para habitantes fronterizos.

La hipótesis sostiene que el borde fronterizo puede cumplir funciones de espacio público y generar apropiación, identidad e imaginario aun sin haber sido diseñado originalmente como tal.

### Método

El texto trabaja con una estrategia cualitativa e interdisciplinaria que incluye:

- construcción conceptual de espacio público, frontera y borde;
- revisión histórica;
- análisis de sitio;
- análisis fotográfico;
- interpretación hermenéutica;
- análisis fenomenológico;
- encuestas abiertas;
- variables de sociabilidad, acceso/conexiones, confort/imagen y usos/actividades.

### Marco disciplinario

Existen dimensiones humanísticas sustantivas:

- identidad;
- imaginarios colectivos;
- apropiación;
- cultura fronteriza;
- significado;
- interpretación;
- hibridez y alteridad.

Pero el objeto y la operación permanecen también fuertemente ligados a:

- urbanismo;
- configuración espacial;
- análisis físico del sitio;
- funcionamiento del espacio público;
- accesibilidad;
- equipamiento;
- usos y actividades;
- tipología espacial.

La conclusión propone reconocer el **borde fronterizo como una tipología de espacio público**.

### Juicio work-level

**`retain-review`**

No se propone EXCLUDE: el trabajo posee una dimensión cultural, identitaria e interpretativa real.

Tampoco se propone INCLUDE bajo `humanities-only`: el full text no permite separar esas dimensiones de un objeto urbanístico y espacial igualmente estructural.

La ambigüedad interdisciplinaria del programa persiste en esta obra concreta. RETAIN-REVIEW es por ello un juicio positivo y explícito de frontera, no una falta de análisis.

## 4. Config revisado

Archivo:

`scripts/thesis/config/urban-territory-adjudication-batch-002-reviewed-v1.json`

El registro fija para cada obra:

- workId;
- handle;
- URL institucional;
- URL exacta del PDF oficial;
- SHA-256;
- páginas;
- decisión candidata;
- fundamento `official-thesis-fulltext-reviewed`;
- racional disciplinario;
- `humanValidationStatus = pending-user-merge`.

## 5. Ledger esperado

El ledger T2CB debe producir:

- obras: **2**;
- primary source available: **2**;
- `candidate-proposed`: **2**;
- `include-candidate`: **1**;
- `retain-review`: **1**;
- `pending-user-merge`: **2**;
- admission changes: **0**.

## 6. Conteos e invariantes

T2CB no cambia el effective corpus:

- INCLUDE: **561**;
- REVIEW: **193**;
- QUARANTINE: **18,971**;
- EXCLUDE: **7,849**;
- REJECT_SOURCE: **2**;
- total: **27,576**.

DCTS:

- 152 obras;
- 152 REVIEW;
- Program Authority REVIEW.

Program Authority permanece `2026-11-03.v47`.

Scope Policy permanece `2026-11-02.v5`.

Metadata Confidence permanece `2026-11-02.v5`.

Work Review Policy permanece `2026-11-03.boundary-v4`.

## 7. Significado del merge

El merge manual de T2CB debe interpretarse como aceptación humana de:

- `00024461 → include-candidate`;
- `00024462 → retain-review`.

No constituye por sí mismo una mutación del corpus.

Una fase posterior podrá proponer una decisión work-level de `REVIEW → INCLUDE` únicamente para `00024461`, con provenance y reversibilidad.

`00024462` deberá permanecer REVIEW salvo que aparezca evidencia nueva que justifique reabrir su adjudicación.
