# Tesis Humanidades UdeG — Program Curation Queue V1

## Estado

**T2D — cola determinista de curaduría humana.**

Esta fase toma el inventario completo de tesis y la revisión vigente de
`AcademicProgramAuthority`, y genera una cola reproducible para decidir qué
programas investigar después.

La cola **no decide admisión**.

---

## 1. Problema

El primer inventario completo observó:

- 27,576 trabajos canónicos;
- 27,436 trabajos con nombre de programa;
- 701 nombres normalizados de programa;
- 30 autoridades en Program Authority V2, algunas todavía sin tesis observada.

Revisar los 701 strings linealmente es ineficiente y además sesga la curaduría
hacia programas frecuentes que pueden estar claramente fuera de Humanidades.

Ejemplo:

- Maestría en Derecho: 296 trabajos;
- Maestría en la Enseñanza de la Lengua y Literatura: 2 trabajos.

Ordenar únicamente por frecuencia pondría Derecho por encima de un candidato
directamente relacionado con lengua/literatura.

T2D separa **impacto de curaduría** de **decisión de admisión**.

---

## 2. Entrada

La cola consume tres artefactos.

### 2.1 Observed Authorities

`observed-authorities.json`

Aporta por nombre normalizado:

- variantes crudas;
- frecuencia;
- proveedores;
- estados observados;
- programRef actuales.

### 2.2 Canonical Corpus

`canonical-corpus.json.gz`

Aporta:

- unidades académicas observadas;
- años válidos;
- tipo documental;
- estado canónico actual.

### 2.3 AcademicProgramAuthority

`scripts/thesis/config/program-authority-v1.json`

Aporta:

- aliases;
- autoridad ya resuelta;
- admissionState;
- lifecycle;
- posibles sucesores;
- evidencia.

La cola registra la revisión:

`2026-11-01.v2`

---

## 3. Salidas

El script:

`scripts/thesis/build_program_curation_queue_v1.py`

produce:

- `program-curation-queue.json`;
- `program-curation-queue.csv`;
- `program-curation-queue.md`.

JSON es la salida canónica.

CSV facilita auditoría manual.

Markdown produce un resumen legible de los primeros candidatos.

---

## 4. Regla fundamental

Cada item contiene:

`decisionConstraint = priority-does-not-change-admission`

La puntuación, el carril, la frecuencia, CUCSH, una palabra como
“filosofía” o cualquier otra señal **no puede**:

- crear una autoridad;
- cambiar QUARANTINE a INCLUDE;
- fusionar programas;
- resolver lineage;
- decidir que un programa es humanístico.

Es únicamente un sistema de ordenación de trabajo humano.

---

## 5. Estados de cola

### unresolved

El nombre observado todavía no resuelve a una autoridad de programa.

### review

El programa ya tiene autoridad, pero su alcance o lineage necesita decisión
explícita.

### resolved

Programa ya resuelto a una autoridad INCLUDE/EXCLUDE.

Por defecto los `resolved` no aparecen en la cola.

Se pueden incluir para auditoría con:

`--include-resolved`

---

## 6. Carriles de curaduría

La cola no es una sola lista por score.

### 6.1 scope-review

Primero.

Contiene autoridades ya identificadas con:

`admissionState=review`

Son decisiones conocidas y acotadas.

### 6.2 humanities-candidate

Segundo.

Programa no resuelto cuyo nombre contiene señales completas de posible
interés humanístico.

Ejemplos de señales:

- filosofía;
- humanidades;
- historia;
- literatura;
- letras;
- lingüística;
- antropología;
- geografía;
- bioética;
- lengua;
- escritura;
- patrimonio;
- arte;
- cultura;
- arqueología;
- etnografía.

Estas señales sirven sólo para ordenar.

### 6.3 unit-triage

Tercero.

No tiene señal nominal humanística, pero aparece en una unidad prioritaria para
curaduría institucional, por ejemplo CUCSH.

Este carril contiene casos como Derecho, Ciencias Sociales, Educación o Ciencia
Política.

Su función es decidir explícitamente alcance o exclusión; CUCSH nunca implica
Humanidades automáticamente.

### 6.4 high-impact-triage

Cuarto.

Programa no resuelto con alta frecuencia pero sin señales anteriores.

Permite reducir grandes bolsas de QUARANTINE mediante decisiones institucionales
de alto impacto.

### 6.5 backlog

Último.

Resto de los nombres no resueltos.

---

## 7. Orden de carriles

El orden es fijo:

1. scope-review;
2. humanities-candidate;
3. unit-triage;
4. high-impact-triage;
5. backlog.

Dentro de cada carril se usa el score.

Esto impide que 296 tesis de Derecho oculten dos tesis históricas de
lengua/literatura.

---

## 8. Score

El score está acotado a 0–100.

Componentes:

### Frecuencia

Escala logarítmica.

Máximo:

34 puntos.

La frecuencia aumenta impacto de una decisión, pero no prueba disciplina.

### Señales nominales

Máximo:

28 puntos.

Usa coincidencias por palabra/frase completa.

No usa substrings.

Por tanto:

- `arte` coincide con “Historia del Arte”;
- `arte` **no** coincide con “partero”;
- `cultura` **no** coincide con “agricultura”.

### Unidad

Máximo:

20 puntos.

Pesos V1:

- CUCSH: 18;
- CUTONALA: 7;
- CUAAD: 5;
- SUV: 3.

Estos valores sólo priorizan investigación institucional.

### REVIEW existente

25 puntos.

Hace que una decisión ya abierta tenga prioridad.

### Variantes

4 puntos cuando el mismo nombre normalizado tiene más de una forma cruda.

### Historia

5 puntos cuando existe al menos una fecha **válida** anterior a 2010.

Fechas:

