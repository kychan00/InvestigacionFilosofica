# T2AG — CUCS / Psychology Program Metadata Contamination Audit V1

## Objetivo

Antes de crear cualquier `AcademicProgramAuthority` para:

`Licenciatura en Psicología`

se audita la integridad del metadata programático del full inventory.

La fase es deliberadamente **no admisiva**:

`decisionConstraint = audit-does-not-change-admission`

No crea:

`program:udg:lic-psicologia`

y no cambia ningún estado de admisión.

## Por qué se detuvo Program Authority V24

El full inventory congelado contiene **485** obras cuyo `programRaw` normaliza a:

`licenciatura en psicologia`

Sin embargo, el conjunto contiene contradicciones estructurales que impiden tratar 485 como un conteo curado de tesis de Psicología.

La propia historia oficial del CUCS establece que la Escuela de Psicología se fundó en **1975**:

- https://www.cucs.udg.mx/node/1837
- https://www.cucs.udg.mx/node/12383

Aun así, el inventario contiene registros etiquetados como Licenciatura en Psicología de:

- **1929**
- **1944**
- **1971**

Por definición, esos tres registros no pueden representar tesis de una carrera que todavía no existía.

## Hallazgo principal: la etiqueta ya viene de RIUdeG

La auditoría verificó:

- target works: **485**
- `dc.degree.name` de la fuente coincide con Psicología: **485/485**
- desacuerdos source/canonical: **0**

Por tanto, el parser canónico no está inventando el valor.

La contaminación existe ya en el metadata estructural de RIUdeG.

Ejemplos públicos:

- https://riudg.udg.mx/handle/20.500.12104/32367
  - *Puentes con Ganchos de una Pieza, Removibles*
  - RIUdeG publica `metadata.dc.degree.name = LICENCIATURA EN PSICOLOGÍA`
  - año: 1929 en el snapshot OAI

- https://riudg.udg.mx/handle/20.500.12104/33958
  - *Nueva Técnica para la Preparación del Plasma con la Válvula de Seguridad de Cutter*
  - RIUdeG publica `metadata.dc.degree.name = LICENCIATURA EN PSICOLOGÍA`
  - año: 1944 en el snapshot OAI

La colección CUCS tampoco es una colección exclusiva de Psicología:

https://riudg.udg.mx/handle/20.500.12104/20978

El full snapshot contiene en esa colección **2,253 registros** y al menos **16 claves normalizadas de grado/programa**.

Entre ellas:

- Licenciatura en Medicina — 1,383
- Licenciatura en Psicología — 455
- Licenciatura en Odontología — 195
- Médico Cirujano y Partero — 150
- Enfermería — 30

Por eso tampoco es válido inferir:

`colección CUCS ⇒ Psicología`

## Full audit congelado

Fuente:

- full artifact: `13099541204`
- full corpus: **27,576 works**
- canonical corpus SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`

### Universo observado

- works etiquetadas Psicología: **485**
- RIUdeG: **485**
- CUCS: **455**
- CUVALLES: **11**
- CUCIÉNEGA: **9**
- CUSUR: **7**
- CUCOSTA: **3**

Calidad de fechas:

- valid: **467**
- unknown: **16**
- suspicious: **1**
- invalid: **1**

Rango válido observado:

**1929–2025**

Ese rango **no** debe publicarse como rango académico de Psicología.

### Contradicciones estructurales

- pre-foundation (<1975): **3**
- exact same title bajo otro programa: **46**
- exact same title + same thesis author bajo otro programa: **8**
- narrow title-domain warnings: **44**

Clasificación conservadora del audit:

- high-confidence-anomaly: **11**
- warning-only: **66**
- no-detected-contradiction: **408**

Importante:

`no-detected-contradiction`

**no significa** “408 tesis confirmadas de Psicología”.

Sólo significa que estas pruebas estrechas no detectaron una contradicción estructural en esas obras.

## Por qué títulos sí aparecen en este audit

La regla general del proyecto permanece intacta:

**un título nunca decide admisión.**

T2AG usa ciertas señales de título exclusivamente como:

`anomaly evidence`

Por ejemplo, una etiqueta programática de Psicología combinada con terminología procedimental odontológica puede elevar una alerta de calidad.

Esa alerta:

- no cambia `admissionStatus`;
- no convierte la obra a EXCLUDE;
- no confirma otro programa;
- no crea una autoridad.

Los únicos indicadores llamados `high-confidence-anomaly` son:

1. imposibilidad temporal respecto a 1975;
2. conflicto exacto de título + mismo autor con otro programa.

## Implementación

Nuevo script:

`scripts/thesis/audit_program_metadata_contamination_v1.py`

Baseline full:

`scripts/thesis/config/psychology-metadata-contamination-baseline-v1.json`

Tests:

`tests/test_thesis_program_metadata_contamination_audit.py`

Artifact:

`artifacts/thesis-program-metadata-contamination/`

Salidas:

- `program-metadata-contamination-audit.json`
- `program-metadata-contamination-audit.md`

## Política resultante

La decisión para Psicología permanece:

`authorityDecision = hold`

No se crea V24.

Primero hay que separar:

- metadata confiable;
- metadata contradicho;
- metadata con warnings;
- casos todavía no verificables.

Sólo después se podrá investigar la identidad disciplinaria del programa y decidir:

INCLUDE / REVIEW / EXCLUDE.

## Invariantes que T2AG no modifica

Program Authority permanece:

`2026-11-01.v23`

Scope Policy permanece:

`2026-11-01.v2`

Boundary Closure V2 debe permanecer:

- 331 works
- 6 REVIEW
- closed
- 0 violations

T2T debe permanecer:

- 277 works
- 2 EXCLUDE
- closed
- 0 violations

T2Y debe permanecer:

- 212 works
- 4 EXCLUDE
- closed
- 0 violations

## Siguiente fase

Después de T2AG no debe asumirse automáticamente que sigue Program Authority V24.

Primero debe leerse el artifact y decidir si hace falta:

1. una política general de confianza de `dc.degree.name`;
2. una corrección del normalizador;
3. una excepción documentada para el bloque histórico CUCS;
4. verificación item-level adicional.

La prioridad es no convertir un error del repositorio fuente en una autoridad falsa dentro del corpus.
