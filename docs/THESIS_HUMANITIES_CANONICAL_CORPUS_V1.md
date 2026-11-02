# Tesis Humanidades UdeG — Canonical Corpus V1

## Estado

**T2A — núcleo canónico reproducible.**

Esta fase implementa la primera capa ejecutable del corpus de tesis definida en T0 y verificada en T1.

Todavía **no** realiza una cosecha masiva de RIUdeG, no descarga PDFs, no modifica la UI y no publica datos en producción.

El objetivo de T2A es probar que los contratos pueden ejecutarse sobre registros reales sin introducir fusiones agresivas, clasificación temática por intuición o pérdida de procedencia.

---

## 1. Alcance de T2A

T2A implementa:

- adaptador RIUdeG DIM;
- adaptador UDGVirtual JSPUI/Dublin Core;
- `ThesisSourceRecord`;
- preservación del payload mediante hash;
- normalización de texto, idioma, identificadores y fechas;
- `AcademicProgramAuthority` inicial;
- resolución de institución;
- `HumanitiesAdmissionDecision`;
- contribuciones de tesis con roles explícitos;
- identidad canónica mínima;
- registry estable de IDs de trabajo;
- validación estructural;
- fixtures offline;
- smoke test contra ambas fuentes públicas.

No implementa todavía:

- harvest completo;
- persistencia de snapshots completos;
- reconciliación de borrados;
- deduplicación bibliográfica probabilística;
- Author Authority Graph para las personas de tesis;
- embeddings;
- búsqueda;
- atlas;
- Laboratorio.

---

## 2. Archivos

### Implementación

`scripts/thesis/build_canonical_corpus_v1.py`

### Registry institucional inicial

`scripts/thesis/config/program-authority-v1.json`

### Fixtures

- `scripts/thesis/fixtures/riudg-history-dim.xml`
- `scripts/thesis/fixtures/udgvirtual-philosophy.html`

### Tests

`tests/test_thesis_canonical_corpus.py`

### CI

`.github/workflows/thesis-canonical-corpus.yml`

---

## 3. Regla de conservación de fuente

Todo registro entra primero como `SourceRecord`.

El SourceRecord conserva:

- proveedor;
- identificador del proveedor;
- URL de registro cuando existe;
- datestamp cuando existe;
- sets OAI cuando existen;
- valores de metadatos en bruto;
- hash SHA-256 del payload;
- versión del normalizador.

La normalización **no reescribe** el registro de fuente.

---

## 4. Adaptador RIUdeG

Entrada:

`GetRecord(metadataPrefix=dim)`

El parser conserva claves DIM como:

- `dc.title`;
- `dc.contributor.author`;
- `dc.contributor.director`;
- `dc.contributor.codirector`;
- `dc.date.issued`;
- `dc.identifier.uri`;
- `dc.description.abstract`;
- `dc.subject`;
- `dc.language.iso`;
- `dc.type`;
- `dc.degree.name`;
- `dc.degree.department`;
- `dc.degree.grantor`.

La pertenencia a sets OAI se conserva como evidencia de fuente y no se convierte directamente en identidad de programa.

---

## 5. Adaptador UDGVirtual

Entrada:

ficha JSPUI individual.

El parser utiliza exclusivamente metadatos `DC.*` embebidos en `<meta>` como primera capa estructurada.

Campos utilizados actualmente:

- `DC.title`;
- `DC.creator`;
- `DC.contributor`;
- `DC.description`;
- `DC.subject`;
- `DC.language`;
- `DC.type`;
- `DC.publisher`;
- `DC.identifier`;
- `DC.relation`.

Un string como:

`Persona Apellido (Directora de tesis)`

se transforma en una contribución con rol `thesis-director`, preservando el valor original en SourceRecord.

No se agrega a la lista de autores.

---

## 6. Academic Program Authority

La registry V1 contiene únicamente programas humanísticos respaldados por la semilla institucional aprobada en T0.

Cada programa declara:

- ID interno;
- nombre canónico;
- aliases explícitos;
- nivel;
- familia disciplinaria;
- estado de admisión;
- evidencia institucional.

La resolución es exacta después de una normalización ortográfica controlada.

No existe fuzzy matching.

No existe embedding.

