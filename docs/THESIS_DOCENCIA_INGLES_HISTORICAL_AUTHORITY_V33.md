# T2BA — Licenciatura en la Docencia del Inglés · Program Authority V33

## Decisión

T2BA resuelve la autoridad histórica:

`program:udg:lic-docencia-ingles-corta-historica`

de `REVIEW` a `INCLUDE` bajo el alcance `humanities-only`.

La decisión **no** fusiona esta autoridad con la Licenciatura en Docencia del Inglés como Lengua Extranjera vigente y tampoco la fusiona con la modalidad semiescolarizada. Se conserva:

- `lifecycleState = historical`;
- `possibleSuccessorRef = program:udg:lic-docencia-ingles`;
- el alias histórico exacto como único alias de esta autoridad.

La continuidad institucional se registra como lineage, no como equivalencia plana de planes.

## Registro observado

El corpus full congelado contiene una observación con el nombre exacto:

`LICENCIATURA EN LA DOCENCIA DEL INGLÉS`

Datos del registro:

- proveedor: RIUdeG;
- handle: `20.500.12104/34245`;
- unidad: CUCSH;
- tipo: Tesis de Licenciatura;
- año: 2006;
- `dc.degree.creator`: `LICENCIADA EN LA DOCENCIA DEL INGLÉS`;
- Metadata Confidence: `unassessed / allowed`;
- structural conflicts: 0 para esta observación;
- blocked works: 0.

La decisión no se basa en el título de la tesis.

## Evidencia institucional

### 1. Nombre histórico exacto

La Enciclopedia Histórica de la Universidad de Guadalajara documenta que, en sesión del H. Consejo General Universitario del 11 de septiembre de 1987, se estableció la:

> Licenciatura en la Docencia del Inglés

Fuente:

https://enciclopedia.udg.mx/capitulos/desarrollo-historico-1975-1989

Esto elimina el principal motivo del REVIEW anterior: el nombre corto observado no es una inferencia lexical ni una abreviatura inventada por RIUdeG; está atestiguado institucionalmente.

### 2. Persistencia del nombre en documentación UdeG

El Cuarto Informe de Actividades 1998–1999 de la Universidad vuelve a registrar la denominación `Licenciatura en la Docencia del Inglés`, al mismo tiempo que otras tablas institucionales usan formas más desarrolladas del nombre.

Fuente:

https://cgpe.udg.mx/sites/default/files/adjuntos/4_informe_1998-1999.pdf

### 3. Desarrollo posterior del programa

La documentación PIFI del CUCSH identifica la `LICENCIATURA EN DOCENCIA DEL INGLÉS COMO LENGUA EXTRANJERA` en el Departamento de Lenguas Modernas. También describe una orientación crítica, investigativa, reflexiva, autodirigida y humanística, con objetivos relacionados con lingüística y educación.

Fuente:

https://cgpe.udg.mx/sites/default/files/cucsh.pdf

La oferta vigente conserva:

`Licenciatura en Docencia del Inglés como Lengua Extranjera`

y su propia presentación utiliza la construcción `la Docencia del Inglés como Lengua Extranjera`.

Fuente:

https://www.cucsh.udg.mx/licenciaturas/licenciatura-en-docencia-del-ingles-como-lengua-extranjera

## Por qué INCLUDE

La evidencia programática específica ubica la autoridad histórica en el campo de lenguas y formación humanística. Esto supera cualquier prior organizacional del CUCSH y evita decidir por título, keywords o mera pertenencia al centro.

T2BA no necesita afirmar que el plan de 1987, el plan observado en 2006 y el plan vigente sean idénticos en todos sus detalles. Para la admisión humanities-only basta con establecer de forma independiente:

1. que el nombre histórico exacto corresponde a un programa real de la UdeG;
2. que su identidad disciplinaria pertenece a lenguas;
3. que la documentación institucional posterior mantiene una línea de formación en docencia del inglés dentro de Lenguas Modernas;
4. que no existe un blocker de Metadata Confidence para la única tesis observada.

## Guardrails de lineage

T2BA mantiene tres autoridades distintas:

1. `program:udg:lic-docencia-ingles-corta-historica`
   - histórica;
   - INCLUDE;
   - nombre exacto observado: `Licenciatura en la Docencia del Inglés`.

2. `program:udg:lic-docencia-ingles`
   - programa de Docencia del Inglés como Lengua Extranjera;
   - INCLUDE;
   - se conserva como `possibleSuccessorRef` de la autoridad histórica.

3. `program:udg:lic-docencia-ingles-semi`
   - modalidad semiescolarizada, abierta y a distancia;
   - INCLUDE;
   - permanece separada.

No se agrega el nombre histórico corto a los aliases del programa vigente.

## Impacto full esperado

Corpus congelado:

27,576 works.

Movimiento T2BA:

- REVIEW → INCLUDE: 1;
- blocked: 0.

Proyección V33 esperada:

- INCLUDE: 434;
- REVIEW: 686;
- QUARANTINE: 18,964;
- EXCLUDE: 7,490;
- REJECT_SOURCE: 2.

Total:

27,576.

Humanities Action Queue esperada:

- 43 items;
- 686 works;
- `licenciatura en la docencia del ingles` deja de ser actionable;
- siguiente acción: `maestria en gestion y desarrollo cultural` — 40 works.

Estos números deben validarse sobre el artifact full antes de considerarse contrato cerrado.

## Invariantes

- Metadata Confidence permanece V4.
- Scope Policy permanece V4.
- El target histórico no se convierte en alias fuzzy.
- La autoridad vigente no absorbe el registro histórico.
- La modalidad semiescolarizada permanece separada.
- Los baselines V25–V32 permanecen históricamente válidos.
- Los cierres de scope anteriores deben seguir verdes.
