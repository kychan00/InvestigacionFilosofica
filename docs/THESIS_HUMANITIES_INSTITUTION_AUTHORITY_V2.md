# Tesis Humanidades UdeG — Institution Authority V2

## Estado

**T2I — hardening de Institution Authority y de Program Curation Queue.**

Esta fase nace de la auditoría T2H.

No agrega programas humanísticos.

Corrige dos errores de clasificación institucional que afectaban el Admission
Gate y elimina grupos 100% externos de la cola de curaduría.

---

## 1. Problema detectado

T2H dejó como candidato residual:

`Doctorado en Antropología Social`

con una obra.

La revisión de la fuente mostró que no era un programa UdeG.

La tesis:

`El paisaje agavero: Expansión y estetizacion. Ecología Cultural Política y nuevas formas de creación de valor`

está en RIUdeG dentro de:

`Tesis externas`

y declara:

`dc.degree.grantor = El Colegio de Michoacán A.C.`

RIUdeG:

`https://www.riudg.udg.mx/handle/20.500.12104/34977`

El resolver V1 sólo marcaba como externa una cadena si contenía la palabra
`universidad`.

Por ello:

`El Colegio de Michoacán A.C.`

quedaba:

`unresolved institution`

y la obra permanecía en:

`QUARANTINE`

en lugar de:

`EXCLUDE / external-institution`.

---

## 2. Problema inverso

El full snapshot contiene dos tesis UdeG cuyo metadata trae un error tipográfico:

`dc.degree.grantor = Universidad en Guadalajara`

en lugar de:

`Universidad de Guadalajara`.

Handles:

- `20.500.12104/49659`;
- `20.500.12104/80475`.

Ambos ítems aparecen en la colección institucional:

`CUCS`

RIUdeG:

- `https://www.riudg.udg.mx/handle/20.500.12104/49659`;
- `https://www.riudg.udg.mx/handle/20.500.12104/80475`.

Institution Authority V1 interpretaba la cadena como una universidad externa,
porque no coincidía con los aliases UdeG y sí comenzaba por `universidad`.

Eso producía dos falsos:

`EXCLUDE / external-institution`.

---

## 3. Institution Authority V2

Nueva revisión:

`2026-11-01.v2`

Se mantiene:

`institution:udg`

como autoridad canónica de Universidad de Guadalajara.

### Nuevo alias UdeG exacto

`Universidad en Guadalajara`

se incorpora como alias exacto documentado.

No se agrega una regla fuzzy.

No se transforma cualquier cadena parecida en UdeG.

### Nuevo alias externo exacto

`El Colegio de Michoacán A.C.`

se incorpora a:

`institution.externalAliases`.

La resolución externa sigue siendo conservadora:

1. aliases UdeG exactos;
2. external aliases exactos;
3. regla histórica para cadenas explícitas `Universidad ...`;
4. de lo contrario, unresolved.

---

## 4. Protección contra colisiones

El loader valida que una misma forma normalizada no pueda estar a la vez en:

- aliases UdeG;
- externalAliases.

Una colisión aborta la carga del registry.

Esto impide que una corrección futura convierta accidentalmente la misma
institución en UdeG y externa.

---

## 5. Reproyección de Institution Authority en Coverage Audit

T2H inicialmente congelaba:

`institutionRef`

del canonical snapshot.

T2I conserva congelada la **evidencia cruda**:

`institutionRaw`

pero vuelve a resolverla con la Institution Authority vigente.

Esto permite aplicar mejoras de política institucional sobre un snapshot
inmutable sin volver a cosechar RIUdeG.

La auditoría sigue sin inferir institución desde:

- provider;
- colección;
- programRef;
- academicUnitRaw;
- tema de tesis.

Sólo cambia la interpretación de evidencia institucional ya presente.

---

## 6. Impacto full sobre 27,576 obras

Antes de T2I — T2H/V5:

- INCLUDE: 427;
- REVIEW: 211;
- QUARANTINE: 26,929;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Después de Institution Authority V2:

- INCLUDE: **427**;
- REVIEW: **211**;
- QUARANTINE: **26,930**;
- EXCLUDE: **6**;
- REJECT_SOURCE: **2**.

### Movimiento

`El Colegio de Michoacán A.C.`

- QUARANTINE → EXCLUDE: 1.

`Universidad en Guadalajara`

- EXCLUDE → QUARANTINE: 2.

El neto:

- +1 QUARANTINE;
- -1 EXCLUDE.

Las dos tesis CUCS no pasan a INCLUDE porque sus programas:

