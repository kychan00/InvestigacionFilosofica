# Tesis Humanidades UdeG — Source Reconnaissance V1

## Estado

**T1 — reconnaissance cerrada.**

Esta fase verificó las fuentes antes de construir el harvester y el corpus canónico.

No cosecha todavía el corpus completo, no descarga PDFs, no modifica runtime y no publica un dataset de tesis.

La conclusión principal es que las dos fuentes necesitan **adaptadores diferentes**:

- **RIUdeG**: OAI-PMH robusto, con DIM como formato canónico candidato y XOAI como enriquecimiento de archivos.
- **UDGVirtual**: OAI útil para descubrir capacidades, pero defectuoso para cosechar tesis; la ruta estable es JSPUI HTML con browse ligado a la colección + Dublin Core embebido en cada ficha.

---

## 1. Objetivo y límites

T1 debía verificar empíricamente:

- endpoint OAI-PMH;
- `Identify`;
- formatos de metadatos;
- sets;
- identificadores;
- resumption tokens;
- granularidad temporal;
- política `deletedRecord`;
- preservación de metadatos cualificados;
- capacidad de enumerar el subconjunto de tesis;
- capacidad de obtener una ficha de tesis real.

El probe es de sólo lectura. No descarga bitstreams ni PDFs.

---

## 2. Probe reproducible

Archivos:

- `scripts/thesis/probe_oai.py`
- `.github/workflows/thesis-source-recon.yml`

El probe evolucionó durante T1 conforme aparecieron incompatibilidades reales. La revisión final de esta fase es `thesis-source-recon-v1.8`.

Run final verificado:

- workflow run: `41341798926`;
- conclusión: `success`;
- head: `0b4f312f63507874749d3bf196eb2e738c3757b9`;
- artifact: `thesis-source-recon`;
- artifact ID: `13097328744`;
- SHA-256 del ZIP: `31485b9e16bdaef0996cdbbbb8bca8de9646ccdc12ef550f7840616398293e5a`.

El probe final:

- recorre `ListSets` con límite defensivo;
- no recorre masivamente `ListRecords`;
- sólo intenta un fallback de encabezados en repositorios pequeños cuando el set OAI está roto;
- prueba una tesis pública representativa por fuente;
- inspecciona formatos OAI relevantes;
- inspecciona JSPUI y rutas de browse de UDGVirtual;
- inspecciona Dublin Core embebido en HTML;
- prueba feeds y REST sin asumir que existen.

### 2.1 Corrección de instrumentación durante T1

Una revisión intermedia reportó cero handles en HTML por un error del propio probe: las expresiones regulares quedaron con doble escape y buscaban literalmente `\\d` / `\\s`.

La revisión 1.6 corrigió el error y volvió a ejecutar el mismo reconocimiento.

Este incidente no se atribuye a UDGVirtual y se conserva como recordatorio metodológico:

> un resultado negativo de reconnaissance no se convierte en propiedad de la fuente hasta validar primero el instrumento.

---

# 3. RIUdeG

## 3.1 Endpoint OAI efectivo

Endpoint verificado:

`https://riudg.udg.mx/oai/request`

La variante:

`https://www.riudg.udg.mx/oai/request`

devolvió HTTP 404.

La interfaz web ordinaria puede utilizar `www`, pero el endpoint OAI no debe canonicalizarse añadiéndolo.

---

## 3.2 Identify

Valores verificados:

- `repositoryName = RIUdeG`;
- `protocolVersion = 2.0`;
- `baseURL = https://riudg.udg.mx/oai/request`;
- `earliestDatestamp = 2015-09-07T23:36:42Z`;
- `deletedRecord = transient`;
- `granularity = YYYY-MM-DDThh:mm:ssZ`.

### Consecuencia de `transient`

El harvester de T2 no puede asumir que un registro eliminado seguirá anunciado para siempre.

La política futura debe combinar:

- incrementales por datestamp;
- ventanas solapadas;
- reconciliaciones periódicas completas;
- persistencia local de tombstones/decisiones;
- comparación contra snapshot anterior.

---

## 3.3 Formatos anunciados

RIUdeG anuncia:

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

Que un formato esté anunciado no implica que cada item pueda diseminarse en él.

En la tesis representativa probada, `uketd_dc` respondió con OAI `cannotDisseminateFormat`, mientras otros formatos sí funcionaron.

---

## 3.4 Sets

El catálogo completo de `ListSets` contiene **145 sets**.

