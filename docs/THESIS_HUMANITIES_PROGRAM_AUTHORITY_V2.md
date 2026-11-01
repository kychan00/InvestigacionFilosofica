# Tesis Humanidades UdeG — Academic Program Authority V2

## Estado

**T2C — primera curaduría sobre inventario completo.**

Esta fase amplía la autoridad de programas después de observar el primer corpus completo:

- 27,576 SourceRecord;
- 27,576 trabajos canónicos;
- 27,431 encabezados OAI RIUdeG, de los cuales 27,429 activos y 2 tombstones;
- 147/147 registros UDGVirtual;
- 701 nombres normalizados de programa observados.

La fuente del baseline es el artifact de Actions:

- artifact ID: `13099541204`;
- canonical corpus SHA-256:
  `65d9e345cfc7a35100dd0851500d18f42f2ac6f3d31db23c72f309c854f7351f`;
- observed authorities SHA-256:
  `72b6745ae7f74890447e1c70b07763d385ac6bfebdd89a6dff08c5c6a4de3949`.

---

## 1. Objetivo

T2C no intenta resolver los 701 nombres de una sola vez.

Busca demostrar una curaduría escalable:

    full inventory
        ↓
    nombre observado
        ↓
    evidencia institucional UdeG
        ↓
    identidad de programa
        ↓
    INCLUDE / REVIEW / EXCLUDE
        ↓
    aliases + lifecycle + unidad + evidencia

La decisión disciplinaria sigue sin utilizar:

- título de tesis;
- abstract;
- keywords;
- director;
- embedding;
- clúster;
- modelo generativo.

---

## 2. Registry revision

El contrato estructural sigue siendo:

`thesis-humanities-program-authority-v1`

pero la revisión de contenido queda fijada como:

`registryRevision = 2026-11-01.v2`

El corpus ahora registra esa revisión concreta en:

`programAuthorityRevision`

en vez de registrar únicamente la versión del schema.

---

## 3. REVIEW se vuelve ejecutable

T0 definió cinco estados conceptuales:

- INCLUDE;
- REVIEW;
- QUARANTINE;
- EXCLUDE;
- REJECT_SOURCE.

Antes de T2C, una autoridad con `admissionState=review` no tenía semántica de runtime completa.

T2C corrige esto.

### INCLUDE

Institución UdeG confirmada + autoridad humanística aprobada.

### REVIEW

Institución UdeG y programa identificados, pero queda pendiente una decisión institucional de alcance, equivalencia histórica o lineage.

### QUARANTINE

No se ha resuelto todavía el programa o la institución.

### EXCLUDE

Institución externa o programa confirmado fuera del alcance.

### REJECT_SOURCE

Objeto confirmado como no-tesis/no trabajo recepcional elegible.

---

## 4. Nuevas autoridades INCLUDE observadas

### 4.1 Maestría en Lingüística Aplicada

ID:

`program:udg:mae-linguistica-aplicada`

Inventario:

- 69 trabajos;
- 69 RIUdeG;
- unidad observada: CUCSH.

Evidencia:

`https://cucsh.udg.mx/maestrias/maestria-en-linguistica-aplicada`

La página institucional documenta su creación en 1996, adscripción al Departamento de Estudios en Lenguas Indígenas y orientación de investigación en lengua y lenguaje.

Estado:

`INCLUDE`

---

### 4.2 Doctorado en Geografía y Ordenación Territorial

ID:

`program:udg:doc-geografia-ordenacion-territorial`

Inventario:

- 12 trabajos;
- unidad observada: CUCSH.

Evidencia:

`https://cucsh.udg.mx/doctorados/doctorado_en_geografia_ordenacion_territorial`

El programa continúa la familia de Geografía/territorio ya establecida como campo humanístico en la autoridad semilla.

Estado:

`INCLUDE`

---

### 4.3 Doctorado en Humanidades

ID:

`program:udg:doc-humanidades`

Inventario:

- 7 trabajos;
- unidad observada: CUCSH.

Evidencia:

