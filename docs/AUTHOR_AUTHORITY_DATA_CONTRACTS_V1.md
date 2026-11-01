# Author Authority — Contratos de datos V1

## Estado

**Fase 2 — contratos conceptuales.**

Este documento convierte la arquitectura definida en `AUTHOR_AUTHORITY_ARCHITECTURE_V1.md` en contratos de datos explícitos. No implementa todavía el runtime, no cambia la interfaz, no publica un nuevo índice y no introduce nuevas fuentes.

El objetivo de esta fase es que las siguientes implementaciones tengan un lenguaje común y verificable. Cada módulo futuro debe poder producir, consumir o transformar estas entidades sin volver a inventar qué significa «autor», «obra», «evidencia» o «cobertura».

---

## 1. Principios del contrato

### 1.1 Identidad interna estable

Las entidades canónicas de Investigación Filosófica deben usar IDs internos opacos y persistentes.

Un `AuthorityPerson` no puede usar como ID primario:

- el nombre;
- el ORCID;
- el ID de OpenAlex;
- el DOI de una obra;
- una afiliación.

Esos valores pueden cambiar, corregirse o desaparecer. El ID interno debe sobrevivir a esos cambios.

### 1.2 Procedencia obligatoria

Toda afirmación que pueda modificar identidad, atribución o agrupación bibliográfica debe poder rastrearse a:

- uno o más `SourceRecord`;
- una decisión curada;
- una regla reproducible del algoritmo;
- o una combinación de lo anterior.

### 1.3 Las entidades fuente son inmutables

`SourceRecord` conserva lo que una fuente afirmó en una revisión concreta.

Las correcciones no reescriben el registro original. Se representan mediante nuevas normalizaciones, evidencias o decisiones.

### 1.4 Las decisiones son versionadas

Una decisión no es «verdad eterna».

Debe registrar:

- versión del algoritmo;
- versión/revisión de datos;
- evidencia utilizada;
- fecha;
- modo de decisión;
- estado resultante.

Una reconstrucción posterior puede reemplazar una decisión, pero no debe borrar su historial.

### 1.5 No existe un porcentaje universal de certeza

El sistema puede utilizar medidas internas para ordenar candidatos, pero el contrato público de resolución se expresa mediante estados discretos y evidencia trazable.

Una cifra como `92%` no sustituye:

- `confirmed`;
- `probable`;
- `ambiguous`;
- `unresolved`;
- `rejected`.

---

## 2. Convenciones comunes

Todas las entidades canónicas comparten conceptualmente:

- `schemaVersion`: versión del contrato;
- `entityType`: tipo de entidad;
- `id`: ID interno estable;
- `createdInRevision`: revisión en la que apareció por primera vez;
- `lastEvaluatedInRevision`: última reconstrucción que la evaluó;
- `evidenceRefs`: referencias a evidencia relevante cuando corresponda;
- `decisionRefs`: decisiones que afectan el estado de la entidad;
- `sourceRecordRefs`: registros fuente que la sustentan cuando corresponda.

Las referencias internas deben apuntar a IDs del Authority Graph, no a URLs volátiles de proveedores.

---

# 3. AuthorityPerson

## 3.1 Propósito

Representa una **persona bibliográfica canónica** dentro de Investigación Filosófica.

No representa un texto de nombre ni un perfil de un proveedor.

## 3.2 Campos conceptuales

### Identidad

- `id`: ID interno estable.
- `canonicalName`: nombre preferido para presentación.
- `lifecycleState`:
  - `active`;
  - `merged`;
  - `split`;
  - `redirect`;
  - `retired`.
- `resolutionState`:
  - `confirmed`;
  - `probable`;
  - `ambiguous`;
  - `unresolved`.

Una autoridad `rejected` no debe existir como persona canónica; el rechazo pertenece a la decisión que impidió crearla o enlazarla.

### Nombres

- `names`: colección de `NameAssertion`.
- `canonicalNameRef`: referencia a la forma elegida como presentación.

### Identificadores

- `externalIdentifiers`: colección de `ExternalIdentifierAssertion`.

### Contexto bibliográfico

- `affiliations`: colección de `AffiliationAssertion`.
- `activeRange`: intervalo observado, nunca biografía inferida.
- `topicSignals`: temas observados en obras confirmadas.
- `collaborationRefs`: relaciones derivadas, no prueba primaria de identidad.

### Historial

