# Tesis Humanidades UdeG — Arts & Heritage AcademicProgramAuthority V5

## Estado

**T2G — arquitectura, patrimonio y artes.**

Esta fase amplía AcademicProgramAuthority sobre la familia más compleja de la
cola T2D/T2F:

- arquitectura;
- historia de la arquitectura;
- conservación del patrimonio;
- arte y cultura;
- etnomusicología;
- educación y didáctica de las artes;
- estudios cinematográficos.

La regla sigue siendo la misma:

**el título o tema de una tesis no decide su pertenencia al corpus.**

La decisión se toma sobre la autoridad del programa y evidencia institucional
UdeG.

---

## 1. Baseline corregido

La fase parte de Program Authority V4 con la corrección de T2F:

- INCLUDE: 416;
- REVIEW: 44;
- QUARANTINE: 27,107;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Total:

27,576 trabajos.

La corrección previa reconoce 3 tesis de Doctorado en Gestión de la Cultura que
habían sido omitidas del conteo manual inicial.

---

## 2. Regla de frontera Arte–Humanidades

CUAAD contiene programas con una dimensión histórica, cultural, antropológica,
patrimonial o teórica muy fuerte.

Eso **no** permite incluir automáticamente todo el centro universitario.

T2G distingue:

### INCLUDE

Sólo cuando existe evidencia institucional explícita que caracteriza el programa
como humanístico o su contrato académico como investigación humanística
interdisciplinaria.

### REVIEW

Cuando el programa está formalmente adscrito/clasificado en Arte, Arquitectura y
Diseño y existe una relación plausible con Humanidades que merece decisión de
alcance.

### QUARANTINE

Cuando el string sigue siendo ambiguo o no existe evidencia suficiente para
resolverlo a una autoridad.

Esta diferencia es intencional.

---

## 3. Doctorado Interinstitucional en Arte y Cultura

Autoridad:

`program:udg:doc-arte-cultura-interinstitucional`

Estado:

`INCLUDE`

Tesis observadas:

**6**

Unidad:

- CUAAD: 6.

Años válidos:

2017–2019.

### Evidencia

CUAAD describe explícitamente el programa como:

**doctorado interinstitucional de carácter humanístico**.

La investigación aborda:

- fenómenos artísticos;
- cultura;
- estudios sociales del arte;
- discurso;
- prácticas visuales y performativas;
- patrimonio cultural.

Fuentes:

- `https://cuaad.udg.mx/index.php/oferta/doctorados/diac/identificacion-del-programa-de-posgrado`
- `https://ww1.udg.mx/es/oferta-academica/posgrados/doctorados/doctorado-interinstitucional-arte-y-cultura`
- `https://ww1.udg.mx/es/convocatorias/doctorado-interinstitucional-en-arte-y-cultura-diac-convocatoria-2024-2028`

### Decisión

La descripción programática humanística explícita es evidencia más específica
que la clasificación administrativa general del centro.

Por eso:

`INCLUDE`

---

## 4. Maestría en Etnomusicología

Autoridad:

`program:udg:mae-etnomusicologia`

Estado:

`INCLUDE`

Tesis observadas:

**9**

Unidad:

- CUAAD: 9.

Años válidos observados:

2015–2023.

### Evidencia

La oferta vigente describe la maestría como investigación interdisciplinaria en:

- antropología social y cultural;
- antropología de la música;
- historia;
- arqueología;
- lingüística;
- culturas expresivas.

Además, documentación institucional histórica de CUAAD ubica su antecedente:

`Maestría en Ciencias Musicales con Especialidad en Etnomusicología`

en el área:

`Educación y Humanidades`

Fuentes:

- `https://cuaad.udg.mx/oferta/maestrias/met/presentacion`
- `https://cuaad.udg.mx/oferta/maestrias/met/requisitos-de-ingreso`
- `https://cgpe.udg.mx/sites/default/files/prodescuaad2004.pdf`
- `https://escolar.udg.mx/sites/default/files/Claves_Carrera_de_Mstrias_2_0.pdf`

### Decisión

