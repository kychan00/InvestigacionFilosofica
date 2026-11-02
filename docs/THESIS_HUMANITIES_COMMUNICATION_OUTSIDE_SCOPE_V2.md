# T2AW — Maestría en Comunicación · Outside-Scope Resolution V2 / Program Authority V29

## Estado

**Decisión final de alcance programático: EXCLUDE.**

Target:

`humanities-only`

Programa:

`program:udg:mae-comunicacion`

Canonical name:

`Maestría en Comunicación`

Unidad:

`CUCSH`

Obras observadas:

**67 tesis**

Años:

**2002–2021**

---

## 1. Qué cambia respecto a V7

La revisión V7 dejó este programa en:

`REVIEW`

porque coexistían señales humanísticas y de ciencias sociales.

La evidencia institucional vigente de la convocatoria 2026 permite resolver esa
incertidumbre sin clasificar tesis por título, abstract, keywords o tema.

La convocatoria oficial 2026 define el programa como:

- posgrado para investigación en procesos comunicativos contemporáneos;
- interdisciplinario;
- integrado por enfoques teóricos y metodológicos de las **ciencias sociales**.

Además, su objetivo institucional declara explícitamente investigación en:

- **Ciencias Sociales**;
- **Ciencias de la Comunicación**.

Fuentes:

- https://www.cucsh.udg.mx/sites/default/files/2025-09/CONVOCATORIA%202026%202028%20MAESTR%C3%8DA%20EN%20COMUNICACI%C3%93N_1.pdf
- https://www.cucsh.udg.mx/maestrias/maestria_en_comunicacion/objetivos
- https://www.cucsh.udg.mx/maestrias/maestria-en-comunicacion

---

## 2. Por qué EXCLUDE bajo humanities-only

La decisión no afirma que Comunicación carezca de dimensiones humanísticas.

El programa conserva líneas sobre:

- producción simbólica;
- cultura;
- historia;
- discurso;
- visualidad;
- identidad;
- ética;
- memoria.

Pero la autoridad de programa debe responder a la **identidad disciplinaria
institucional del posgrado completo**, no a subtemas de tesis individuales.

La evidencia vigente sitúa la identidad principal del programa en el campo de la
Comunicación, con fundamentos explícitos de Ciencias Sociales y Ciencias de la
Comunicación.

Bajo un corpus estrictamente:

`humanities-only`

la decisión correcta es:

`EXCLUDE`

---

## 3. Por qué CUCSH no cambia la decisión

El nombre:

`Centro Universitario de Ciencias Sociales y Humanidades`

no implica que todos sus programas sean Humanidades.

La propia Scope Boundary Matrix establece precedencia:

1. AcademicProgramAuthority explícita;
2. evidencia institucional específica del programa;
3. departamento/división;
4. centro universitario;
5. señales lexicales o temáticas.

En este caso la evidencia específica del programa vence al prior organizacional
de la División de Estudios de la Cultura.

---

## 4. Impacto esperado

Baseline V28:

- INCLUDE: 428
- REVIEW: 832
- QUARANTINE: 18,964
- EXCLUDE: 7,350
- REJECT_SOURCE: 2

Movimiento V29:

`REVIEW → EXCLUDE: 67`

Resultado esperado:

- INCLUDE: **428**
- REVIEW: **765**
- QUARANTINE: **18,964**
- EXCLUDE: **7,417**
- REJECT_SOURCE: **2**

Total:

**27,576**

Las 67 tesis permanecen preservadas en el inventario y fuente de origen. EXCLUDE
significa únicamente que no forman parte del corpus público de Humanidades.

---

## 5. Scope Boundary Matrix V3

La fila:

`scope:communication-culture`

cambia de:

`boundary-review`

a:

`outside-scope`

La decisión deja de estar abierta.

---

## 6. Guardrails

Esta fase no permite:

- clasificar por título;
- clasificar por abstract;
- clasificar por embeddings;
- inferir pertenencia a Humanidades por CUCSH;
- convertir una línea cultural específica en inclusión del programa entero;
- afectar otras autoridades humanísticas.

Metadata Confidence permanece:

`2026-11-02.v4`

---

## 7. Validación

El workflow V29 debe comprobar sobre el frozen full corpus:

- exactamente 67 obras de Maestría en Comunicación;
- 0 registros bloqueados por Metadata Confidence;
- 67 obras con `programRef=program:udg:mae-comunicacion`;
- 67 obras EXCLUDE;
- ausencia del programa en Program Curation Queue;
- Scope Boundary Matrix V3 = outside-scope;
- proyección global exacta 27,576.