- `mergedFrom`: autoridades absorbidas.
- `redirectTo`: autoridad canónica si esta entidad fue fusionada.
- `splitFrom`: autoridad histórica de la que se separó.
- `supersededBy`: nuevas autoridades derivadas de un split.

## 3.3 Invariantes

1. El ID no cambia al añadir ORCID.
2. El ID no cambia al modificar el nombre canónico.
3. Una autoridad fusionada nunca se elimina físicamente.
4. Una autoridad dividida conserva trazabilidad hacia sus descendientes.
5. Un nombre idéntico no obliga a fusionar personas.
6. Una persona puede tener varias afiliaciones simultáneas.
7. Una afiliación diferente no es, por sí sola, prueba de homonimia.

---

# 4. AuthorMention

## 4.1 Propósito

Representa una aparición concreta de un creador o participante en un `SourceRecord`.

Ejemplos:

- «Dinora Hernández López»;
- «D. Hernández»;
- «Hernández López, Dinora»;
- una cadena colectiva de coordinadores.

## 4.2 Campos conceptuales

- `id`;
- `sourceRecordRef`;
- `rawValue`: texto exacto del proveedor;
- `normalizedValue`;
- `parsedName`:
  - nombres;
  - apellidos;
  - iniciales;
  - partículas;
  - sufijos;
- `rawRole`: rol tal como aparece en la fuente;
- `normalizedRoleCandidate`;
- `position`: orden de aparición cuando exista;
- `embeddedIdentifiers`: ORCID u otros IDs presentes en la misma mención;
- `isCompositeStatement`: indica una cadena que puede contener varias personas;
- `candidateAuthorityRefs`;
- `resolutionDecisionRef`.

## 4.3 Invariantes

1. El texto original nunca se reemplaza por la forma normalizada.
2. Una mención puede permanecer sin resolver.
3. Una mención puede tener varios candidatos.
4. Una mención compuesta no se convierte artificialmente en una sola persona.
5. Una coincidencia temática o en título no crea `AuthorMention` de autoría.

---

# 5. ExternalIdentifierAssertion

## 5.1 Propósito

Representa la afirmación de que una autoridad o entidad bibliográfica posee un identificador externo.

## 5.2 Campos conceptuales

- `id`;
- `subjectRef`;
- `scheme`:
  - `orcid`;
  - `openalex-author`;
  - `wikidata`;
  - `doi`;
  - `isbn`;
  - `institutional`;
  - otros esquemas futuros;
- `rawValue`;
- `normalizedValue`;
- `scope`: persona, obra, versión o registro;
- `status`:
  - `asserted`;
  - `verified`;
  - `conflicted`;
  - `deprecated`;
- `sourceRecordRefs`;
- `evidenceRefs`.

## 5.3 Reglas

- Dos ORCID distintos ligados de forma explícita a dos candidatos son veto de fusión automática.
- Un ORCID idéntico es evidencia de máxima fuerza, pero debe conservarse la procedencia que lo afirmó.
- Un identificador corrupto no debe reemplazar silenciosamente a uno verificado.

---

# 6. IntellectualWork

## 6.1 Propósito

Representa la **obra intelectual canónica**, no un registro concreto de proveedor.

Puede representar, según la naturaleza documental:

- artículo;
- libro;
- capítulo;
- reseña;
- entrada enciclopédica;
- prólogo;
- ponencia publicada;
- traducción como objeto intelectual;
- otros tipos documentados.

## 6.2 Campos conceptuales

- `id`;
- `canonicalTitle`;
- `alternativeTitles`;
- `workType`;
- `firstObservedDate`;
- `datePrecision`;
- `languages`;
- `topicSignals`;
- `versionRefs`;
- `contributionRefs`;
- `sourceRecordRefs`;
- `resolutionDecisionRefs`.

## 6.3 Invariantes

1. Un DOI no es necesariamente el ID interno de la obra.
2. Dos registros con el mismo DOI suelen apuntar a la misma versión bibliográfica, pero se conserva cada registro fuente.
3. Dos ISBN distintos pueden ser versiones distintas de la misma obra intelectual.
4. Título similar por sí solo no prueba identidad de obra.
5. Una obra puede existir aunque algunas de sus versiones no estén resueltas.

---

# 7. WorkVersion

## 7.1 Propósito

Representa una manifestación, edición o versión bibliográfica de una `IntellectualWork`.

## 7.2 Campos conceptuales