La autoridad se admite por evidencia programática e institucional, no porque
las tesis contengan vocabulario cultural.

`INCLUDE`

---

## 5. Maestría en Ciencias de la Arquitectura

Autoridad:

`program:udg:mae-ciencias-arquitectura`

Estado:

`REVIEW`

Tesis agrupadas por aliases documentados:

**112**

Unidad:

- CUAAD.

Años válidos:

1996–2021.

### 5.1 Lineage institucional

CUAAD documenta:

- creación de la Maestría en Ciencias de la Arquitectura en 1995;
- modificación en 1999 con orientaciones, retroactiva a 1995-B;
- reapertura en 2003 con dos orientaciones.

Las orientaciones documentadas en 1999 fueron:

1. Historia de la Arquitectura Mexicana;
2. Conservación del Patrimonio Edificado;
3. Teoría y Crítica de la Arquitectura;
4. Edificación Arquitectónica;
5. Urbanismo y Desarrollo;
6. Arte y Comunicación;
7. Administración de Procesos.

La oferta posterior conserva:

- Historia de la Arquitectura Mexicana;
- Conservación del Patrimonio Edificado.

Control Escolar asigna claves institucionales a las orientaciones.

Fuentes:

- `https://cuaad.udg.mx/?q=oferta%2Fposgrados%2Fmaestrias%2Fmca%2Fantecedentes-historicos`
- `https://cuaad.udg.mx/node/21768`
- `https://ww1.udg.mx/es/oferta-academica/posgrados/maestrias/maestria-en-ciencias-de-la-arquitectura`
- `https://escolar.udg.mx/sites/default/files/Claves_Carrera_de_Mstrias_2_0.pdf`

### 5.2 Aliases

Se agrupan como una sola autoridad los strings que identifican explícitamente:

- Maestría en Ciencias de la Arquitectura;
- Maestría en Arquitectura + orientación Historia;
- Maestría en Arquitectura + orientación Conservación;
- Teoría y Crítica;
- Edificación Arquitectónica;
- Urbanismo y Desarrollo;
- Arte y Comunicación;
- variantes de Ciencias de la Arquitectura con esas orientaciones.

No se usa fuzzy matching.

No se agrega el string genérico:

`Maestría en Arquitectura`

porque no demuestra por sí mismo que pertenezca a este lineage.

### 5.3 Decisión disciplinaria

La UdeG clasifica actualmente el programa dentro de:

`Arte, Arquitectura y Diseño`

aunque sus líneas de investigación incluyen historia y patrimonio.

Por ello:

`REVIEW`

No se convierte automáticamente en Humanidades por su contenido.

---

## 6. Historia de la Arquitectura Mexicana — nombre standalone

Autoridad:

`program:udg:mae-historia-arquitectura-mexicana-historica`

Estado:

`REVIEW`

Tesis observadas:

**4**

Años:

2004–2009.

Control Escolar conserva una denominación/clase propia:

`Maestría en Historia de la Arquitectura Mexicana`

y RIUdeG tiene registros con ese grado standalone.

Se declara:

`possibleSuccessorRef = program:udg:mae-ciencias-arquitectura`

pero **no se fusiona automáticamente** con la orientación actual.

La similitud histórica y nominal demuestra una relación plausible, no identidad
jurídica suficiente.

---

## 7. Conservación del Patrimonio Edificado — nombre standalone

Autoridad:

`program:udg:mae-conservacion-patrimonio-edificado-historica`

Estado:

`REVIEW`

Tesis observadas:

**5**

Años:

2006–2014.

RIUdeG conserva grados expedidos con el nombre:

`Maestría en Conservación del Patrimonio Edificado`

mientras la oferta actual la presenta como orientación de Ciencias de la
Arquitectura.

Se declara:

`possibleSuccessorRef = program:udg:mae-ciencias-arquitectura`

sin convertirlo en alias.

---

## 8. Maestría en Educación y Expresión para las Artes

Autoridad:

`program:udg:mae-educacion-expresion-artes`

Estado:

`REVIEW`

