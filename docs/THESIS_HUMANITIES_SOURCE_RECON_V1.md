# Tesis Humanidades UdeG — Source Reconnaissance V1

## Estado

**T1 — reconnaissance en curso, primer probe verificado.**

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

El probe de CI es deliberadamente de sólo lectura. Puede recorrer las páginas de `ListSets` para caracterizar la topología del repositorio, pero no sigue resumption tokens de registros.

---

## 2. Evidencia pública previa

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

### 2.3 Roles

Se observaron registros con:

- `Director`;
- `Asesor`;
- `dc.contributor.director`;
- `dc.contributor.codirector`.

La UI puede traducir etiquetas de forma distinta según época o locale. La normalización debe basarse en metadatos fuente, no en el texto visual de la ficha.

### 2.4 Humanidades fuera de CUCSH

RIUdeG contiene programas humanísticos fuera de la semilla CUCSH. Un ejemplo público es Licenciatura en Antropología en CUNORTE.

Esto confirma:

> CUCSH es semilla institucional, no frontera final del corpus.

### 2.5 Fechas anómalas

Las facetas públicas de RIUdeG presentan rangos anómalos, incluyendo valores anteriores al año 1000 y un rango que llega a 2107.

El pipeline debe conservar fecha cruda + precisión + estado de calidad y no “corregir” automáticamente.

---

## 3. Probe reproducible

Archivo:

`scripts/thesis/probe_oai.py`

Workflow:

`.github/workflows/thesis-source-recon.yml`

Primer run verificado:

- workflow run: `41340866536`;
- conclusión: `success`;
- artifact: `thesis-source-recon`;
- artifact ID: `13097465446`;
- SHA-256 del ZIP: `ee32cc2c452a4c1c895fd1e1ab58e5679c0446724cb8704e34235631be7eaecb`.

El primer run fue generado por el head:

`967ffe9b873ecd602d09721aeb0a73d28a05710c`.

La revisión 1.1 del probe amplía el reconocimiento a:

- todas las páginas de `ListSets`, con límite defensivo;
- identificación explícita del set `Tesis`;
- primera página de identificadores dentro de ese set;
- una muestra tomada del set de tesis;
- formatos tesis-específicos `uketd_dc` y `etdms`, además de `oai_dc`, `dim`, `xoai`, `qdc` y `mods`.

---

## 4. RIUdeG — endpoint verificado

Endpoint efectivo:

`https://riudg.udg.mx/oai/request`

La variante con `www` devolvió HTTP 404 en el probe, aunque la interfaz web ordinaria sí puede utilizar `www`.

No se debe canonicalizar automáticamente un host OAI añadiendo `www`.

### 4.1 Identify

Primer run:

- repositoryName: `RIUdeG`;
- protocolVersion: `2.0`;
- baseURL declarado: `https://riudg.udg.mx/oai/request`;
- earliestDatestamp: `2015-09-07T23:36:42Z`;
- deletedRecord: `transient`;
- granularity: `YYYY-MM-DDThh:mm:ssZ`.

Consecuencia:

Los borrados no están garantizados de forma permanente. El futuro harvester debe combinar incrementales con reconciliaciones periódicas y no asumir que una baja antigua seguirá disponible indefinidamente en OAI.

### 4.2 Formatos anunciados

El endpoint anuncia:

- `uketd_dc`;
- `qdc`;
- `didl`;
- `mods`;
- `ore`;
- `mets`;
- `oai_dc`;
- `rdf`;
- `marc`;
- `xoai`;
- `dim`;
- `etdms`.

La elección del formato final debe basarse en preservación de campos y estabilidad real, no sólo en que aparezca anunciado.

### 4.3 Sets

La primera página reportó:

- 100 sets;
- `completeListSize=145`;
- resumption token presente.

Entre los sets observados:

- `Tesis` → `com_20.500.12104_9`;
- `Doctorado` → `com_20.500.12104_20527`;
- `Especialidad` → `com_20.500.12104_20528`;
- `Licenciatura` → `com_20.500.12104_20529`;
- `Maestría` → `com_20.500.12104_20530`;
- `Técnico Superior` → `com_20.500.12104_20531`;
- `Tesis de otras universidades` → `com_20.500.12104_20532`.

También existen múltiples colecciones por centro universitario, incluyendo CUCSH, CUNORTE y otros centros.

Esto confirma que la estructura OAI conserva pertenencia simultánea a comunidades/colecciones mediante múltiples `setSpec`.

### 4.4 Universo OAI general

La primera llamada general a `ListIdentifiers` reportó:

`completeListSize=57696`

Este número **no es el tamaño del corpus de tesis**. Es el universo OAI consultado sin restringir al set Tesis.

La revisión 1.1 separa explícitamente ambos conteos.

### 4.5 DIM

Un `GetRecord` real con `metadataPrefix=dim` respondió HTTP 200.

En la muestra aparecieron qualifiers estructurados como:

- `dc.contributor.author`;
- `dc.date.submitted`;
- `dc.identifier.uri`;
- `dc.language.iso`;
- `dc.rights.holder`;
- `dc.type.conacyt`;
- `dc.degree.name`;
- `dc.degree.department`;
- `dc.degree.grantor`;
- `dc.degree.creator`.

Esto convierte a **DIM en candidato fuerte para el formato canónico de cosecha de RIUdeG**.

### 4.6 XOAI

`xoai` también respondió HTTP 200 en la muestra.

