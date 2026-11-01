# Tesis Humanidades UdeG — Contratos de datos V1

## Estado

**T0 — contratos conceptuales.**

Estos contratos complementan el Author Authority Graph. No implementan runtime ni definen todavía formato físico final, compresión o sharding.

---

## 1. Principios

1. IDs canónicos internos no dependen de nombres, Handles ni URLs.
2. SourceRecord es inmutable dentro de una revisión.
3. Toda decisión de admisión, identidad o fusión es trazable.
4. Los datos originales y normalizados se conservan por separado.
5. Los artefactos semánticos son derivados y reconstruibles.
6. Ningún score reemplaza estados discretos cuando hay ambigüedad institucional.
7. Una tesis no se clasifica como humanística por contenido temático.

---

## 2. ThesisWorkProfile

Extensión especializada asociada a un IntellectualWork.

Campos conceptuales:

- id;
- workRef;
- thesisKind;
- degreeLevel;
- degreeNameRaw;
- degreeNameNormalized;
- programRef;
- institutionRef;
- academicUnitRef;
- defenseOrPublicationDate;
- datePrecision;
- language;
- abstract;
- keywords;
- accessState;
- fileRefs;
- persistentIdentifierRefs;
- sourceRecordRefs;
- admissionDecisionRef;
- duplicateDecisionRefs;
- semanticArtifactRefs;
- createdInRevision;
- lastEvaluatedInRevision.

### Invariantes

- no inventa fecha completa cuando sólo existe año;
- no convierte “director” en autor;
- no usa el Handle como ID interno;
- no usa un PDF como identidad de obra;
- puede existir aunque no tenga archivo abierto;
- puede permanecer en REVIEW o QUARANTINE sin entrar al corpus semántico.

---

## 3. AcademicProgramAuthority

Representa un programa académico a través del tiempo.

Campos:

- id;
- canonicalName;
- aliases;
- level;
- disciplineFamily;
- humanitiesDomain;
- institutionRef;
- unitRefs;
- modalities;
- observedFrom;
- observedUntil;
- predecessorRefs;
- successorRefs;
- parallelProgramRefs;
- institutionalEvidenceRefs;
- admissionState;
- admissionDecisionRefs;
- lifecycleState.

Estados de lifecycle:

- active;
- historical;
- renamed;
- merged;
- split;
- unknown.

Estados de admisión:

- include;
- review;
- quarantine;
- exclude.

### Invariantes

- nombre idéntico no implica mismo programa;
- cambio de nombre no obliga a crear nueva autoridad;
- una equivalencia histórica requiere evidencia;
- la semántica del título de una tesis no decide humanitiesDomain.

---

## 4. AcademicUnitAuthority

Representa dependencias académicas.

Campos:

- id;
- canonicalName;
- unitType;
- institutionRef;
- parentRefs;
- aliases;
- observedFrom;
- observedUntil;
- predecessorRefs;
- successorRefs;
- evidenceRefs;
- lifecycleState.

Tipos posibles:

- center;
- system;
- division;
- department;
- coordination;
- institute;
- other.

La jerarquía administrativa puede cambiar sin modificar la identidad de la tesis.

---

## 5. InstitutionAuthority

Representa la institución otorgante.

Para V1, Universidad de Guadalajara es la institución objetivo, pero el contrato debe representar instituciones externas porque UDGVirtual contiene tesis de distintas universidades y deben poder excluirse con evidencia, no descartarse por heurística.

Campos:

- id;
- canonicalName;
- aliases;
- externalIdentifiers;
- evidenceRefs;
- lifecycleState.

---

## 6. ThesisContribution

Especialización conceptual de Contribution.

Campos adicionales:

- contributionType;
- authorityRef;
- workRef;
- mentionRefs;
- roleCertainty;
- resolutionState;
- sourceRecordRefs;
- decisionRef.

Roles:

- thesis-author;
- thesis-director;
- thesis-codirector;
- thesis-advisor;
- committee-member;
- unknown-thesis-role.

### Reglas

- thesis-author y thesis-director son roles mutuamente distintos;
- una cadena compuesta puede generar varias menciones;
- la posición en un campo visual llamado “Autor” no determina el rol;
- marcadores textuales explícitos como “Directora de tesis” son evidencia de rol;
- un rol ambiguo permanece unresolved.

---

## 7. ThesisSourceRecord

Es un SourceRecord con campos de tesis preservados.

Campos conceptuales adicionales:

- provider;
- providerRecordId;
- providerRevision;
- retrievedAt;
- recordUrl;
- persistentIdentifierRaw;
- titleRaw;
- creatorRaw;
- contributorRaw;
- directorRaw;
- dateRaw;
- typeRaw;
- degreeRaw;
- programRaw;
- institutionRaw;
- academicUnitRaw;
- abstractRaw;
- keywordsRaw;
- languageRaw;
- rightsRaw;
- fileMetadataRaw;
- payloadHash;
- normalizationVersion.

El payload original nunca se reescribe para “corregir” metadatos.

---

## 8. HumanitiesAdmissionDecision

Decide si un trabajo puede entrar al corpus humanístico.

Campos:

- id;
- thesisRef;
- programCandidateRefs;
- institutionRef;
- status;
- evidenceRefs;
- vetoRefs;
- ruleId;
- policyVersion;
- datasetRevision;
- decisionMode;
- supersedesDecisionRef;
- explanationCode.

Estados:

- include;
- review;
- quarantine;
- exclude;
- reject-source.

### Ejemplos de explanationCode

- confirmed-humanities-program;
- historical-program-equivalence;
- external-institution;
- non-humanities-program;
- unknown-program;
- unresolved-institution;
- not-a-thesis;
- insufficient-metadata.