- invalid;
- suspicious;
- unknown

no se usan para determinar el span histórico.

### Lineage

8 puntos cuando una autoridad REVIEW:

- es histórica;
- o tiene `possibleSuccessorRef`.

---

## 9. Bandas

Las bandas sirven para lectura rápida dentro de cada carril.

### A

- todo REVIEW;
- o score >= 60.

### B

score >= 45.

### C

score >= 28.

### D

resto.

La banda tampoco decide admisión.

---

## 10. Baseline full con Program Authority V2

Sobre el artifact full:

- artifact ID: `13099541204`;
- 701 grupos de programa observados;
- 27,436 trabajos con programa;
- 387 trabajos resueltos por autoridades INCLUDE V2;
- 27,049 trabajos representados en la cola.

### Estados

- resolved: 18 grupos;
- review: 4 grupos;
- unresolved: 679 grupos.

La cola por defecto contiene:

**683 items**

porque omite los 18 grupos ya resueltos y conserva los 4 REVIEW.

### Carriles

- scope-review: **4**;
- humanities-candidate: **33**;
- unit-triage: **112**;
- high-impact-triage: **91**;
- backlog: **443**.

### Bandas

- A: 4;
- B: 11;
- C: 141;
- D: 527.

---

## 11. Primera cola real

### scope-review

1. Maestría en Filosofía — 2 tesis — CUCSH — 2005–2006;
2. Licenciatura en Letras — 4 — CUCSH — 1995–1998;
3. Doctorado en Estudios Literarios y Lingüísticos con Orientación en Lingüística Aplicada — 1 — CUCSH — 2014;
4. Licenciatura en Historia del Arte — 2 — CUTONALA — 2017–2019.

### Primeros humanities-candidate

1. Maestría en la Enseñanza de la Lengua y Literatura — 2 — CUCSH — 2003–2006;
2. Maestría en Enseñanza de la Lengua y la Literatura — 1 — CUCSH — 2003;
3. Maestría en Lengua y Literatura Mexicana — 1 — CUCSH — 2005;
4. Maestría en la Enseñanza del Inglés como Lengua Extranjera — 1 — CUCSH — 2012;
5. Maestría en Gestión y Desarrollo Cultural — 40 — CUAAD;
6. Maestría en Arquitectura, orientación en Historia de la Arquitectura Mexicana — 10 — CUAAD;
7. variantes de Ciencias de la Arquitectura / Historia de la Arquitectura;
8. variantes de Conservación del Patrimonio Edificado;
9. Licenciatura en la Docencia del Inglés — 1 — CUCSH;
10. Maestría en Gestión de la Cultura — 15 — SUV.

La lista muestra por qué el siguiente trabajo debe realizarse **por familias**:

- lengua/literatura;
- docencia de lenguas;
- cultura;
- historia de la arquitectura;
- patrimonio;
- arte.

No conviene crear una autoridad independiente por cada string sin comprobar
lineage.

---

## 12. Falsos positivos esperados

Una cola de priorización puede incluir programas que finalmente sean EXCLUDE.

Ejemplo:

`Licenciatura en Cultura Física y Deportes`

puede recibir una señal lexical por la palabra completa “cultura”.

Eso no es un bug de admisión porque:

- sigue unresolved;
- no entra al corpus público;
- requiere evidencia;
- el score sólo determina orden de revisión.

T2D prefiere una cola explicable y auditable antes que un clasificador opaco que
intente adivinar Humanidades.

---

## 13. Evidencia necesaria

### unresolved

Por defecto solicita:

- official-program-evidence;
- academic-unit-evidence.

Si tiene observaciones válidas anteriores a 2010:

- historical-dictamen-or-archive.

### review

Solicita:

- scope-decision.

Si hay lifecycle histórico o posible sucesor:

- lineage-evidence.

---

## 14. Datos temporales

Sólo fechas con:

`quality=valid`

pueden contribuir a:

- min year;
- max year;
- historical-observations.

Esto evita que fechas anomalas del repositorio distorsionen la prioridad.

---

## 15. CI

`Thesis real corpus harvest` ahora:

1. compila el builder canónico;
2. compila el harvester;
3. compila Program Curation Queue;
4. ejecuta tests offline;
5. hace harvest sample;
6. valida reconciliación;
7. construye la cola;
8. valida lanes/decisionConstraint;
9. sube harvest + queue como un artifact.

Así cada cambio futuro en parser, registry o Admission Gate puede mostrar
inmediatamente cómo cambia la cola.

---

## 16. Tests

`tests/test_thesis_program_curation_queue.py`

verifica:

- coincidencia por palabra completa;
- `arte` no coincide con “partero”;
- `cultura` no coincide con “agricultura”;
- REVIEW es estado real de cola;
- resolved se omite por defecto;
- candidatos lexicales no cambian admisión;
- fechas invalid/suspicious no crean span histórico;
- humanities-candidate precede a unit-triage aunque tenga menor frecuencia;
- scope-review precede a unresolved.

---

## 17. Próxima fase

T2E debe trabajar **familias**, no strings.

Primera familia recomendada:

### Lengua / literatura histórica CUCSH

Candidatos:

- Maestría en la Enseñanza de la Lengua y Literatura;
- Maestría en Enseñanza de la Lengua y la Literatura;
- Maestría en Lengua y Literatura Mexicana;
- Maestría en la Enseñanza del Inglés como Lengua Extranjera;
- Licenciatura en la Docencia del Inglés.

Objetivo:

1. localizar dictámenes/programas históricos;
2. determinar si son autoridades independientes o aliases;
3. construir predecessor/successor;
4. actualizar observedFrom/observedUntil;
5. proyectar el cambio sobre el mismo snapshot;
6. no recosechar RIUdeG si los SourceRecord no cambiaron.