Además de metadatos, expuso estructura de bundle/bitstream, incluyendo:

- nombre de archivo;
- media type;
- tamaño;
- URL;
- checksum;
- algoritmo de checksum;
- Handle;
- identificador OAI.

XOAI puede servir para enriquecer `ThesisFileArtifact`, pero no debe elegirse automáticamente como fuente principal si DIM resulta más estable y suficiente.

---

## 5. UDGVirtual — endpoint verificado

Endpoint efectivo:

`https://biblioteca.udgvirtual.udg.mx/oai/request`

### 5.1 Identify

Primer run:

- repositoryName: `Repositorio UDGVirtual`;
- protocolVersion: `2.0`;
- earliestDatestamp: `2015-11-21T00:02:24Z`;
- deletedRecord: `persistent`;
- granularity: `YYYY-MM-DDThh:mm:ssZ`.

El `baseURL` declarado por el servidor es:

`http://148.202.167.116:8080/oai/request`

y el correo administrativo declarado es:

`dspace-help@myu.edu`.

Estos valores parecen configuración interna/por defecto y **no deben utilizarse como URLs canónicas ni como autoridad institucional sin validación adicional**.

El endpoint público HTTPS probado funciona y debe conservarse como URL operativa.

### 5.2 Formatos anunciados

UDGVirtual anuncia:

- `uketd_dc`;
- `dim`;
- `oai_dc`;
- `marc`;
- `etdms`;
- `xoai`;
- `qdc`;
- `rdf`;
- `ore`;
- `mods`;
- `mets`;
- `didl`.

### 5.3 Sets

`ListSets` devolvió 17 sets sin token de continuación.

El set de interés es:

`Tesis` → `col_123456789_6`

### 5.4 Universo OAI general

La llamada general a `ListIdentifiers` reportó:

`completeListSize=2829`

De nuevo, este número corresponde al repositorio OAI general, no a la colección de tesis.

### 5.5 Inconsistencia de formatos cualificados

En el primer registro general muestreado:

- `oai_dc`: HTTP 200;
- `dim`: HTTP 500;
- `xoai`: HTTP 500;
- `qdc`: HTTP 500.

Por tanto:

> `ListMetadataFormats` anuncia formatos que no necesariamente funcionan para un `GetRecord` real.

Este hallazgo obliga a validar cada formato antes de usarlo en T2.

La revisión 1.1 repetirá la prueba sobre un registro específicamente perteneciente al set `Tesis` y probará también `uketd_dc` y `etdms`.

---

## 6. Interoperabilidad declarada por RIUdeG

Los lineamientos públicos de RIUdeG establecen OAI-PMH como estándar de interoperabilidad.

También documentan conceptualmente:

- Dublin Core Cualificado;
- marcas de fecha ISO 8601;
- recolección selectiva `from` / `until`;
- registros eliminados mediante `deletedRecord`;
- resumption tokens;
- sets;
- identificadores persistentes.

El primer probe confirma que varias de esas capacidades están efectivamente activas.

---

## 7. Decisión provisional sobre formato

### RIUdeG

Preferencia provisional:

1. `dim` para metadatos canónicos;
2. `xoai` como fuente complementaria de artefactos/bitstreams;
3. `uketd_dc` / `etdms` sujetos a la segunda prueba;
4. `oai_dc` como fallback mínimo.

### UDGVirtual

Todavía no se fija formato.

`oai_dc` funciona, pero puede perder qualifiers críticos.

La segunda prueba debe decidir si `uketd_dc` o `etdms` ofrecen una ruta estable para tesis. Si ningún formato cualificado funciona, T2 necesitará combinar OAI para enumeración/incrementales con otra fuente pública de metadatos detallados, manteniendo procedencia explícita.

---

## 8. Implicaciones para T2

Ya pueden congelarse varias decisiones:

1. nunca añadir `www` al endpoint RIUdeG por normalización de URL;
2. harvest incremental de RIUdeG debe contemplar borrados `transient`;
3. UDGVirtual permite borrados `persistent`;
4. los sets deben conservarse como evidencia de pertenencia, no como identidad de programa;
5. DIM de RIUdeG conserva los qualifiers que necesita el contrato T0;
6. el número general de registros OAI no puede usarse como conteo de tesis;
7. los formatos anunciados deben probarse con datos reales antes de depender de ellos;
8. UDGVirtual necesita validación adicional por inconsistencias HTTP 500.

---

## 9. Criterio de cierre de T1

T1 se considera cerrada cuando:

1. endpoint(s) efectivo(s) están verificados;
2. Identify está documentado;
3. formatos están enumerados y probados;
4. sets relevantes están caracterizados;
5. el tamaño OAI del set Tesis está verificado por fuente;
6. una muestra real de tesis conserva los campos necesarios;
7. se conoce la política de borrados;
8. se conoce la granularidad temporal;
9. se conoce el comportamiento del resumption token;
10. existe una matriz inicial de calidad/cobertura;
11. puede diseñarse T2 sin asumir detalles del proveedor.

---

## 10. Referencias públicas consultadas

- RIUdeG, colección Tesis:
  https://www.riudg.udg.mx/handle/20.500.12104/9
- RIUdeG, políticas/interoperabilidad:
  https://www.riudg.udg.mx/info/politicas.jsp
- UDGVirtual, colección Tesis:
  https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6

Consultadas el 1 de noviembre de 2026.