Tesis observadas:

**27**

Unidad:

- CUAAD.

Años:

2018–2026.

La oferta institucional integra:

- educación artística;
- producción artística;
- investigación;
- docencia.

Pero la clasificación institucional publicada es:

`Arte, Arquitectura y Diseño`

Por ello:

`REVIEW`

Fuentes:

- `https://ww1.udg.mx/es/node/14999`
- `https://cuaad.udg.mx/oferta/maestrias/meea/perfil-del-aspirante`
- `https://escolar.udg.mx/sites/default/files/Claves_Carrera_de_Mstrias_2_0.pdf`

---

## 9. Didáctica de las Artes — no colapsar la ambigüedad

Control Escolar documenta programas/áreas diferentes:

- Artes Visuales;
- Artes Escénicas;
- Música.

Por ello el string genérico:

`Maestría en Didáctica de las Artes`

permanece:

`unknown / QUARANTINE`

aunque aparezca muchas veces.

No se asigna por frecuencia.

No se asigna por CUAAD.

No se asigna por similitud.

### 9.1 Artes Visuales

Autoridad:

`program:udg:mae-didactica-artes-visuales-historica`

Estado:

`REVIEW`

Aliases explícitos observados:

- orientación Artes Visuales;
- especialidad Artes Visuales;
- variantes ortográficas equivalentes.

Tesis observadas:

**16**

Años:

2003–2006.

### 9.2 Artes Escénicas

Autoridad:

`program:udg:mae-didactica-artes-escenicas-historica`

Estado:

`REVIEW`

Tesis observadas:

**3**

Años:

2005–2006.

No se crea por ahora una autoridad observada para Música porque el snapshot no
aporta un string suficientemente explícito que deba resolverse en esta fase.

Fuente de claves:

`https://escolar.udg.mx/sites/default/files/Claves_Carrera_de_Mstrias_2_0.pdf`

---

## 10. Maestría en Estudios Cinematográficos

Autoridad:

`program:udg:mae-estudios-cinematograficos`

Estado:

`REVIEW`

Tesis exactas observadas en este snapshot:

**0**

Se incorpora anticipadamente para futuras cosechas.

La oferta trabaja:

- teoría del cine;
- historia del cine;
- crítica;
- análisis;
- estudios culturales;
- investigación cinematográfica.

También se dirige a perfiles humanísticos afines.

Sin embargo la clasificación institucional publicada es:

`Arte, Arquitectura y Diseño`

Por eso:

`REVIEW`

Fuentes:

- `https://ww1.udg.mx/es/oferta-academica/maestria-en-estudios-cinematograficos`
- `https://cuaad.udg.mx/index.php/node/21873`
- `https://cuaad.udg.mx/index.php/node/20445`
- `https://escolar.udg.mx/sites/default/files/Claves_Carrera_de_Mstrias_2_0.pdf`

---

## 11. Registry V5

Nueva revisión:

`2026-11-01.v5`

Autoridades:

- total: **45**;
- INCLUDE: **34**;
- REVIEW: **11**.

Nuevas autoridades:

### INCLUDE

1. Doctorado Interinstitucional en Arte y Cultura;
2. Maestría en Etnomusicología.

### REVIEW

3. Maestría en Ciencias de la Arquitectura;
4. Maestría en Historia de la Arquitectura Mexicana;
5. Maestría en Conservación del Patrimonio Edificado;
6. Maestría en Educación y Expresión para las Artes;
7. Maestría en Didáctica de las Artes — Artes Visuales;
8. Maestría en Didáctica de las Artes — Artes Escénicas;
9. Maestría en Estudios Cinematográficos.

---

## 12. Proyección sobre el inventario completo

Baseline V4 corregido:

- INCLUDE: 416;
- REVIEW: 44;
- QUARANTINE: 27,107;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Impacto V5:

### Nuevos INCLUDE

- DIAC: 6;
- Etnomusicología: 9.

Total:

**+15 INCLUDE**

### Nuevos REVIEW observados