`https://cucsh.udg.mx/convocatorias/convocatoria-abierta-doctorado-en-humanidades`

La propia denominación y documentación institucional ubican el programa explícitamente en Humanidades.

Estado:

`INCLUDE`

---

### 4.4 Doctorado en Estudios Literarios y Lingüísticos

ID:

`program:udg:doc-estudios-literarios-linguisticos`

Inventario:

- 1 trabajo con nombre exacto;
- unidad observada: CUCSH.

Evidencia:

`https://www.cucsh.udg.mx/Divisi%C3%B3n_y_departamentos/Departamentos_de_estudios_literarios`

El Departamento de Estudios Literarios identifica este doctorado entre sus programas de posgrado.

Estado:

`INCLUDE`

---

### 4.5 Maestría en Bioética

ID:

`program:udg:mae-bioetica`

Inventario:

- 2 trabajos;
- unidad observada: CUCSH.

Evidencia:

`https://cucsh.udg.mx/maestrias/maestria_bioetica`

El programa es ofrecido por UdeG a través del Departamento de Filosofía del CUCSH, con colaboración intercentros.

Estado:

`INCLUDE`

---

### 4.6 Maestría en Ciencias Antropológicas

ID:

`program:udg:mae-ciencias-antropologicas`

Inventario:

- 1 trabajo;
- unidad observada: CUTONALA.

Evidencia:

`https://cutonala.udg.mx/ofertaacademica/maestrias/ciencias-antropologicas`

La documentación del programa lo ubica en antropología e historia, antropología política, antropología social/cultural y arqueología, y documenta su aprobación institucional en CUTonalá.

Estado:

`INCLUDE`

Este caso confirma que el corpus Humanidades UdeG no se restringe al CUCSH.

---

## 5. Nuevas autoridades INCLUDE sin tesis observada todavía

Estas autoridades se incorporan para que futuras cosechas puedan resolverlas inmediatamente.

### 5.1 Maestría en Literaturas Interamericanas

ID:

`program:udg:mae-literaturas-interamericanas`

Evidencia:

`https://cucsh.udg.mx/maestrias/maestria-en-literaturas-interamericanas`

Programa del Departamento de Estudios Literarios orientado al estudio de literaturas y culturas interamericanas.

Estado:

`INCLUDE`

---

### 5.2 Maestría en Estudios Mesoamericanos

ID:

`program:udg:mae-estudios-mesoamericanos`

Evidencia:

`https://www.cucsh.udg.mx/maestrias/maestria-en-estudios-mesoamericanos`

Sus líneas documentadas abarcan historia, etnografía, arqueología, pueblos mesoamericanos y documentación lingüística.

Estado:

`INCLUDE`

---

### 5.3 Licenciatura en Escritura Creativa

ID:

`program:udg:lic-escritura-creativa`

Evidencia:

`https://cucsh.udg.mx/licenciaturas/licenciatura-en-escritura-creativa`

El plan incluye literatura, hermenéutica, historia cultural, teoría literaria e investigación literaria.

Estado:

`INCLUDE`

---

## 6. Autoridades REVIEW

### 6.1 Licenciatura en Historia del Arte

ID:

`program:udg:lic-historia-arte`

Inventario:

- 2 trabajos;
- unidad observada: CUTONALA.

La documentación de CUTonalá la describe como una disciplina científica y humanística.

Sin embargo, la Guía de Carreras general de UdeG la clasifica en:

`Artes, Arquitectura y Diseño`

Esto crea una frontera de alcance legítima.

Estado:

`REVIEW`

No entra todavía en embeddings, atlas ni estadísticas principales.

---

### 6.2 Licenciatura en Letras

ID:

`program:udg:lic-letras-historica`

Inventario:

- 4 trabajos;
- unidad observada: CUCSH.

CUCSH sigue publicando convocatorias dirigidas conjuntamente a egresados de:

- Licenciatura en Letras;
- Licenciatura en Letras Hispánicas.

Esto confirma la existencia histórica del nombre.

No se afirma todavía que sea idéntica o predecesora institucional directa de Letras Hispánicas.