No existe clasificación por palabras clave.

### Regla

Un programa no reconocido queda:

`QUARANTINE / unknown-program`

aunque el título, resumen o subject contengan palabras filosóficas, históricas o literarias.

---

## 7. Institution Authority

La Universidad de Guadalajara tiene una autoridad institucional estable:

`institution:udg`

La resolución acepta aliases explícitos y la denominación completa.

Si aparece otra universidad de forma explícita:

`EXCLUDE / external-institution`

Si no puede resolverse la institución:

`QUARANTINE / unresolved-institution`

Esto es especialmente importante para UDGVirtual, cuya colección incluye tesis de instituciones externas.

---

## 8. Humanities Admission Gate

Estados implementados:

- `include`;
- `quarantine`;
- `exclude`.

La fase conserva la posibilidad contractual de ampliar estados más adelante.

### INCLUDE

Requiere simultáneamente:

1. institución confirmada como Universidad de Guadalajara;
2. programa confirmado en AcademicProgramAuthority;
3. `admissionState=include`.

### QUARANTINE

Casos actuales:

- institución desconocida;
- programa ausente;
- programa desconocido;
- contradicción de identidad.

### EXCLUDE

Casos actuales:

- institución externa confirmada;
- programa explícitamente configurado como no humanístico en una revisión futura.

---

## 9. Roles de personas

Roles soportados:

- `thesis-author`;
- `thesis-director`;
- `thesis-codirector`;
- `thesis-advisor`;
- `unknown-thesis-role`.

Toda contribución conserva:

- valor crudo;
- nombre normalizado;
- SourceRecord de origen;
- posición;
- estado de resolución.

T2A **no crea AuthorityPerson**.

La resolución de identidad de personas corresponde a T3.

---

## 10. Fechas

Se conserva:

- `raw`;
- valor normalizado;
- precisión;
- calidad.

Calidades:

- `valid`;
- `suspicious`;
- `invalid`;
- `unknown`.

Ejemplo:

`2107-01-04`

se conserva exactamente y se marca `suspicious`.

No se transforma en otra fecha.

---

## 11. Identidad y deduplicación V1

La política de T2A es deliberadamente minimalista.

### Merge automático permitido

Dos SourceRecord pueden compartir trabajo canónico automáticamente sólo cuando comparten un **Handle normalizado exacto** y no existe un veto fuerte de institución.

### No merge automático

No se fusiona por:

- título igual;
- título parecido;
- mismo autor;
- misma fecha;
- mismo programa;
- similitud semántica.

Un título idéntico sin identificador persistente produce dos trabajos separados.

Si dos registros comparten Handle pero uno confirma UdeG y otro confirma una institución externa, el Handle **no vence el veto**: se conservan dos trabajos separados y las decisiones de identidad quedan `rejected / institution-contradiction-veto`.

Esto protege contra false merge mientras T2B construye evidencia bibliográfica más rica.

---

## 12. IDs de trabajos

Los IDs canónicos tienen forma:

`thesis:work:00000001`

No codifican:

- nombre;
- título;
- Handle;
- URL;
- programa.

La primera construcción asigna IDs secuenciales de forma determinista.

Un build posterior recibe `workIdRegistry` del snapshot anterior y reutiliza el mismo ID para SourceRecord ya conocidos.

Esto evita que la aparición de un identificador nuevo obligue a renombrar una obra ya publicada.

---

## 13. Fixture corpus

El fixture offline contiene:

1. una tesis RIUdeG con estructura DIM de Licenciatura en Historia;
2. una ficha UDGVirtual con estructura Dublin Core de Maestría en Estudios Filosóficos.

Ambas son fixtures estructurales de prueba y deben producir:

- 2 SourceRecord;
- 2 trabajos;
- 2 decisiones INCLUDE;
- cero fusiones;
- roles autor/director separados.

El fixture no pretende representar el corpus completo ni afirmar que esos textos sintéticos son registros bibliográficos reales.

---

## 14. Live smoke

El workflow verifica además dos recursos públicos reales:

### RIUdeG

OAI identifier:

`oai:riudg.udg.mx:20.500.12104/112380`

Se comprueba:

- respuesta DIM;
- título presente;
- programa extraíble;
- institución;
- director cuando existe;
- decisión de admisión resultante.

### UDGVirtual

Handle:

`123456789/4102`

Se comprueba:

- ficha JSPUI disponible;
- Dublin Core presente;
- título;
- programa extraíble cuando la descripción lo permite;
- institución resoluble o cuarentena explícita;
- director cuando está etiquetado.

El smoke no convierte un fallo de resolución en una clasificación inventada.

Resultado observado en el primer run T2A:

- RIUdeG `112380`: programa `LICENCIATURA EN HISTORIA` resuelto, institución UdeG confirmada, director presente, `INCLUDE`;
- UDGVirtual `4102`: programa `Maestría en Gestión del Aprendizaje en Ambientes Virtuales` no presente en la registry humanística inicial, institución otorgante no confirmada por los metadatos usados, director presente, `QUARANTINE`.

Este resultado es intencional: la segunda ficha demuestra que el Admission Gate prefiere incertidumbre explícita a una inclusión inventada.

---

## 15. Gates implementados

El validador falla si:

- se duplican SourceRecord IDs;
- se duplican work IDs;
- existe una referencia a SourceRecord inexistente;
- un trabajo INCLUDE carece de `programRef`;
- un trabajo INCLUDE no pertenece a `institution:udg`.

Los tests cubren además:

- director separado de autor;
- programa desconocido → cuarentena;
- universidad externa → exclusión;
- fecha anómala preservada;
- merge por Handle exacto sin vetos;
- veto institucional incluso con Handle exacto;
- no merge por título idéntico;
- reutilización de work ID;
- build fixture válido.

---

## 16. Decisiones aplazadas a T2B

T2B deberá añadir:

- harvester incremental RIUdeG;
- paginación por resumption token;
- reconciliación por `deletedRecord=transient`;
- enumerador exacto 147 UDGVirtual;
- snapshots de source records;
- CoverageLedger;
- catálogo real de programas observados;
- candidatos de equivalencia histórica;
- política de REVIEW;
- deduplicación con evidencia fuerte adicional;
- first real humanities corpus sample.

T2B no deberá saltarse el Admission Gate creado en T2A.

---

## 17. Seguridad operacional

Los adaptadores utilizan sólo fuentes públicas.

No requieren credenciales de estudiante ni sesión institucional.

Ninguna credencial debe incorporarse a:

- código;
- fixtures;
- actions;
- secrets del repositorio para esta fase;
- logs;
- artefactos;
- datasets.

---

## 18. Criterio de cierre T2A

T2A queda cerrada cuando:

1. tests offline pasan;
2. fixture corpus se construye y valida;
3. live smoke pasa con ambas fuentes;
4. registry no presenta colisiones de aliases;
5. PR contiene sólo archivos del subsistema de tesis;
6. rama está reconciliada con main;
7. no hay cambios de runtime o producción.

Después puede comenzar T2B.


---

## 19. Regresiones incorporadas desde la primera muestra real T2B

La primera muestra real de T2B descubrió tres casos que se incorporan a T2A antes del merge.

### 19.1 Fechas `DD/MM/YYYY`

RIUdeG contiene fechas como:

- `31/12/1969`;
- `01/04/2018`;
- `22/06/2017`.

Ahora se normalizan a ISO conservando el valor raw.

Ejemplo:

`31/12/1969` → `1969-12-31`

Un número anómalo de cinco o más dígitos como `37812` no se interpreta como año ni como fecha Excel: se conserva raw y se marca `suspicious`.

### 19.2 Objetos no-tesis dentro de UDGVirtual

Se observó un item de la colección con:

`DC.type = Book chapter`

La pertenencia a la colección no vence el tipo explícito.

Ahora:

`non-thesis → reject-source / not-a-thesis`

No entra al corpus de tesis aunque permanezca documentado como SourceRecord.

### 19.3 Instituciones externas en contributor

Se observó un registro UDGVirtual con:

`DC.contributor = Universidad de las Américas Puebla`

Un contributor sin etiqueta de rol que tenga forma institucional se evalúa como evidencia de institución, no como persona.

Si confirma una universidad externa:

`EXCLUDE / external-institution`

### 19.4 Evidencia institucional más estricta

