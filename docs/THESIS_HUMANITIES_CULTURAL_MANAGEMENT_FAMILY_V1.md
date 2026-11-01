# Tesis Humanidades UdeG — Cultural Management Family V1

## Estado

**T2F — segunda curaduría por familia.**

Esta fase aplica Program Curation Queue a la familia:

- gestión cultural;
- políticas culturales;
- patrimonio;
- investigación cultural.

La decisión se apoya en clasificación institucional explícita de la Universidad
de Guadalajara y no en la presencia de la palabra “cultura”.

---

## 1. Programas distintos

La Universidad de Guadalajara mantiene dos maestrías con nombres próximos pero
contratos académicos distintos.

### Maestría en Gestión de la Cultura

- orientación: investigación;
- modalidad histórica/actual: no escolarizada / virtual;
- corpus observado: principalmente SUV;
- oferta vigente: Centro Universitario de Guadalajara;
- área institucional publicada: **Ciencias Sociales y Humanidades**.

### Maestría en Gestión y Desarrollo Cultural

- orientación: profesionalizante;
- modalidad: escolarizada;
- sede: CUAAD;
- área institucional publicada: **Arte, Arquitectura y Diseño**.

La propia documentación del posgrado de Gestión de la Cultura contrasta la
maestría profesionalizante de CUAAD con el programa orientado a investigación.

Por tanto:

**no son aliases y no se fusionan.**

---

## 2. Maestría en Gestión de la Cultura

Nueva autoridad:

`program:udg:mae-gestion-cultura`

Estado:

`INCLUDE`

Familia:

`gestion-cultural`

Tesis observadas:

**15**

Proveedores:

- RIUdeG: 11;
- UDGVirtual: 4.

Unidad observada explícitamente en RIUdeG:

- SUV: 11.

La oferta institucional vigente se presenta desde CUGDL.

Esto se registra como historia/unidades observadas de la autoridad y no como una
reescritura de los SourceRecord.

### Evidencia

Oferta institucional:

`https://ww1.udg.mx/es/oferta-academica/maestria-en-gestion-de-la-cultura`

La página clasifica el programa en:

`Ciencias Sociales y Humanidades`

y lo describe como programa de investigación sobre políticas culturales,
institucionalización de la gestión cultural, diversidad, memoria, patrimonio,
cibercultura y desarrollo cultural.

Oferta vigente CUGDL:

`https://cugdl.udg.mx/oferta-academica/posgrados-virtuales/maestria-y-doctorado-en-gestion-de-la-cultura`

PDF institucional:

`https://www.udg.mx/sites/default/files/2025-06/maestria_en_gestion_de_la_cultura_cugdl_snp.pdf`

### Decisión

La clasificación institucional explícita permite:

`INCLUDE`

No se necesita inferir Humanidades desde títulos de tesis ni desde palabras
clave.

---

## 3. Doctorado en Gestión de la Cultura

Nueva autoridad:

`program:udg:doc-gestion-cultura`

Estado:

`INCLUDE`

Tesis con nombre exacto observadas en el snapshot:

**3**

Proveedor:

- RIUdeG: 3.

Unidad histórica observada:

- SUV: 3.

Años válidos observados:

- 2023–2025.

La oferta institucional vigente se presenta desde CUGDL; la procedencia histórica
SUV se conserva como evidencia del snapshot y no se reescribe.

La UdeG clasifica explícitamente el Doctorado en Gestión de la Cultura en:

`Ciencias Sociales y Humanidades`

El CUGDL presenta maestría y doctorado como dos ciclos del mismo posgrado
integrado orientado a investigación.

### Evidencia

`https://ww1.udg.mx/es/oferta-academica/doctorado-en-gestion-de-la-cultura`

`https://cugdl.udg.mx/oferta-academica/posgrados-virtuales/maestria-y-doctorado-en-gestion-de-la-cultura`

`https://www.udg.mx/sites/default/files/2026-05/doctorado_en_gestion_de_la_cultura_cugdl_snp.pdf`

---

## 4. Maestría en Gestión y Desarrollo Cultural

Nueva autoridad:

`program:udg:mae-gestion-desarrollo-cultural`

Estado:

`REVIEW`

Tesis observadas:

**40**

Proveedor:

- RIUdeG: 40.

Unidad observada:

- CUAAD: 39;
- 1 sin unidad cruda utilizable.

La Universidad de Guadalajara clasifica oficialmente este programa en:

`Arte, Arquitectura y Diseño`

### Evidencia

Oferta UdeG:

`https://ww1.udg.mx/es/oferta-academica/posgrados/maestrias/maestria-en-gestion-y-desarrollo-cultural-cuaad`

Plan CUAAD:

`https://cuaad.udg.mx/oferta/maestrias/mgdc/plan-de-estudios`

PDF UdeG:

`https://www.udg.mx/sites/default/files/2026-04/maestria_en_gestion_y_desarrollo_cultural_cuaad_snp.pdf`

FAQ institucional que distingue los dos programas:

`https://gestioncultural.udgvirtual.udg.mx/preguntas-frecuentes`

---

## 5. Por qué REVIEW y no EXCLUDE

El proyecto delimita **Humanidades UdeG**, no una copia mecánica de una sola
taxonomía administrativa.

En este caso existen dos evidencias simultáneas:

### Evidencia contra inclusión automática

La clasificación oficial del programa es:

`Arte, Arquitectura y Diseño`

### Evidencia a favor de revisión humanística

El propio plan/objetivos incluye:

- investigación y gestión cultural;
- políticas públicas en cultura;
- patrimonio;
- paradigmas de la cultura;
- historia del arte;
- formación humanística y ética;
- investigación sociocultural.

Por ello la decisión correcta V1 no es forzar:

- INCLUDE;

ni forzar:

- EXCLUDE.

Es:

`REVIEW / program-review`

La decisión de alcance podrá resolverse mediante una política explícita sobre
fronteras Arte–Humanidades.

---

## 6. No lineage entre las dos maestrías

T2F no declara:

`Gestión y Desarrollo Cultural → Gestión de la Cultura`

ni:

`Gestión de la Cultura → Gestión y Desarrollo Cultural`

como predecessor/successor.

La documentación institucional las presenta simultáneamente como programas
distintos:

- uno profesionalizante en CUAAD;
- otro de investigación en la estructura virtual/CUGDL.

No existe motivo para convertir similitud nominal en identidad.

---

## 7. Registry V4

Nueva revisión:

`2026-11-01.v4`

Autoridades:

- total: **36**;
- INCLUDE: **32**;
- REVIEW: **4**.

Nuevas autoridades:

1. Maestría en Gestión de la Cultura — INCLUDE;
2. Doctorado en Gestión de la Cultura — INCLUDE;
3. Maestría en Gestión y Desarrollo Cultural — REVIEW.

---

## 8. Proyección sobre el full corpus

La decisión disciplinaria puede proyectarse sobre los SourceRecord ya
cosechados; no requiere volver a consultar RIUdeG.

V3:

- INCLUDE: 398;
- REVIEW: 4;
- QUARANTINE: 27,165;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

V4 proyectado, corregido contra el inventario completo:

- INCLUDE: **416**;
- REVIEW: **44**;
- QUARANTINE: **27,107**;
- EXCLUDE: 7;
- REJECT_SOURCE: 2.

Cambios frente a V3:

- +18 INCLUDE;
- +40 REVIEW;
- -58 QUARANTINE.

La diferencia respecto de la primera proyección T2F son 3 tesis de
`Doctorado en Gestión de la Cultura` que sí estaban presentes en RIUdeG y
quedaron omitidas del conteo manual inicial.

Total:

27,576.

---

## 9. Fechas y el hallazgo sentinela

La revisión de esta familia descubrió que ambos programas contienen valores:

- `1969-12-31`;
- `31/12/1969`.

El corpus completo contiene 561 valores de ese patrón.

La corrección se implementa en un PR separado:

`RIUdeG epoch sentinel date`

T2F no utiliza esos valores para afirmar antigüedad del programa.

La separación evita que una corrección de calidad temporal quede mezclada con
una decisión disciplinaria.

---

## 10. Tests

La suite V4 debe garantizar:

- Gestión de la Cultura resuelve a INCLUDE;
- Doctorado en Gestión de la Cultura resuelve a INCLUDE;
- Gestión y Desarrollo Cultural resuelve a REVIEW;
- las dos maestrías tienen programRef distintos;
- una tesis de CUAAD no entra automáticamente al corpus por contener “cultura”;
- una tesis de Gestión de la Cultura sí entra por autoridad institucional;
- el corpus pinnea `2026-11-01.v4`.

---

## 11. Próxima familia

Después de cultura/gestión cultural, el bloque humanístico más complejo de la
cola es:

**arquitectura / patrimonio / arte**

Incluye variantes como:

- Historia de la Arquitectura Mexicana;
- Conservación del Patrimonio Edificado;
- Arte y Comunicación;
- Doctorado Interinstitucional en Arte y Cultura;
- Etnomusicología;
- Estudios Cinematográficos.

Esta familia deberá reutilizar la política de frontera ya aplicada aquí:

una fuerte dimensión cultural/humanística no invalida la clasificación
administrativa oficial, pero puede justificar REVIEW en vez de una exclusión
automática.


---

## 12. Corrección de baseline del inventario completo

Una segunda auditoría del artifact full `13099541204`, realizada antes de T2G,
detectó que el nombre normalizado:

`doctorado en gestion de la cultura`

aparece **3 veces**, no 0.

Las tres observaciones:

- pertenecen a RIUdeG;
- tienen unidad cruda `SUV`;
- tienen años válidos 2023, 2024 y 2025.

La autoridad y su decisión `INCLUDE` ya eran correctas. El error estaba
limitado a:

- `observedCount`;
- la documentación de T2F;
- la proyección manual V4.

No se modifica el Admission Gate ni la identidad de las obras.