Sets relevantes:

- `Tesis` → `com_20.500.12104_9`;
- `Doctorado` → `com_20.500.12104_20527`;
- `Especialidad` → `com_20.500.12104_20528`;
- `Licenciatura` → `com_20.500.12104_20529`;
- `Maestría` → `com_20.500.12104_20530`;
- `Técnico Superior` → `com_20.500.12104_20531`;
- `Tesis de otras universidades` → `com_20.500.12104_20532`.

También existen sets por centros y colecciones.

Un encabezado puede pertenecer simultáneamente a varios `setSpec`. Esa pertenencia se conserva como evidencia de fuente; no reemplaza `AcademicProgramAuthority`.

---

## 3.5 Tamaño del set Tesis

`ListIdentifiers` restringido a:

`set=com_20.500.12104_9`

respondió correctamente y reportó:

**`completeListSize = 27431`**

La interfaz pública consultada durante T1 mostraba:

**27,425**

La diferencia de seis registros no se corrige ni se fuerza artificialmente.

Puede deberse, entre otros casos, a:

- desfase entre índices;
- registros transitorios/eliminados;
- diferencias de criterio entre vista y OAI;
- actualización concurrente.

T2 debe registrar ambos conteos y explicar la diferencia a partir de los encabezados reales antes de publicar métricas definitivas.

El universo OAI general, sin restringir a Tesis, reportó `completeListSize=57696`; este valor **no es** el tamaño del corpus de tesis.

---

## 3.6 Tesis representativa

Fixture público:

`oai:riudg.udg.mx:20.500.12104/112380`

Corresponde a una tesis de Licenciatura en Historia del CUCSH.

Resultados por formato:

- `oai_dc`: HTTP 200;
- `dim`: HTTP 200;
- `xoai`: HTTP 200;
- `qdc`: HTTP 200;
- `uketd_dc`: OAI `cannotDisseminateFormat`;
- `etdms`: HTTP 200;
- `mods`: HTTP 200.

---

## 3.7 DIM como formato canónico candidato

DIM preservó qualifiers necesarios para el contrato T0, incluyendo en la muestra:

- `dc.contributor.author`;
- `dc.contributor.director`;
- `dc.date.issued`;
- `dc.identifier.uri`;
- `dc.description.abstract`;
- `dc.subject`;
- `dc.title`;
- `dc.type`;
- `dc.type.conacyt`;
- `dc.degree.name`;
- `dc.degree.department`;
- `dc.degree.grantor`;
- `dc.degree.creator`;
- idioma y otros metadatos.

**Decisión T1: DIM es la fuente primaria candidata para el harvester RIUdeG de T2.**

`oai_dc` queda como fallback mínimo de interoperabilidad, no como contrato canónico.

---

## 3.8 XOAI como enriquecimiento

XOAI expuso, además de metadatos:

- nombre de bitstream;
- media type;
- tamaño;
- URL;
- checksum;
- algoritmo de checksum;
- Handle;
- fecha de modificación;
- identificador OAI.

**Decisión T1: XOAI puede alimentar `ThesisFileArtifact` de forma complementaria.**

No es necesario utilizarlo para decidir identidad bibliográfica si DIM ya contiene la información canónica suficiente.

---

# 4. UDGVirtual

## 4.1 Endpoint OAI efectivo

Endpoint que responde `Identify`:

`https://biblioteca.udgvirtual.udg.mx/oai/request`

Valores declarados:

- `repositoryName = Repositorio UDGVirtual`;
- `protocolVersion = 2.0`;
- `earliestDatestamp = 2015-11-21T00:02:24Z`;
- `deletedRecord = persistent`;
- `granularity = YYYY-MM-DDThh:mm:ssZ`.

El servidor declara como `baseURL`:

`http://148.202.167.116:8080/oai/request`

y como correo administrativo:

`dspace-help@myu.edu`.

Estos datos parecen configuración interna o por defecto y **no se usan como canonical URL ni como evidencia institucional**.

---

## 4.2 Capacidades OAI anunciadas

UDGVirtual anuncia múltiples formatos, entre ellos:

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

`ListSets` funciona y devuelve 17 sets.

Set:

`Tesis` → `col_123456789_6`

El universo general de la primera llamada a `ListIdentifiers` reportó:

`completeListSize=2829`.

---

## 4.3 OAI de tesis defectuoso

Las capacidades de descubrimiento no se traducen en un camino de cosecha funcional.