- Licenciatura en Medicina;
- Licenciatura en Odontología;

no son autoridades humanísticas curadas.

La corrección institucional no decide disciplina.

---

## 7. Program Curation Queue — nuevo gate

T2H mostró que la cola seguía incluyendo programas cuyo 100% de obras eran
externas.

T2I agrega una regla:

**si un grupo de programa no contiene ninguna obra gate-eligible, se omite de
la cola de curaduría.**

Gate-ineligible para este filtro:

- EXCLUDE;
- REJECT_SOURCE.

No se omiten:

- QUARANTINE;
- REVIEW;
- INCLUDE.

Esto preserva incertidumbre legítima y elimina ruido externo.

---

## 8. Grupos externos eliminados de la cola full

Tres grupos quedan fuera:

### Maestría en diseño gráfico

- 2 obras;
- institución: Universidad Iberoamericana;
- 100% EXCLUDE.

### Maestría en docencia e investigación

- 1 obra;
- institución: Universidad Santander;
- 100% EXCLUDE.

### Doctorado en Antropología Social

- 1 obra;
- institución: El Colegio de Michoacán A.C.;
- 100% EXCLUDE después de V2.

Total:

- grupos omitidos: **3**;
- obras omitidas de la cola: **4**.

---

## 9. Program Curation Queue después de T2I

Antes:

- queue items: 673;
- works represented: 27,005;
- scope-review: 40;
- humanities-candidate: 3;
- unit-triage: 96;
- high-impact-triage: 91;
- backlog: 443;
- bands A/B/C/D: 40 / 7 / 116 / 510.

Después:

- queue items: **670**;
- works represented: **27,001**;
- scope-review: 40;
- humanities-candidate: **2**;
- unit-triage: 96;
- high-impact-triage: 91;
- backlog: **441**;
- bands A/B/C/D: **40 / 7 / 116 / 507**;
- gate-ineligible groups omitted: **3**;
- gate-ineligible works omitted: **4**.

---

## 10. Residuo humanities-candidate real

Después de T2I ya no aparece:

`Doctorado en Antropología Social`

porque era un falso candidato originado por una tesis externa.

Quedan:

### Licenciatura en Cultura Física y Deportes

- 11 obras;
- señal lexical: `cultura`;
- falso positivo esperado;
- no se admite.

### Maestría en Teoría del Arte

- 1 obra;
- CUAAD;
- institución UdeG confirmada;
- candidato real para la siguiente revisión.

Por tanto la próxima fase programática debe estudiar:

`Maestría en Teoría del Arte`

sin mezclarla con el bug institucional ya corregido.

---

## 11. Nuevos campos de versión

El canonical corpus conserva:

`programAuthorityRevision`

y agrega:

`institutionAuthorityRevision`

Para esta fase:

- programAuthorityRevision: `2026-11-01.v5`;
- institutionAuthorityRevision: `2026-11-01.v2`.

Program Authority e Institution Authority evolucionan de forma independiente.

---

## 12. Tests

La suite cubre:

- `Universidad en Guadalajara` → institution:udg;
- la tesis sigue QUARANTINE si el programa no está curado;
- `El Colegio de Michoacán A.C.` → external;
- external institution → EXCLUDE;
- colisión UdeG/external alias → error;
- Coverage Audit reproyecta Institution Authority vigente;
- un grupo 100% EXCLUDE se omite de Program Curation Queue;
- un grupo mixto con al menos una obra gate-eligible permanece en la cola;
- corpus y audit pinnean institutionAuthorityRevision.

---

## 13. Principio

La pertenencia institucional y la pertenencia disciplinaria son dos decisiones
ortogonales.

Corregir:

`El Colegio de Michoacán → external`

no dice nada sobre si Antropología es Humanidades.

Corregir:

`Universidad en Guadalajara → UdeG`

no dice nada sobre si Medicina u Odontología pertenecen al corpus.

El Admission Gate debe conservar ambas pruebas separadas.

---

## 14. Siguiente fase

Después de T2I:

**T2J — Historical Art Theory Family V1**

Candidato principal:

- Maestría en Teoría del Arte.

La evidencia preliminar ya confirma:

- tesis UdeG;
- colección CUAAD;
- Control Escolar registra una
  `Maestría en Artes opción Terminal en Teoría del Arte`
  con clave DGP 730505.

La decisión INCLUDE/REVIEW deberá establecerse con evidencia institucional de
lineage y con la misma política de frontera Arte–Humanidades utilizada en T2G.