- `id`;
- `workRef`;
- `titleAsPublished`;
- `editionStatement`;
- `versionType`:
  - `original`;
  - `edition`;
  - `reissue`;
  - `translation`;
  - `preprint`;
  - `accepted-manuscript`;
  - `published-version`;
  - `digital-edition`;
  - `unknown`;
- `publicationDate`;
- `datePrecision`;
- `language`;
- `containerTitle`;
- `volume`;
- `issue`;
- `pages`;
- `publisher`;
- `identifiers`;
- `urls`;
- `sourceRecordRefs`.

## 7.3 Invariantes

1. No se inventa día o mes cuando sólo existe año.
2. Un ISBN diferente no obliga a crear una obra intelectual distinta.
3. Una traducción puede ser versión de una obra previa y a la vez contener una contribución intelectual de traducción.
4. La relación entre versiones debe poder quedar `unresolved`.

---

# 8. Contribution

## 8.1 Propósito

Representa la relación entre una `AuthorityPerson` y una `IntellectualWork` o `WorkVersion`.

Ésta es la entidad que permite dejar de reducir toda participación a «autor».

## 8.2 Campos conceptuales

- `id`;
- `authorityRef`;
- `workRef`;
- `versionRef` opcional;
- `role`:
  - `author`;
  - `coauthor`;
  - `editor`;
  - `coordinator`;
  - `compiler`;
  - `translator`;
  - `prologue`;
  - `introduction`;
  - `reviewer`;
  - `contributor`;
  - `unknown`;
- `position` cuando la fuente lo documenta;
- `roleCertainty`:
  - `explicit`;
  - `normalized`;
  - `inferred`;
  - `unknown`;
- `resolutionState`:
  - `confirmed`;
  - `probable`;
  - `ambiguous`;
  - `unresolved`;
  - `rejected`;
- `mentionRefs`;
- `evidenceRefs`;
- `sourceRecordRefs`;
- `decisionRef`.

## 8.3 Invariantes

1. Un campo de creador con un solo nombre no demuestra autoría individual.
2. Una obra colectiva puede contener varios tipos de contribución.
3. Un rol explícito de coordinador no se normaliza a autor.
4. Una contribución rechazada se conserva como decisión histórica, pero no aparece como producción confirmada.
5. Las estadísticas del perfil deben derivarse de contribuciones resueltas, no de coincidencias textuales.

---

# 9. SourceRecord

## 9.1 Propósito

Representa lo que una fuente concreta afirmó en un momento o revisión concretos.

## 9.2 Campos conceptuales

- `id`;
- `provider`;
- `providerRecordId`;
- `providerRevision`;
- `retrievedAt` o revisión de snapshot;
- `recordUrl`;
- `payloadHash`;
- `rawTitle`;
- `rawCreators`;
- `rawDate`;
- `rawIdentifiers`;
- `rawType`;
- `rawContainer`;
- `rawPublisher`;
- `rawLanguage`;
- `rawUrls`;
- `normalizationVersion`.

## 9.3 Reglas

- El registro original es inmutable.
- Una corrección posterior crea una nueva revisión o nuevo registro.
- La deduplicación nunca destruye SourceRecord.
- Una fuente puede contradecir a otra y ambas deben permanecer disponibles para explicar la decisión.

---

# 10. EvidenceAssertion

## 10.1 Propósito

Representa evidencia explícita que apoya o contradice una hipótesis de resolución.

## 10.2 Campos conceptuales

- `id`;
- `subjectRef`;
- `predicate`;
- `objectRef` o `value`;
- `polarity`:
  - `supports`;
  - `contradicts`;
- `evidenceClass`:
  - `A` — identificador determinista;
  - `B` — evidencia bibliográfica fuerte;
  - `C` — evidencia contextual;
  - `D` — evidencia nominal;
  - `VETO` — contradicción que bloquea fusión automática;
- `ruleId`;
- `sourceRecordRefs`;
- `curationRef` cuando proviene de revisión humana;
- `observedAtRevision`;
- `notes` opcionales.

## 10.3 Ejemplos de clase

### A

- ORCID idéntico;
- ID de autoridad compartido de forma explícita.

### B

- varias obras confirmadas coincidentes;
- afiliación institucional específica;
- combinación recurrente de coautores;
- fuente institucional/editorial explícita.

### C

- disciplina;
- revistas;
- editorial;
- geografía académica;
- cronología compatible.

### D

- nombre exacto;
- iniciales;
- variante sin acentos;
- orden apellido/nombre.

### VETO