Los textos libres de `DC.description` y la relación genérica `UDGVirtual` ya no se utilizan como prueba de institución otorgante.

Esto evita casos donde una descripción arbitraria terminaba almacenada como `institutionRaw`.

La institución otorgante debe derivarse de evidencia institucional explícita o de una autoridad de programa suficientemente fuerte en una fase posterior.


### 19.5 Componentes de fecha en cero

La segunda muestra T2B observó valores históricos como:

- `1991-00-00`;
- `1995-10-00`.

Estos valores no se tratan como fechas inválidas ni se completan artificialmente.

Reglas:

- `YYYY-00-00` → precisión `year`, valor normalizado `YYYY`;
- `YYYY-MM-00` → precisión `month`, valor normalizado `YYYY-MM`;
- el valor raw original se conserva siempre.

Un componente imposible como `YYYY-00-DD` permanece inválido.


---

## 20. Conflictos de rol persona — evidencia real de full harvest

El primer intento de inventario completo encontró un registro donde el mismo nombre normalizado aparece simultáneamente como:

- `thesis-author`;
- `thesis-director`.

Nombre observado:

`Ceja Mejia Oscar Eduardo`

La versión anterior trataba cualquier colisión autor/supervisor como error estructural global y abortaba el corpus completo.

Ese comportamiento era demasiado rígido para metadatos históricos reales.

### Política corregida

La colisión ya **no se resuelve por adivinación** y tampoco invalida todo el corpus.

El trabajo conserva ambas contribuciones exactamente como fueron observadas y añade:

`metadataQualityFlags = ["author-supervisor-name-collision"]`

Además crea `contributionConflicts` con:

- nombre normalizado;
- roles observados;
- contribuciones afectadas;
- SourceRecord de procedencia;
- directiva `do-not-auto-resolve`.

Todas las contribuciones afectadas quedan con:

`resolutionState = "blocked-role-conflict"`

### Consecuencia para Author Authority

El mismo string de nombre **no puede convertirse automáticamente en una única AuthorityPerson** mientras exista esta contradicción de rol.

Una fase de resolución posterior debe revisar evidencia adicional o mantener la ambigüedad.

### Gate

El validador sigue siendo estricto, pero ahora valida la representación del conflicto:

1. toda colisión autor/supervisor debe aparecer en `contributionConflicts`;
2. debe existir el quality flag correspondiente;
3. las contribuciones afectadas deben estar bloqueadas para resolución automática;
4. no se permite ocultar ni eliminar uno de los dos roles para hacer pasar la validación.

Este cambio convierte una anomalía de fuente en evidencia auditable en lugar de un fallo global.


---

## 21. Fecha sentinela de epoch observada en RIUdeG

El primer inventario completo reveló un patrón que no podía detectarse en las
muestras pequeñas:

- `1969-12-31`: 381 trabajos;
- `31/12/1969`: 180 trabajos;
- total: **561 trabajos**.

La concentración exacta en la víspera del Unix epoch es evidencia de un valor
sentinela/default del repositorio y no de 561 eventos académicos ocurridos el
mismo día.

### Política

Los dos valores se conservan sin reescribir:

- `raw` permanece intacto;
- el valor normalizado puede seguir siendo `1969-12-31`;
- precisión: `day`;
- calidad: `suspicious`.

No se sustituye por una fecha estimada.

No se borra el trabajo.

### Consecuencia

Una fecha sentinela no puede participar como evidencia temporal confiable en:

- spans históricos;
- observedFrom / observedUntil;
- orden cronológico de curaduría;
- inferencias de predecessor/successor;
- visualizaciones temporales que exijan fechas válidas.

Program Curation Queue ya utiliza exclusivamente fechas con
`quality=valid`, por lo que al corregir la calidad estos 561 valores dejan de
crear antigüedad falsa sin necesidad de introducir excepciones en la cola.

### Motivación inmediata

La anomalía apareció al revisar la familia cultura/gestión cultural:

- Maestría en Gestión y Desarrollo Cultural contenía múltiples
  `31/12/1969`;
- Maestría en Gestión de la Cultura también contenía una observación
  `1969-12-31`.

El fix se mantiene separado de la decisión disciplinaria de esos programas.