Campo:

`possibleSuccessorRef = program:udg:lic-letras-hispanicas`

Estado:

`REVIEW`

---

### 6.3 Maestría en Filosofía

ID:

`program:udg:mae-filosofia-historica`

Inventario:

- 2 trabajos;
- unidad observada: CUCSH.

El nombre aparece en herramientas institucionales de Control Escolar y el programa actual de la misma familia es Maestría en Estudios Filosóficos.

No se ha localizado todavía un dictamen que autorice afirmar sucesión.

Campo:

`possibleSuccessorRef = program:udg:mae-estudios-filosoficos`

Estado:

`REVIEW`

---

### 6.4 Doctorado en Estudios Literarios y Lingüísticos con Orientación en Lingüística Aplicada

ID:

`program:udg:doc-estudios-literarios-linguisticos-orient-linguistica`

Inventario:

- 1 trabajo;
- unidad observada: CUCSH.

El Doctorado base está documentado institucionalmente.

La orientación histórica aparece en RIUdeG, pero no se ha localizado todavía evidencia suficiente para fusionarla como simple alias del programa actual.

Estado:

`REVIEW`

---

## 7. Proyección sobre el inventario completo

Sin volver a cosechar las fuentes, la nueva registry puede proyectarse sobre el mismo snapshot completo porque los SourceRecord son inmutables.

Registry V1:

- INCLUDE: 295;
- QUARANTINE: 27,272;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Con las autoridades V2 observadas:

- nuevos INCLUDE observados: 92;
- nuevos REVIEW observados: 9.

Proyección V2:

- INCLUDE: **387**;
- REVIEW: **9**;
- QUARANTINE: **27,171**;
- EXCLUDE: **7**;
- REJECT_SOURCE: **2**.

Programas resueltos en el snapshot:

- antes: 295 trabajos;
- después: 396 trabajos.

Esto sigue siendo una fracción pequeña del universo porque la registry es deliberadamente conservadora.

---

## 8. Programas todavía no resueltos

La aparición en CUCSH no basta.

Ejemplos que permanecen fuera de INCLUDE por ahora:

- Doctorado en Educación;
- Maestría en Comunicación;
- Maestría en Periodismo Digital;
- programas jurídicos;
- programas de salud;
- programas económico-administrativos.

También permanecen QUARANTINE hasta obtener mejor evidencia histórica:

- Maestría en la Enseñanza de la Lengua y Literatura;
- Maestría en Enseñanza de la Lengua y la Literatura;
- Maestría en Lengua y Literatura Mexicana;
- Doctorado en Antropología Social.

T2C evita convertir similitud nominal en equivalencia institucional.

---

## 9. Campos nuevos de curaduría

Las nuevas autoridades pueden registrar:

- `registryRevision`;
- `inventoryBaseline`;
- `lifecycleState`;
- `academicUnits`;
- `observedCount`;
- `possibleSuccessorRef`;
- `decisionNote`.

Estos campos son evidencia/curaduría y no sustituyen los SourceRecord.

---

## 10. Validaciones

La carga de registry falla si:

- falta ID;
- se repite ID;
- falta nombre canónico;
- falta evidencia;
- `admissionState` no es `include`, `review` o `exclude`.

El índice de aliases continúa fallando ante colisiones entre autoridades distintas.

Un trabajo REVIEW debe:

- tener `programRef`;
- pertenecer a UdeG;
- conservar la decisión `program-review`.

---

## 11. Próxima curaduría

El siguiente lote debe priorizar por:

1. frecuencia observada;
2. cercanía disciplinaria humanística;
3. disponibilidad de evidencia institucional;
4. riesgo de falso positivo.

No se resolverán los 701 nombres manualmente uno por uno sin estrategia.

La siguiente herramienta deseable es generar una cola de curaduría:

    normalized program
      + variantes
      + frecuencia
      + unidades
      + años
      + tipos de grado
      + evidencia institucional candidata
      + decisión actual

Esa cola permitirá trabajar por familias y lineage, no por strings aislados.