- ORCID incompatibles;
- identificadores externos mutuamente exclusivos;
- segundo apellido completo incompatible en contexto de alta calidad;
- contribución ya confirmada a otra autoridad incompatible.

## 10.4 Regla fundamental

La clase de evidencia no equivale a una suma lineal.

Varias evidencias D no deben «ganarle» automáticamente a un veto.

---

# 11. ResolutionDecision

## 11.1 Propósito

Representa una decisión explícita y reproducible.

## 11.2 Tipos de decisión

- `mention-to-authority`;
- `authority-merge`;
- `authority-split`;
- `contribution-attribution`;
- `work-merge`;
- `work-split`;
- `version-link`;
- `identifier-link`.

## 11.3 Campos conceptuales

- `id`;
- `decisionType`;
- `subjectRefs`;
- `targetRefs`;
- `status`:
  - `confirmed`;
  - `probable`;
  - `ambiguous`;
  - `unresolved`;
  - `rejected`;
- `evidenceRefs`;
- `vetoRefs`;
- `algorithmVersion`;
- `datasetRevision`;
- `decisionMode`:
  - `automatic`;
  - `curated`;
  - `hybrid`;
- `supersedesDecisionRef`;
- `decidedAtRevision`;
- `explanationCode`.

## 11.4 Invariantes

1. Toda fusión automática debe tener evidencia explícita.
2. Toda decisión rechazada debe persistir.
3. Una decisión curada debe ser visible como tal.
4. Una nueva decisión puede superseder a una anterior sin borrarla.
5. Las explicaciones de UI deben derivarse de estos datos, no de texto inventado ad hoc.

---

# 12. CoverageLedger

## 12.1 Propósito

Representa qué tan lejos llegó una reconstrucción concreta.

No estima «qué porcentaje de toda la obra de una vida conocemos».

## 12.2 Campos conceptuales

### Ejecución

- `id`;
- `authorityRef`;
- `buildRevision`;
- `algorithmVersion`;
- `startedAt`;
- `finishedAt`;
- `saturationState`:
  - `reached`;
  - `not-reached`;
  - `cutoff`;
  - `failed`.

### Por proveedor

Cada entrada contiene:

- `provider`;
- `providerRevision`;
- `queryKey` o partición;
- `pagesVisited`;
- `recordsSeen`;
- `recordsAccepted`;
- `recordsRejected`;
- `recordsUnresolved`;
- `newEvidenceCount`;
- `status`:
  - `exhausted`;
  - `partial`;
  - `unavailable`;
  - `not-applicable`;
  - `not-queried`;
- `stopReason`;
- `errorCodes`.

## 12.3 Reglas

- `exhausted` significa agotado según el contrato de esa fuente, no bibliografía universal completa.
- Una fuente caída no debe convertir el perfil en «completo».
- Un límite defensivo produce `partial`.
- La UI futura puede resumir el Ledger, pero no inventar porcentajes sin denominador.

---

# 13. Objetos de apoyo

## 13.1 NameAssertion

Campos conceptuales:

- valor original;
- valor normalizado;
- tipo:
  - canónico;
  - alias;
  - transliteración;
  - abreviatura;
  - forma editorial;
  - forma institucional;
- evidencia;
- rango temporal si está documentado;
- estado.

Regla: una forma de nombre no demuestra por sí sola identidad.

## 13.2 AffiliationAssertion

Campos conceptuales:

- institución;
- unidad académica;
- país/región cuando esté documentado;
- fecha desde/hasta;
- precisión temporal;
- fuente;
- estado.

Regla: varias afiliaciones simultáneas son válidas.

## 13.3 DateValue

Toda fecha bibliográfica debe conservar precisión:

- `year`;
- `year-month`;
- `full-date`;
- `unknown`.

No se fabrican componentes faltantes.

## 13.4 IdentifierValue

Debe conservar:

- valor original;
- valor normalizado;
- esquema;
- validez sintáctica;
- fuente.

---

# 14. Flujo de transformación

El flujo conceptual de datos queda:

    SourceRecord
        │
        ▼
    AuthorMention
        │
        ├── candidate blocking
        ▼
    EvidenceAssertion
        │
        ▼
    ResolutionDecision
        │
        ▼
    AuthorityPerson
        │
        ▼
    Contribution
        │
        ▼
    IntellectualWork
        │
        ▼
    WorkVersion

En paralelo:

    SourceRecord ──► WorkVersion
    SourceRecord ──► EvidenceAssertion
    Build run ──► CoverageLedger

---