Se verificaron los siguientes fallos:

### Set Tesis

`ListIdentifiers&set=col_123456789_6`

→ HTTP 500.

### Paginación general

La primera página general de `ListIdentifiers` funciona.

El resumption token para la segunda página:

→ HTTP 500.

### Tesis pública conocida

Fixture:

`oai:biblioteca.udgvirtual.udg.mx:123456789/4102`

Todos los formatos probados devolvieron HTTP 500:

- `oai_dc`;
- `dim`;
- `xoai`;
- `qdc`;
- `uketd_dc`;
- `etdms`;
- `mods`.

**Decisión T1: el OAI de UDGVirtual no se utilizará como transporte de cosecha de tesis en T2.**

Se conserva únicamente como evidencia de capacidades/sets y para futuras regresiones.

---

## 4.4 REST antiguo

Se probaron rutas DSpace REST antiguas:

- `/rest/status`;
- `/rest/handle/123456789/4102`;
- `/rest/items?limit=1`.

Todas devolvieron HTTP 404.

**Decisión T1: no existe una ruta REST pública utilizable de este tipo.**

---

## 4.5 JSPUI HTML

Las páginas públicas JSPUI responden correctamente.

Colección:

`https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6`

La interfaz declara:

**147 tesis**

y pagina correctamente.

Las páginas de colección con offsets distintos devuelven items diferentes.

---

## 4.6 Enumeración exacta mediante browse ligado al Handle

Ruta verificada:

`/jspui/handle/123456789/6/browse?type=title&rpp=100&sort_by=1&order=ASC`

Primera página:

- 100 handles de tesis;
- además aparecen los handles estructurales `5` y `6`, que deben filtrarse.

Segunda página:

`...&offset=100`

- 47 handles de tesis;
- más los handles estructurales `5` y `6`.

Resultado:

- primera página: 100 tesis;
- segunda página: 47 tesis;
- intersección entre ambas: 0;
- unión: **147 tesis**.

Esto coincide exactamente con el total declarado por la colección pública.

**Decisión T1: ésta es la ruta canónica de enumeración para UDGVirtual T2.**

---

## 4.7 Falso scope en browse genérico

Se probó también:

`/jspui/browse?type=title&scope=123456789/6...`

La petición devuelve HTTP 200, pero el parámetro `scope` no restringe realmente la salida como se esperaba.

Dos páginas de 100 resultados produjeron 200 handles distintos, superando el universo de 147 tesis.

**Decisión T1: el browse genérico con `scope` queda explícitamente prohibido como enumerador de la colección.**

Un endpoint que devuelve HTTP 200 no se considera correcto sin una prueba de contenido.

---

## 4.8 Dublin Core embebido en las fichas

La tesis pública `123456789/4102` responde HTTP 200 en JSPUI y contiene metadatos en etiquetas HTML `<meta name="DC.*">`.

Campos encontrados:

- `DC.creator`;
- `DC.contributor`;
- `DC.description`;
- `DC.identifier`;
- `DC.language`;
- `DC.relation`;
- `DC.subject`;
- `DC.title`;
- `DC.type`.

Ejemplo de rol:

`DC.contributor = Chávez Blanco, Blanca Estela (Directora de tesis)`

Ejemplo de grado en descripción:

`Documento de titulación para obtener el grado de Maestría en Gestión del Aprendizaje en Ambientes Virtuales`

El Handle se conserva en `DC.identifier`.

**Decisión T1: T2 utilizará Dublin Core embebido como primera capa de extracción de cada ficha UDGVirtual, complementado sólo con campos visibles necesarios que no estén presentes en esas metas.**

Los roles incrustados en strings se preservan primero como raw values y posteriormente se normalizan mediante `ThesisContribution` / Author Authority.

---

## 4.9 Feeds

RSS y Atom funcionan, pero sólo expusieron un subconjunto pequeño de handles recientes en el probe.

No son exhaustivos.

**Decisión T1: pueden servir como señal auxiliar futura, nunca como enumerador canónico.**

---

# 5. Matriz de capacidades

