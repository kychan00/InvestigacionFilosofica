# T2AS — Ingeniero Agrónomo · Partial Program Authority V27

## Objetivo

T2AS convierte la evidencia de lineage congelada en T2AR en una autoridad programática parcial y explícita.

La regla de esta fase es:

`authority only where evidence supports it`

No se intenta resolver los 64 labels agronómicos observados.

## Estado de entrada

T2AR cerró la familia observada en:

- **64 labels**
- **2,493 works**
- **5 structural conflict pairs**

y la dividió en:

### Candidate V27

- **16 labels**
- **2,155 works**

### HOLD

- **48 labels**
- **338 works**

T2AS sólo promueve el conjunto Candidate V27.

## Autoridad

ID:

`program:udg:ingeniero-agronomo`

Canonical name:

`Ingeniero Agrónomo`

Level:

`licenciatura`

Discipline family:

`agronomia-ciencias-biologico-agropecuarias`

Admission:

`EXCLUDE`

Academic units:

- CUCBA
- CUCSUR

Registry revision:

`2026-11-02.v27`

## Razón de scope

CUCBA publica actualmente el programa **Ingeniero Agrónomo**.

El Sistema Institucional de Estadísticas usa el código:

`5081300016`

para Ingeniero Agrónomo en CUCBA y CUCSUR.

La identidad disciplinaria institucional corresponde a Ciencias Biológico Agropecuarias y a formación en producción agrícola, pecuaria y forestal, transferencia tecnológica y manejo de recursos.

Bajo `targetScope = humanities-only`:

`Ingeniero Agrónomo → EXCLUDE`

El título o tema de una tesis nunca puede revertir esta decisión.

## Lineage histórico que sí entra a V27

La autoridad usa exclusivamente los 16 labels exactos clasificados por T2AR como `candidate-v27`.

Las clases de evidencia son:

1. `core-confirmed`
2. `historical-terminal-exact-confirmed`
3. `profile-lineage-supported`

El puente institucional combina:

- programa vigente CUCBA;
- SIE;
- Estatuto Orgánico histórico de CUCBA;
- Segundo Informe de Actividades UdeG 1996–1997;
- dictamen CGU I/2000/738;
- historia del Departamento de Producción Forestal;
- documentación docente forestal vigente.

El dictamen I/2000/738 es el puente central: modifica el plan de **Ingeniero Agrónomo** y ubica los perfiles Fitotecnista, Zootecnista, Forestal y Administrador de Empresas Agropecuarias dentro de una estructura básica común.

## Lo que deliberadamente NO entra

Los 48 labels HOLD continúan fuera de V27.

Incluyen:

- Suelos;
- Extensionista;
- Ganadería;
- Extensión Agrícola;
- Agrícola;
- Extensión Pecuaria;
- Fruticultura/Horticultura;
- `Ingeniería en Agronomía`;
- typos y formas sin espacios;
- orientaciones compuestas.

Total:

- **48 labels**
- **338 works**

No se usan:

- regex como alias;
- fuzzy matching;
- semejanza lexical;
- tema de tesis;
- título;
- inferencia por centro;
- composición de orientaciones.

## Metadata Confidence V4

T2AQ protegió 10 records de Agronomy involucrados en cinco structural conflict pairs.

La matriz T2AR distribuyó esos pares como:

- candidate ↔ candidate: **2**
- candidate ↔ HOLD: **2**
- HOLD ↔ HOLD: **1**

Por tanto, dentro de los 2,155 Candidate V27 existen exactamente:

- **6 candidate records blocked**
- **2,149 candidate records allowed**

V27 respeta el veto item-level:

`EXCLUDE + blocked → QUARANTINE`

`EXCLUDE + allowed → EXCLUDE`

Los seis blocked candidate records no son “corregidos” por la autoridad.

## Full frozen projection

Contrato esperado sobre las 27,576 works:

### V27 candidate

- observed: **2,155**
- blocked: **6**
- authority applicable: **2,149**
- EXCLUDE: **2,149**
- QUARANTINE: **6**

### HOLD

- groups: **48**
- works: **338**
- programRef V27: **0**
- QUARANTINE: **338**

Dentro de HOLD existen 4 source records protegidos por structural conflicts, pero el grupo ya permanece QUARANTINE por programa unresolved.

## Global projected admission

La reproyección full esperada después de V27 es:

- INCLUDE: **428**
- REVIEW: **832**
- QUARANTINE: **20,161**
- EXCLUDE: **6,153**
- REJECT_SOURCE: **2**

Total:

**27,576**

Estas cifras son contrato de CI y deben validarse contra el artifact full congelado, no contra samples.

## Queue

Los candidate groups sin blocked records deben desaparecer de la Queue.

Los candidate groups que contienen blocked records pueden permanecer en:

- `queueState = metadata-review`
- `curationLane = metadata-confidence-review`

porque la autoridad existe, pero algunos items no pueden recibirla.

Todos los labels HOLD deben seguir presentes en la Queue y con `authority = null`.

## Fuentes institucionales

- https://cucba.udg.mx/oferta-academica/licenciaturas/ingeniero-agronomo
- https://sie.udg.mx/listados/matricula
- https://cucba.udg.mx/sites/default/files/pdf/EstatutoOrganicodelCentroUniversitariodeCienciasBiol.pdf
- https://cgpe.udg.mx/sites/default/files/adjuntos/2_informe_1996-1997.pdf
- https://cucsur.udg.mx/sites/default/files/adjuntos/dictamen-agronomia.pdf
- https://cucba.udg.mx/documento/historia-dpf
- https://cucba.udg.mx/documento/docencia-dpf

## Invariantes

T2AS exige:

- sólo 16 labels resuelven a V27;
- los 338 HOLD no se absorben;
- Metadata Confidence V4 permanece intacta;
- los 6 candidate blocked permanecen QUARANTINE;
- V25 Medicine sigue estable;
- V26 Veterinary sigue estable;
- Boundary Closure V2 sigue cerrada;
- T2T sigue cerrado;
- T2Y sigue cerrado.

El objetivo no es minimizar QUARANTINE.

El objetivo es reducirla únicamente donde la identidad institucional está defendida.
