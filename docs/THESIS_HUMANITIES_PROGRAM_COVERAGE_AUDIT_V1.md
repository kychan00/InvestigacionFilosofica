# Tesis Humanidades UdeG — Program Coverage Audit V1

## Estado

**T2H — auditoría de cobertura posterior a AcademicProgramAuthority V5.**

Esta fase no agrega programas ni modifica admisión.

Su objetivo es responder, sobre el inventario full congelado:

1. ¿cuántas obras resuelve la registry vigente?;
2. ¿cuántas pasan realmente el Humanities Admission Gate?;
3. ¿qué autoridades REVIEW concentran más tesis?;
4. ¿qué grupos siguen en QUARANTINE?;
5. ¿qué debe revisarse después de V5?

---

## 1. Snapshot auditado

Inventario completo:

- SourceRecord / works: **27,576**;
- RIUdeG activos: 27,429;
- RIUdeG tombstones: 2;
- UDGVirtual: 147/147;
- grupos normalizados de programa: **701**.

Artifact original:

- ID: `13099541204`;
- nombre: `thesis-full-inventory-20261101`;
- artifact digest:
  `95c0a4241135fe63e8e87474af54aabdd495e1c583a6b6ec4e08409878a7fab8`;
- canonical corpus SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`;
- source records SHA-256:
  `5dfc258db253bfd3ad88791b5ade4611d761785ba1b14dbfd4f8bea20eea2116`;
- observed authorities SHA-256:
  `72b6745ae7f74890447e1c70b07763d385ac6bfebdd89a6dff08c5c6a4de3949`.

Registry auditada:

`2026-11-01.v5`

---

## 2. Qué significa “reprojectar”

El full inventory fue construido antes de V2–V5 y antes del fix de fechas
sentinela.

T2H **no vuelve a cosechar** RIUdeG ni UDGVirtual.

Conserva como frozen evidence:

- source type;
- institución;
- SourceRecord;
- identidad de obra;
- provenance.

Y vuelve a calcular:

- resolución de AcademicProgramAuthority;
- estado de admisión dependiente del programa;
- calidad de fecha con el normalizador vigente;
- Program Curation Queue.

La institución no se infiere desde el programa.

La pertenencia a una colección del provider tampoco sustituye evidencia de
institución otorgante.

---

## 3. Hallazgo principal: program match ≠ admission

V5 resuelve **431 obras** a autoridades cuyo estado es `INCLUDE`.

Pero el Humanities Admission Gate admite realmente:

**427**

La diferencia son **4 obras**.

Por tanto deben distinguirse dos métricas:

### Program-state coverage

Cuántas obras tienen un programa que resuelve a una autoridad INCLUDE.

V5:

**431**

### Gate admission

Cuántas obras además tienen institución UdeG confirmada y superan el gate.

V5:

**427**

No son equivalentes.

---

## 4. Los cuatro gate blockers

Los cuatro casos corresponden a:

`Maestría en Gestión de la Cultura`

en UDGVirtual.

Handles:

- `123456789/3996`;
- `123456789/4044`;
- `123456789/4045`;
- `123456789/4046`.

Los registros contienen:

- grado explícito: Maestría en Gestión de la Cultura;
- `DC.relation = UDGVirtual`;
- subjects de Publicaciones UDGVirtual.

Pero no contienen una institución/grantor explícito que el parser pueda
confirmar independientemente.

La colección UDGVirtual es heterogénea y contiene tesis de otras universidades.

Por eso la decisión correcta permanece:

`QUARANTINE / unresolved-institution`

aunque:

`programAdmissionState = INCLUDE`

Este comportamiento protege el principio:

**un programa confirmado no puede fabricar evidencia institucional.**

---

## 5. Admission Gate V5 — resultado real

Sobre las 27,576 obras:

- INCLUDE: **427**;
- REVIEW: **211**;
- QUARANTINE: **26,929**;
- EXCLUDE: **7**;
- REJECT_SOURCE: **2**.

Total:

27,576.

La proyección previa de T2G:

- INCLUDE 431;
- REVIEW 211;
- QUARANTINE 26,925;

era correcta como conteo de **program-state coverage**, pero no como resultado
completo del Admission Gate.

T2H corrige explícitamente esa nomenclatura.

---

## 6. Baseline V4 — misma distinción

La misma diferencia ya existía en T2F.

Con V4:

### Program-state coverage

- INCLUDE-program matches: **416**;
- REVIEW-program matches: **44**.

### Admission Gate real

- INCLUDE: **412**;
- REVIEW: **44**;
- QUARANTINE: **27,111**;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Los mismos 4 registros UDGVirtual explican la diferencia.

---

## 7. Calidad temporal después del fix epoch

El snapshot original clasificaba:

- valid: 27,053;
- suspicious: 115;
- invalid: 15;
- unknown: 393.

T2H vuelve a ejecutar el normalizador de fecha vigente.

Se detectan:

**561**

valores sentinela:

- `1969-12-31`;
- `31/12/1969`.

Resultado vigente:

- valid: **26,492**;
- suspicious: **676**;
- invalid: **15**;
- unknown: **393**.

No se inventa una fecha sustituta.

---

## 8. Cobertura de AcademicProgramAuthority V5

Registry:

- autoridades: **45**;
- INCLUDE: 34;
- REVIEW: 11.

Autoridades con al menos una observación en el snapshot:

- **36 / 45**.

Desglose observado:

- autoridades INCLUDE observadas: **26**;
- autoridades REVIEW observadas: **10**.

Nueve autoridades registradas no tienen todavía una tesis observada con alias
exacto en este snapshot.

Esto es válido: algunas autoridades se agregaron anticipadamente para futuras
cosechas.

---

## 9. Cobertura por grupos de programa

El inventario contiene:

**701**

grupos normalizados.

Con V5:

- resolved: **28 grupos**;
- review: **40 grupos**;
- unresolved: **633 grupos**.

Los 40 grupos REVIEW corresponden a 10 autoridades observadas; una misma
autoridad puede agrupar muchos strings históricos.

Ejemplo principal:

`program:udg:mae-ciencias-arquitectura`

absorbe variantes institucionalmente documentadas de sus orientaciones sin
convertirlas en programas separados.

---

## 10. Obras por estado de programa

Entre las **27,436 obras que sí contienen programa crudo**:

- grupos resueltos a autoridades INCLUDE: **431 obras**;
- grupos resueltos a autoridades REVIEW: **211 obras**;
- programa unresolved: **26,794 obras**.

Las 140 obras restantes no tienen programa crudo suficiente.

De nuevo:

431 program matches INCLUDE ≠ 427 admission INCLUDE.

---

## 11. Program Curation Queue V5

Recalculada con:

- registry V5;
- fechas vigentes;
- admission statuses reproyectados.

Resultado:

- queue items: **673**;
- works represented: **27,005**.

Program states:

- unresolved: 633 grupos;
- review: 40 grupos;
- resolved y omitidos por defecto: 28 grupos.

Carriles:

- scope-review: **40**;
- humanities-candidate: **3**;
- unit-triage: **96**;
- high-impact-triage: **91**;
- backlog: **443**.

Bandas:

- A: **40**;
- B: **7**;
- C: **116**;
- D: **510**.

---

## 12. El carril humanities-candidate ya es pequeño

Sólo quedan tres grupos en el carril lexical:

### 1. Licenciatura en Cultura Física y Deportes

- 11 tesis;
- señal: `cultura`;
- unidades principales: CUCOSTA / CUCS.

Este es un **falso positivo lexical esperado**.

La señal sirve para priorizar revisión; no implica Humanidades.

### 2. Doctorado en Antropología Social

- 1 tesis;
- señal: `antropologia`.

Este sí es un candidato humanístico fuerte para una siguiente familia.

### 3. Maestría en Teoría del Arte

- 1 tesis;
- señal: `arte`;
- unidad: CUAAD.

También es candidato claro para evidencia institucional.

---

## 13. El siguiente problema está en unit-triage

Muchos grupos relevantes ya no contienen una palabra de la lista lexical, pero
aparecen en unidades prioritarias.

Entre los primeros:

- Maestría en Derecho — 296;
- Doctorado en Ciencias Sociales — 217;
- Licenciatura en Derecho — 150;
- Maestría en Comunicación — 67;
- Maestría en Gestión y Desarrollo Social — 106;
- Doctorado en Educación — 73;
- Maestría en Ciencias Sociales — 60;
- Maestría en Ciencia Política — 51;
- Licenciatura en Relaciones Internacionales — 48;
- Doctorado en Ciudad, Territorio y Sustentabilidad — 152;
- Maestría en Investigación Educativa — 34;
- Licenciatura en Arquitectura — 121;
- Maestría en Didáctica de las Artes — 39.

Esto demuestra por qué:

**CUCSH o CUAAD no pueden usarse como sinónimo de Humanidades.**

Derecho, política, ciencias sociales, educación, comunicación y arquitectura
requieren decisiones de alcance independientes.

---

## 14. REVIEW V5 por autoridad

Principales autoridades REVIEW observadas:

- Maestría en Ciencias de la Arquitectura — **112**;
- Maestría en Gestión y Desarrollo Cultural — **40**;
- Maestría en Educación y Expresión para las Artes — **27**;
- Didáctica de las Artes / Artes Visuales — **16**;
- Conservación del Patrimonio Edificado standalone — **5**;
- Historia de la Arquitectura Mexicana standalone — **4**;
- Didáctica de las Artes / Artes Escénicas — **3**;
- Licenciatura en Historia del Arte — **2**;
- Doctorado en Estudios Literarios y Lingüísticos, orientación Lingüística
  Aplicada — **1**;
- Licenciatura en la Docencia del Inglés — **1**.

El estado REVIEW sigue siendo una decisión de gobernanza, no un error.

---

## 15. Qué corrige T2H en la documentación previa

T2F/T2G utilizaron “INCLUDE” para dos magnitudes diferentes:

1. obras cuyo programa resuelve a una autoridad INCLUDE;
2. obras que finalmente pasan el Admission Gate.

T2H fija los nombres:

- **program-state coverage**;
- **gate admission**.

Las cifras correctas quedan documentadas sin alterar decisiones de programa.

---

## 16. Implementación

Nuevo auditor:

`scripts/thesis/audit_program_coverage_v1.py`

Entradas:

- observed-authorities.json;
- canonical-corpus.json.gz;
- AcademicProgramAuthority vigente.

Salidas:

- `program-coverage-audit.json`;
- `program-coverage-audit.md`.

El auditor:

1. conserva source/institution evidence del snapshot;
2. reproyecta programa;
3. reproyecta Admission Gate;
4. recalcula calidad de fecha;
5. reconstruye Program Curation Queue;
6. reporta gate blockers;
7. agrega REVIEW por autoridad;
8. publica top unresolved.

---

## 17. Regla de seguridad epistemológica

T2H no permite estas inferencias:

- provider UDGVirtual → institución UdeG;
- CUCSH → Humanidades;
- CUAAD → no Humanidades;
- palabra “cultura” → Humanidades;
- programa INCLUDE → obra INCLUDE sin institución;
- score alto → admisión.

La auditoría sólo hace visible el estado actual.

---

## 18. Siguiente fase recomendada

Después de fusionar T2H, el siguiente bloque no debe elegirse por frecuencia
bruta.

La opción de menor riesgo es una **Residual Humanities Family V1** centrada
primero en candidatos de alta confianza:

- Doctorado en Antropología Social;
- Maestría en Teoría del Arte;

y después decidir explícitamente si el proyecto quiere incluir alguna franja de:

- Comunicación;
- Educación;
- estudios sociales;
- política;
- relaciones internacionales.

Ese límite debe resolverse como política de alcance, no por heurística.
