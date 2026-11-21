# Authority Work Map real build V1

## Estado

**Fase 1D — construcción real y validada de Authority Graph + Authority Work Map.**

Esta fase no activa todavía “Obras relacionadas” en la interfaz y no publica automáticamente artifacts de producción.

Su objetivo es construir por primera vez, sobre la release real y pinneada author-index-v3, dos artifacts candidatos:

1. author-authority-batch-v1;
2. authority-work-map-v1.

Ambos deben pasar validadores independientes antes de poder ser promovidos a una release inmutable.

---

## 1. Fuente fijada

La configuración canónica vive en:

benchmark/author-authority/v1/config.json

Release:

- tag: author-index-v3;
- asset: author-index-v3.tar.gz;
- SHA-256:
  f04eb636744f4cce7f694b1d64eab19acfbccae7a5b588b4f6102e1006930e7d.

El workflow descarga únicamente ese asset y verifica su checksum antes de extraerlo.

No utiliza api.openalex.org.

---

## 2. Orden del pipeline

~~~text
author-index-v3.tar.gz
        │
        ├── verificar SHA-256
        │
        ▼
author-index-v2/
        │
        ├── benchmark masivo de identidad
        │
        ▼
Author Authority Batch V1
        │
        ├── validator independiente
        │
        ▼
Authority Work Map V1
        │
        ├── validator independiente
        │
        ▼
tarballs deterministas + SHA-256
~~~

No se construye el work map si el Authority Batch falla.

---

## 3. Benchmark previo

Sobre la misma copia extraída se vuelve a ejecutar:

npm run benchmark:authority

El gate exige:

- gold failures = 0;
- false merges = 0;
- false splits = 0;
- unmapped profiles = 0;
- cobertura exacta respecto del manifest fuente.

El benchmark se vuelve a ejecutar deliberadamente en el mismo job para evitar validar una release y construir otra distinta.

---

## 4. Authority Batch real

Comando:

npm run build:authority-batch

Entrada: author-index-v2/

Salida: authority-batch/

El batch genera:

- manifest.json;
- registry.json;
- shards de autoridad.

La revisión de build queda anclada al SHA de GitHub del workflow.

---

## 5. Validador independiente del Authority Batch

Script:

scripts/authority/validate-authority-batch-v1.mjs

No reutiliza el resultado PASS del builder.

Vuelve a leer:

- manifest;
- registry;
- todos los shards declarados.

Verifica:

- schema de manifest, registry y shards;
- tamaños;
- SHA-256;
- buildRevision;
- datasetRevision;
- cobertura de autores respecto del source manifest;
- workRowsMissingCandidate = 0;
- todas las works encaminadas;
- ausencia de alias conflicts;
- ausencia de registry conflicts;
- ausencia de AuthorityPerson duplicadas entre shards;
- conteos agregados;
- authorityLocations;
- identifierRegistry;
- candidateRegistry;
- referencias a AuthorityPerson existentes.

Un artifact alterado después de su construcción debe fallar.

---

## 6. Authority Work Map real

Comando:

npm run build:authority-work-map

Entradas:

- author-index real verificado;
- Authority Batch ya validado.

Salida: authority-work-map/

El bridge conserva únicamente AuthorityPerson confirmadas por el registry.

No resuelve nombres por su cuenta.

---

## 7. Validador independiente del work map

Script:

scripts/related/validate_authority_work_map_v1.py

Vuelve a leer los shards mediante el contrato Python de authority-work-map-v1.

Verifica:

- routing por identidad de obra;
- orden estricto;
- obra única entre shards;
- tamaño y SHA de cada shard;
- worksMapped;
- aritmética: worksSeen = worksMapped + worksWithoutConfirmedAuthority;
- aritmética de menciones;
- memberships confirmadas observadas;
- SHA del manifest del author-index fuente;
- SHA del manifest del Authority Batch;
- SHA del registry de autoridad.

La procedencia no puede cambiar sin invalidar el artifact.

---

## 8. Empaquetado determinista

Los dos candidatos se empaquetan con:

- nombres ordenados;
- mtime fija en Unix epoch;
- owner 0;
- group 0;
- IDs numéricos;
- gzip sin timestamp.

Artifacts:

~~~text
author-authority-batch-v1.tar.gz
authority-work-map-v1.tar.gz
checksums.sha256
~~~

La intención es que el mismo árbol lógico produzca el mismo paquete byte a byte.

---

## 9. Evidencia de CI

Además de los tarballs, el workflow conserva:

- build-summary.json;
- authority-batch-validation.json;
- authority-work-map-validation.json;
- benchmark report.json;
- audit-sample.json;
- violations.json;
- checksums.

Retención inicial: 30 días.

Esto es staging de CI, no publicación permanente.

---

## 10. Qué debe medirse

### Identity

- perfiles;
- candidate groups;
- false merges;
- false splits;
- gold failures.

### Authority Batch

- shards;
- candidates;
- work rows;
- mentions;
- AuthorityPerson;
- confirmed/probable/ambiguous/unresolved/rejected;
- conflictos.

### Work Map

- works seen;
- works mapped;
- works sin autoridad confirmada;
- author mentions;
- memberships confirmadas;
- menciones no resueltas;
- aliases colapsados.

### Payload

- bytes comprimidos de Authority Batch;
- bytes comprimidos del work map;
- SHA-256 de ambos tarballs.

---

## 11. Criterios para promover una release

Un artifact candidato sólo puede publicarse si:

1. la release fuente pasa checksum;
2. el benchmark masivo pasa;
3. el Authority Batch validator pasa;
4. el Authority Work Map validator pasa;
5. no existen conflictos globales;
6. los paquetes tienen SHA-256;
7. las métricas reales quedan documentadas;
8. el tamaño permite distribución razonable;
9. la revisión exacta queda fijada.

El workflow de esta fase no crea releases.

---

## 12. Lo que 1D no hace

No:

- modifica el perfil de autor;
- modifica la ficha bibliográfica;
- activa Related Works;
- publica shards en Pages;
- publica release GitHub/Hugging Face;
- construye todavía el índice semántico completo de obras;
- sustituye el FAISS congelado faltante;
- calibra ranking final;
- genera citaciones.

---

## 13. Dependencia semántica que sigue pendiente

Aunque 1D produzca el work map real, el full Related Work Index todavía requiere exactamente:

FAISS:
31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68

Metadata SQLite:
e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0

No se reemplazan por los shards int8 de Browser Static V4.

---

## 14. Siguiente gate

Si el build real pasa:

1. revisar métricas y payload;
2. promover Authority Batch + Authority Work Map a una release inmutable;
3. fijar URLs + SHA en Related Works;
4. recuperar los originales FAISS/SQLite;
5. construir full related-work-index-v1c;
6. calibrar ranking/diversidad con benchmark humano;
7. integrar finalmente la sección visual.