- Ciencias de la Arquitectura y aliases documentados: 112;
- Historia de la Arquitectura Mexicana standalone: 4;
- Conservación del Patrimonio Edificado standalone: 5;
- Educación y Expresión para las Artes: 27;
- Didáctica de las Artes / Artes Visuales: 16;
- Didáctica de las Artes / Artes Escénicas: 3.

Total:

**+167 REVIEW**

Estudios Cinematográficos no altera el snapshot porque tiene 0 observaciones
exactas.

### V5 — cobertura por estado de programa

- program matches INCLUDE: **431**;
- program matches REVIEW: **211**;
- unresolved program works: **26,794**;
- obras sin programa crudo suficiente: **140**.

### V5 — Admission Gate real

- INCLUDE: **427**;
- REVIEW: **211**;
- QUARANTINE: **26,929**;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Cuatro obras de UDGVirtual resuelven a Maestría en Gestión de la Cultura
(INCLUDE) pero permanecen QUARANTINE por institución no confirmada.

Total:

27,576.

No se recosecha RIUdeG para esta proyección; se reutiliza el snapshot full
inmutable.

---

## 13. Lo que V5 deliberadamente no resuelve

Permanece fuera de una autoridad automática:

- `Maestría en Arquitectura` genérica;
- `Maestría en Didáctica de las Artes` genérica;
- variantes artísticas sin área explícita;
- posibles equivalencias no demostradas entre programas standalone y
  orientaciones;
- programas de diseño/producción artística sin evidencia humanística
  institucional suficiente.

Esto es una propiedad del sistema, no falta de cobertura accidental.

---

## 14. Pruebas

La suite V5 verifica:

- DIAC → INCLUDE;
- Etnomusicología → INCLUDE;
- Ciencias de la Arquitectura → REVIEW;
- Historia de Arquitectura standalone → REVIEW;
- Conservación standalone → REVIEW;
- Educación y Expresión para las Artes → REVIEW;
- Didáctica Visuales/Escénicas → REVIEW;
- Estudios Cinematográficos → REVIEW;
- múltiples nombres históricos de MCA resuelven al mismo programRef;
- el nombre genérico Didáctica de las Artes sigue unknown;
- el gate conserva la frontera 2 INCLUDE / 2 REVIEW en fixture;
- Program Curation Queue elimina DIAC/Etnomusicología por estar resueltos;
- MCA aparece como scope-review;
- Didáctica genérica permanece unresolved.

---

## 15. Principio resultante

T2G confirma que el corpus no debe definirse usando una taxonomía demasiado
simple como:

`CUAAD = no Humanidades`

ni:

`arte/cultura/patrimonio = Humanidades`

La unidad correcta de decisión sigue siendo:

**AcademicProgramAuthority + evidencia institucional específica.**

Eso permite admitir un doctorado explícitamente humanístico dentro de CUAAD y,
al mismo tiempo, mantener en REVIEW una maestría histórica/patrimonial
administrativamente clasificada en Arte, Arquitectura y Diseño.

---

## 16. Siguiente fase

Después de V5, conviene volver a Program Curation Queue y atacar el siguiente
grupo por impacto:

- programas sociales/educativos CUCSH;
- programas culturales/artísticos todavía ambiguos;
- variantes históricas restantes con alta frecuencia.

Antes de ampliar más la registry, T2H debería generar una **auditoría de
cobertura V5**:

- grupos resueltos;
- grupos REVIEW;
- top QUARANTINE por frecuencia;
- top candidatos humanísticos restantes;
- familias con aliases todavía ambiguos.

Esto permitirá decidir el siguiente bloque con datos posteriores a V5 y no con
la cola calculada sobre V2.


---

## 17. Aclaración posterior — T2H Coverage Audit

La proyección original de T2G contaba coincidencias de programa, no el resultado
completo del Admission Gate.

T2H fija esta distinción:

- **431** obras resuelven a autoridades cuyo estado es INCLUDE;
- **427** obras pasan realmente el Admission Gate;
- las 4 restantes están bloqueadas por institución no confirmada.

Las decisiones disciplinarias de V5 no cambian.
