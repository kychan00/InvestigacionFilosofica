# Tesis Humanidades UdeG — Source Reconnaissance V1

## Estado

**T1 — reconnaissance en curso.**

Esta fase verifica las fuentes antes de construir un harvester completo.

No cosecha el corpus, no descarga PDFs, no modifica producción y no publica todavía un dataset de tesis.

---

## 1. Objetivo

Verificar empíricamente:

- endpoint OAI-PMH;
- respuesta `Identify`;
- formatos de metadatos;
- sets;
- primera página de identificadores;
- resumption token;
- granularidad temporal;
- política `deletedRecord`;
- disponibilidad de Dublin Core cualificado o equivalente;
- estructura real de metadatos de una muestra.

El probe de CI es deliberadamente de sólo lectura y no sigue resumption tokens de registros.

---

## 2. Evidencia pública confirmada antes del probe

### 2.1 RIUdeG

La colección pública de Tesis muestra **27,425 registros** en la vista consultada el 1 de noviembre de 2026.

La tabla pública expone, entre otros:

- título;
- autor;
- programa educativo;
- centro universitario;
- tipo documental.

### 2.2 Registro completo RIUdeG

La vista `?mode=full` demuestra que existen metadatos cualificados útiles que no deben perderse en una normalización simplista.

Campos observados:

- `dc.contributor.author`;
- `dc.contributor.director`;
- `dc.contributor.codirector` en algunos registros;
- `dc.date.issued`;
- `dc.identifier.uri`;
- `dc.description.abstract` cuando existe;
- `dc.subject`;
- `dc.title`;
- `dc.type`;
- `dc.type.conacyt`;
- `dc.degree.name`;
- `dc.degree.department`;
- `dc.degree.grantor`;
- `dc.degree.creator`;
- `dc.rights.access` cuando existe;
- `dc.language.iso`;
- `dc.format`.

Esto valida la decisión de T0 de modelar programa, unidad, institución y rol como dimensiones separadas.

### 2.3 Roles

Se observaron registros con:

- `Director`;
- `Asesor`;
- `dc.contributor.director`;
- `dc.contributor.codirector`.

La UI puede traducir etiquetas de forma distinta según época o locale. La normalización debe basarse en metadatos fuente, no en el texto visual de la ficha.

### 2.4 Programas fuera de CUCSH

RIUdeG contiene Humanidades potenciales fuera de la semilla CUCSH. Un ejemplo público es Licenciatura en Antropología en CUNORTE.

Esto confirma que:

> CUCSH es semilla institucional, no frontera final del corpus.

### 2.5 Fechas anómalas

Las facetas públicas de RIUdeG presentan rangos anómalos, incluyendo valores anteriores al año 1000 y un rango que llega a 2107.

El pipeline debe conservar fecha cruda + precisión + estado de calidad y no “corregir” automáticamente.

---

## 3. Interoperabilidad declarada por RIUdeG

Los lineamientos públicos de RIUdeG establecen OAI-PMH como estándar de interoperabilidad.

También documentan conceptualmente:

- Dublin Core Cualificado;
- marcas de fecha ISO 8601;
- recolección selectiva `from` / `until`;
- registros eliminados mediante `deletedRecord`;
- resumption tokens;
- sets;
- identificadores persistentes.

T1 debe verificar cuáles de estas capacidades están efectivamente expuestas por el endpoint público actual.

---

## 4. UDGVirtual

La colección pública de tesis de UDGVirtual es complementaria.

La colección incluye tesis procedentes de distintas universidades, por lo que la pertenencia a esa colección no prueba:

- institución otorgante = Universidad de Guadalajara;
- programa humanístico UdeG.

La resolución de `InstitutionAuthority` es obligatoria antes de INCLUDE.

---

## 5. Probe reproducible

Archivo:

`scripts/thesis/probe_oai.py`

Workflow:

`.github/workflows/thesis-source-recon.yml`

El probe prueba candidatos comunes de DSpace para cada repositorio y considera válido un endpoint sólo cuando:

1. devuelve XML OAI-PMH 2.0;
2. contiene `Identify`;
3. no devuelve error OAI.

Para el endpoint seleccionado inspecciona:

- `Identify`;
- `ListMetadataFormats`;
- primera página de `ListSets`;
- primera página de `ListIdentifiers`;
- un único `GetRecord` en formatos relevantes disponibles como `oai_dc`, `dim`, `xoai` o `qdc`.

No sigue tokens de registros y no descarga bitstreams.

---

## 6. Candidatos de endpoint

Los candidatos se consideran **hipótesis técnicas**, no documentación de fuente:

### RIUdeG

- `/oai/request`;
- `/server/oai/request`;
- `/dspace-oai/request`;
- variantes con/sin `www`.

### UDGVirtual

- `/oai/request`;
- `/jspui/oai/request`;
- `/server/oai/request`.

El resultado del workflow decidirá cuáles existen realmente.

---

## 7. Decisión sobre formato de metadatos

No se fijará `oai_dc` como formato de cosecha final sólo porque sea universal.

Si el endpoint expone `dim`, `xoai`, QDC u otro formato que preserve los qualifiers institucionales, T1 deberá preferir el formato que conserve de manera verificable:

- programa;
- unidad;
- institución otorgante;
- director/codirector;
- tipo de grado;
- acceso;
- abstract;
- keywords;
- identificadores.

`oai_dc` puede mantenerse como fallback de interoperabilidad.

---

## 8. Criterio de cierre de T1

T1 se considera cerrada cuando:

1. endpoint(s) efectivo(s) están verificados;
2. Identify está documentado;
3. formatos están enumerados;
4. sets relevantes están caracterizados;
5. una muestra real conserva los campos necesarios;
6. se conoce la política de borrados;
7. se conoce la granularidad temporal;
8. se conoce el comportamiento del resumption token;
9. existe una matriz inicial de calidad/cobertura;
10. puede diseñarse T2 sin asumir detalles del proveedor.

---

## 9. Referencias públicas consultadas

- RIUdeG, colección Tesis:
  https://www.riudg.udg.mx/handle/20.500.12104/9
- RIUdeG, políticas/interoperabilidad:
  https://www.riudg.udg.mx/info/politicas.jsp
- UDGVirtual, colección Tesis:
  https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6

Consultadas el 1 de noviembre de 2026.