# 15. Candidate blocking

Antes de evaluar identidad, el sistema debe reducir el espacio de candidatos.

Puede utilizar para generar candidatos:

- firma de nombre;
- ORCID;
- IDs externos;
- apellidos completos;
- iniciales;
- afiliación;
- coautorías conocidas;
- obras ya confirmadas.

Candidate blocking **no es resolución**.

Su único propósito es responder:

> «¿Qué autoridades merece la pena comparar?»

No:

> «¿Cuál es la persona correcta?»

---

# 16. Separación entre evidencia y decisión

Ejemplo conceptual:

Una mención contiene:

> D. Hernández López

Se obtienen dos candidatos.

Candidato A:

- comparte ORCID con registros previos;
- comparte afiliación;
- tiene dos obras confirmadas del mismo conjunto.

Candidato B:

- sólo comparte el apellido.

El grafo no guarda simplemente:

> candidato A = 97 puntos.

Guarda varias `EvidenceAssertion` y una `ResolutionDecision` que explica por qué A fue confirmado.

Esto permite cambiar reglas futuras sin perder los hechos observados.

---

# 17. Migración de la capa curada

La información actualmente mantenida en:

- `author-curated-identities.js`;
- `curated-author-bibliography.js`;

debe migrar en fases posteriores a:

- `AuthorityPerson` semilla;
- `ExternalIdentifierAssertion`;
- `EvidenceAssertion` de alta autoridad;
- `Contribution`;
- `SourceRecord` o referencia documental equivalente;
- casos de benchmark.

La capa curada no desaparece como conocimiento.

Desaparece como **ruta especial de ejecución para una persona concreta**.

---

# 18. Compatibilidad con author-index-v3

`author-index-v3` debe tratarse como fuente de datos derivada, no como autoridad final.

Sus particiones pueden producir:

- `AuthorMention`;
- identificadores;
- candidatos de autoridad;
- `SourceRecord` normalizados;
- evidencia de contribución;
- información de colaboración.

El ID OpenAlex seguirá siendo útil como `ExternalIdentifierAssertion`, pero no será el ID interno de `AuthorityPerson`.

---

# 19. Contrato del perfil futuro

El perfil no debe consumir directamente un conjunto plano de «works».

Debe recibir conceptualmente un `AuthorityArchive` derivado que contenga:

- AuthorityPerson;
- nombres;
- identificadores;
- afiliaciones;
- contribuciones confirmadas;
- contribuciones probables;
- candidatas ambiguas;
- obras;
- versiones;
- colaboradores derivados;
- Evidence summary;
- CoverageLedger;
- build revision.

Este objeto es una **vista materializada**, no una nueva fuente de verdad.

La fuente de verdad es el Authority Graph versionado.

---

# 20. Validación de datos

Antes de publicar una release del grafo, como mínimo debe comprobarse:

1. ninguna referencia interna apunta a una entidad inexistente;
2. ningún ID interno se duplica;
3. ningún redirect forma ciclos;
4. ninguna autoridad fusionada permanece simultáneamente activa;
5. una contribución confirmada referencia una autoridad y obra válidas;
6. toda decisión automática contiene evidencia;
7. todo veto referencia evidencia contradictoria;
8. las fechas conservan precisión;
9. los SourceRecord permanecen inmutables dentro de una revisión;
10. los CoverageLedger sólo usan estados permitidos;
11. no existe llamada o dependencia de runtime hacia `api.openalex.org`;
12. las bibliografías curadas no se activan por similitud nominal solamente.

---

# 21. Qué queda deliberadamente fuera de Fase 2

Todavía no se definen:

- pesos numéricos;
- thresholds de promoción;
- algoritmo exacto de clustering;
- formato físico final de los archivos publicados;
- compresión;
- shard strategy;
- UI;
- almacenamiento local;
- endpoints;
- nuevos proveedores.

Esas decisiones pertenecen a las fases de implementación y benchmarking.

---

# 22. Criterio de cierre de Fase 2

La fase queda conceptualmente cerrada cuando cualquier caso bibliográfico del proyecto puede describirse sin inventar una excepción nueva, usando únicamente:

- autoridad;
- mención;
- identificador;
- obra;
- versión;
- contribución;
- registro fuente;
- evidencia;
- decisión;
- cobertura.

La matriz de fixtures asociada debe demostrar que estos contratos soportan tanto casos fáciles como homonimias, roles editoriales, ediciones, errores de proveedor y evidencia contradictoria.