| Fuente | Enumeración de tesis | Metadatos ricos | Incremental | Borrados | Ruta T2 |
| --- | --- | --- | --- | --- | --- |
| RIUdeG OAI | Sí · set `com_20.500.12104_9` | Sí · DIM | Sí · datestamps/resumption | `transient` | **Primaria** |
| RIUdeG XOAI | Por item | Sí + bitstreams | Ligado a OAI | hereda OAI | Complementaria |
| UDGVirtual OAI | **No confiable** · HTTP 500 en set/paginación | **No confiable** en tesis | No utilizable actualmente | declara `persistent` | Sólo diagnóstico |
| UDGVirtual JSPUI browse | Sí · 100 + 47 = 147 | IDs/links | Snapshot/paginación | no contrato OAI | **Enumeración primaria** |
| UDGVirtual JSPUI item | Por Handle | Sí · `DC.*` + HTML | Relectura por snapshot | no tombstone formal | **Metadatos primarios** |
| UDGVirtual REST viejo | No · 404 | No | No | No | Excluir |
| UDGVirtual RSS/Atom | Parcial | Parcial | Sí para recientes | No | Auxiliar |

---

# 6. Política T2 derivada

T2 debe implementar dos adaptadores independientes.

## 6.1 RIUdeG adapter

Pipeline objetivo:

    OAI Tesis set
        ↓
    headers + datestamps
        ↓
    DIM SourceRecord
        ↓
    XOAI opcional
        ↓
    canonical thesis normalization

Requisitos:

- checkpoint de resumption token;
- ventanas incrementales solapadas;
- snapshot anterior preservado ante fallo;
- reconciliación periódica por `deletedRecord=transient`;
- conteos y hashes;
- rate limiting;
- retry/backoff;
- fixtures reales.

## 6.2 UDGVirtual adapter

Pipeline objetivo:

    collection-bound JSPUI browse
        ↓
    handles 100 + 47
        ↓
    item HTML
        ↓
    DC meta + campos visibles estrictamente necesarios
        ↓
    SourceRecord
        ↓
    InstitutionAuthority + HumanitiesAdmissionGate

Requisitos:

- enumerar sólo `/handle/123456789/6/browse`;
- comprobar total declarado;
- deduplicar handles;
- bloquear si unión != total esperado sin explicación;
- conservar HTML/source hash;
- petición pausada y limitada;
- no descargar archivos;
- no usar generic browse `scope`;
- no depender de OAI roto;
- resolver institución porque la colección incluye universidades externas.

---

# 7. Alcance Humanidades

T1 refuerza la decisión de T0:

> Humanidades UdeG no equivale a CUCSH.

Se observó públicamente una tesis de Licenciatura en Antropología asociada con CUNORTE.

Por tanto, T2 debe construir el registro de programas y unidades a partir de evidencia institucional y registros reales de la Red UdeG, no de una whitelist rígida limitada al CUCSH contemporáneo.

---

# 8. Fechas y calidad

Las facetas públicas de RIUdeG presentan valores anómalos, incluyendo rangos anteriores al año 1000 y uno que alcanza 2107.

T2 debe conservar:

- valor crudo;
- valor normalizado;
- precisión;
- `dateQuality`.

Una anomalía puede excluirse de una visualización temporal sin borrar ni reescribir el SourceRecord.

---

# 9. Criterios de cierre T1

Todos los criterios quedaron cubiertos:

1. endpoints efectivos identificados;
2. `Identify` documentado;
3. formatos enumerados y probados con items reales;
4. sets caracterizados;
5. subconjunto Tesis cuantificado por la ruta viable de cada fuente;
6. muestras reales inspeccionadas;
7. política de borrados conocida donde OAI es utilizable;
8. granularidad conocida;
9. resumption behavior probado, incluidos fallos reales;
10. matriz de capacidades documentada;
11. transporte T2 decidido por fuente;
12. no quedan supuestos críticos sobre cómo enumerar u obtener metadatos.

**Resultado: T1 = PASS.**

---

# 10. No decisiones de T1

T1 no decide todavía:

- qué programas exactos forman la primera release humanística;
- normalización completa de programas históricos;
- deduplicación masiva;
- modelo físico final del snapshot;
- frecuencia de harvest;
- modelo de embeddings;
- atlas;
- UI.

Esas decisiones comienzan en T2 y fases posteriores.

---

# 11. Referencias públicas

Consultadas el 1 de noviembre de 2026:

- RIUdeG, colección Tesis:
  https://www.riudg.udg.mx/handle/20.500.12104/9
- RIUdeG, políticas/interoperabilidad:
  https://www.riudg.udg.mx/info/politicas.jsp
- UDGVirtual, colección Tesis:
  https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6
- UDGVirtual, tesis fixture:
  https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/4102