---

## 9. ThesisIdentityDecision

Resuelve si dos SourceRecord representan el mismo trabajo.

Campos:

- id;
- candidateRecordRefs;
- targetWorkRef;
- status;
- evidenceRefs;
- vetoRefs;
- algorithmVersion;
- datasetRevision;
- decisionMode;
- explanationCode;
- supersedesDecisionRef.

Estados:

- confirmed;
- probable;
- ambiguous;
- unresolved;
- rejected.

La fusión automática exige evidencia fuerte y ausencia de veto.

---

## 10. ThesisPersistentIdentifier

Campos:

- scheme;
- rawValue;
- normalizedValue;
- status;
- sourceRecordRefs;
- evidenceRefs.

Esquemas candidatos:

- handle;
- doi;
- institutional-record;
- repository-local;
- other.

Un Handle es evidencia muy fuerte de identidad de depósito, pero no reemplaza el ID interno.

---

## 11. ThesisFileArtifact

Describe un archivo asociado sin convertirlo en identidad de obra.

Campos:

- id;
- thesisRef;
- sourceRecordRef;
- fileName;
- mediaType;
- byteSize;
- checksum;
- checksumAlgorithm;
- accessUrl;
- accessState;
- observedAtRevision.

Estados de acceso:

- open;
- restricted;
- metadata-only;
- unavailable;
- unknown.

---

## 12. SemanticRepresentation

Campos:

- id;
- thesisRef;
- purpose;
- modelId;
- modelRevision;
- tokenizerRevision;
- inputContractVersion;
- inputHash;
- dimensions;
- normalization;
- vectorArtifactRef;
- buildRevision.

purpose:

- topology;
- retrieval.

La representación nunca se guarda como verdad bibliográfica.

---

## 13. ThesisNeighborhood

Campos:

- thesisRef;
- neighborRefs;
- similarityValues;
- metric;
- k;
- indexVersion;
- embeddingVersion;
- buildRevision.

Debe ser reconstruible desde el corpus y modelo fijados.

---

## 14. ThesisAtlasMembership

Campos:

- thesisRef;
- clusterRefs;
- x;
- y;
- projectionAlgorithm;
- projectionVersion;
- clusteringAlgorithm;
- clusteringVersion;
- buildRevision.

La coordenada 2D no expresa calidad, importancia ni jerarquía académica.

---

## 15. ThesisCluster

Campos:

- id;
- parentRef;
- level;
- memberCount;
- centroidArtifactRef;
- proposedLabels;
- publishedLabelRef;
- keywordEvidence;
- buildRevision.

Niveles candidatos:

- field;
- topic;
- subtopic.

---

## 16. ClusterLabelDecision

Campos:

- id;
- clusterRef;
- label;
- status;
- method;
- evidenceTerms;
- curationRef;
- algorithmVersion;
- buildRevision;
- supersedesDecisionRef.

Estados:

- proposed;
- reviewed;
- published;
- rejected;
- deprecated.

---

## 17. ThesisCoverageLedger

Registra alcance de una construcción.

Campos globales:

- id;
- buildRevision;
- startedAt;
- finishedAt;
- sourceStates;
- admissionCounts;
- normalizationCounts;
- duplicateCounts;
- authorityResolutionCounts;
- semanticEligibilityCounts;
- errorCodes.

Por proveedor:

- recordsSeen;
- recordsCreated;
- recordsUpdated;
- recordsDeleted;
- recordsRejected;
- resumptionTokensUsed;
- harvestWindow;
- stopReason;
- status.

Estados:

- exhausted;
- partial;
- unavailable;
- failed;
- not-applicable.

---

## 18. ProgramEvidenceAssertion

Representa evidencia sobre identidad, adscripción o carácter humanístico de un programa.

Campos:

- id;
- subjectProgramRef;
- predicate;
- valueOrObjectRef;
- polarity;
- evidenceClass;
- sourceUrlOrRecordRef;
- observedAt;
- notes.

Clases:

- A: documentación institucional explícita;
- B: dictamen/normatividad/adscripción histórica fuerte;
- C: metadatos institucionales consistentes;
- D: variante nominal;
- VETO: evidencia institucional incompatible.

Varias coincidencias nominales no derrotan un veto.

---

## 19. Transformación

    ThesisSourceRecord
            │
            ├──► AcademicProgramAuthority
            │           │
            │           ▼
            │   HumanitiesAdmissionDecision
            │
            ├──► AuthorMention
            │           │
            │           ▼
            │     AuthorityPerson
            │
            └──► ThesisIdentityDecision
                        │
                        ▼
                 IntellectualWork
                        │
                        ▼
                ThesisWorkProfile
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
    SemanticRepresentation   ThesisContribution

---

## 20. Validación mínima

Una release debe fallar si:

1. hay IDs canónicos duplicados;
2. hay referencias internas rotas;
3. un INCLUDE no tiene programRef resuelto;
4. un INCLUDE pertenece a una institución externa;
5. una tesis incluida no tiene SourceRecord;
6. una fusión automática carece de evidencia;
7. un veto fue ignorado;
8. una contribución confirmada carece de persona u obra;
9. un director fue normalizado silenciosamente como autor;
10. una fecha ganó precisión que la fuente no tenía;
11. una autoridad histórica forma ciclos;
12. un artefacto semántico no declara modelo/revisión/contrato;
13. un snapshot parcial reemplaza uno válido sin señal explícita.

---

## 21. Fuera de T0

No se fijan todavía:

- formato físico;
- sharding;
- modelo final;
- umbrales;
- algoritmo de clustering;
- proyección;
- índices;
- endpoints;
- UI.
