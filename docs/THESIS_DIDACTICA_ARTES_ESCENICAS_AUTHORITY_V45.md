# T2BS — Didáctica de las Artes / Área de Artes Escénicas · Program Authority V45

## Alcance

PHILOSOPHIA no interviene en esta fase: este cambio pertenece únicamente al buscador de tesis de `InvestigacionFilosofica`.

El corpus mantiene un alcance **UdeG + Humanidades exclusivamente**, en todos los niveles. T2BS decide la autoridad histórica exacta:

`program:udg:mae-didactica-artes-escenicas-historica`

No se clasifica por contener «artes», por ubicarse en CUAAD, ni por el tema de una tesis. Tampoco se hereda el resultado de Artes Visuales V42: Artes Escénicas se audita de manera independiente.

## Evidencia institucional histórica

### 1. Identidad separada de la orientación

Control Escolar UdeG, *Catálogo de Carreras de Maestrías*:

- **Maestría en Didáctica de las Artes en el Área de Artes Escénicas — DGP 726502**;
- Artes Visuales — DGP 714513;
- Música — DGP 721506.

Fuente:
https://escolar.udg.mx/sites/default/files/adjuntos/claves_carrera_de_mstrias_2_0.pdf

Por tanto, Artes Escénicas es una identidad programática diferenciada. No se fusiona con Visuales, Música ni con la etiqueta genérica `Maestría en Didáctica de las Artes`.

### 2. Identidad de la maestría matriz

El *ProDES CUAAD 3.0* (2003), contemporáneo a las tesis observadas, registra:

- programa: **Maestría en Didáctica de las Artes**;
- área de conocimiento oficial conjunta: **Educación y Humanidades**;
- última actualización curricular: **2001**;
- cuatro semestres;
- 52% cursos básicos / 48% optativos;
- titulación mediante tesis.

Fuente:
https://cgpe.udg.mx/sites/default/files/prodes_cuaad_ica3.0_0.pdf

La etiqueta «Educación y Humanidades» es conjunta y **no equivale automáticamente a humanities-only**.

### 3. Evidencia específica de Artes Escénicas

En el mismo ProDES, el cuerpo académico **CA14 — Artes** incluye una LGAC:

**ARTES ESCÉNICAS**

descrita institucionalmente como teoría de la escena dramática y estudio/reflexión de procesos dramáticos en la construcción de la escena teatral, dancística y cinematográfica.

El mismo CA14 incluye además:

**PEDAGOGÍA**

definida como pedagogía de las artes, pedagogía aplicada a las artes y técnicas de la enseñanza artística.

Esta combinación es decisiva: la orientación tiene **contenido humanístico real** —teoría, reflexión de la escena, teatro y danza—, pero la identidad formativa del grado sigue siendo **Didáctica de las Artes**, con una estructura pedagógica aplicada a la enseñanza artística.

## Juicio editorial humanities-only

### Por qué no INCLUDE

El criterio del proyecto no es «¿hay objetos culturales o teoría del arte?», sino «¿la identidad programática pertenece primariamente a Humanidades?».

La maestría está institucionalmente configurada como didáctica/pedagogía aplicada. Esa identidad es comparable a otras autoridades educativas ya resueltas fuera del corpus principal. Admitirla por el contenido escénico convertiría el área temática en sustituto de la identidad académica.

### Por qué no mantener REVIEW

A diferencia de fronteras verdaderamente mixtas como Derechos Humanos o Cognición, aquí la evidencia histórica sí permite identificar la función principal del posgrado: formación en **didáctica de las artes**. La existencia de una LGAC humanística de Artes Escénicas no transforma el programa en Historia del Arte, Estética, Filosofía, Teoría cultural ni Estudios escénicos autónomos.

### Decisión

`EXCLUDE`

La decisión se aplica sólo a los aliases explícitos de Artes Escénicas registrados en la autoridad.

## Cohorte observada

Tres tesis RIUdeG / CUAAD:

1. `HACIA UNA TÉCNICA CORPORAL MEXICANA` — 2006 — handle 72967.
2. `ANÁLISIS DANCÍSTICO DEL JARABE DE JALISCO...` — 2006 — handle 72968.
3. `ONÉSIMO GONZÁLEZ Y EL NACIMIENTO DE LA DANZA CONTEMPORÁNEA EN GUADALAJARA` — 2005 — handle 72969.

Las tres tienen Metadata Confidence V5:

- `confidenceState = unassessed`;
- `authorityApplicability = allowed`;
- 0 blockers.

**Los títulos y resúmenes se documentan para identidad y auditoría, no para decidir admisión.**

Fuentes de registro:
- https://www.riudg.udg.mx/handle/20.500.12104/72967
- https://riudg.udg.mx/handle/20.500.12104/72968
- https://www.riudg.udg.mx/handle/20.500.12104/72969

## Program Authority V45

- registry: `2026-11-03.v45`;
- authority: `program:udg:mae-didactica-artes-escenicas-historica`;
- lifecycle: `historical`;
- discipline family: `educacion-pedagogia-artes-escenicas`;
- **3 REVIEW → EXCLUDE**;
- años: **2005–2006**;
- unidad: **CUAAD**.

## Límites de la decisión

No se alteran:

- Maestría en Didáctica de las Artes **genérica**;
- área de **Música**;
- Maestría en Artes;
- Teoría del Arte;
- Historia del Arte;
- Estudios Cinematográficos;
- Artes Visuales V42 (ya EXCLUDE por autoridad independiente);
- MCA Arte y Comunicación HOLD;
- DCTS, Cognición y Derechos Humanos en work-level review.

Scope Policy V5 y Metadata Confidence V5 permanecen sin cambios.

## Proyección a verificar en full CI

Base post-T2BR:

- 559 INCLUDE;
- 225 REVIEW;
- 18,971 QUARANTINE;
- 7,819 EXCLUDE;
- 2 REJECT_SOURCE.

V45 propuesta:

- **559 INCLUDE**;
- **222 REVIEW**;
- **18,971 QUARANTINE**;
- **7,822 EXCLUDE**;
- **2 REJECT_SOURCE**;
- total **27,576**.

Colas proyectadas:

- Humanities Action: **10/45 → 8/42**;
- Evidence HOLD: **5/13**;
- Humanities Ready: **5/32 → 3/29**;
- Work Review: **3/180**, sin cambio.

Estas cifras son hipótesis contractuales hasta que el workflow T2BS las reproduzca sobre el artifact congelado.
