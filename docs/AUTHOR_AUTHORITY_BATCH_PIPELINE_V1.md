# Author Authority Batch Pipeline V1

## Estado

**Fase 3.3 — construcción por lotes del Author Authority Graph.**

Esta fase escala el pipeline mínimo aprobado en la Fase 3.2 desde un fixture individual hacia múltiples autores del índice estático publicado.

Todavía no sustituye la UI ni el runtime de perfiles.

---

## 1. Fuente de entrada real

El batch consume la estructura actualmente generada por:

- `.github/workflows/build-author-index-v1.yml`;
- `scripts/openalex/merge_author_index_v1.py`.

La release publicada sigue usando el schema de sitio:

`author-index-v2`

aunque el paquete inmutable publicado sea:

`author-index-v3`.

La entrada contiene:

- `manifest.json`;
- `aliases/*.jsonl`;
- `works/*.jsonl`;
- `work-authors/*.jsonl`.

Batch V1 utiliza inicialmente:

- `aliases`;
- `works`.

`work-authors` queda reservado para las siguientes fases de Contribution y red de colaboración.

---

## 2. Contrato de alias

Cada fila del índice de alias contiene actualmente:

- `s`: firma normalizada;
- `id`: OpenAlex Author ID;
- `n`: display name;
- `o`: ORCID;
- `cw`: obras dentro del corpus filosófico;
- `w`: obras del perfil OpenAlex;
- `c`: citas;
- `k`: tipo de alias.

Estas filas son evidencia del índice.

No son `AuthorityPerson`.

---

## 3. Agregación en streaming

El constructor no almacena todas las filas de alias originales.

`createAuthorAliasAccumulator()` mantiene sólo el estado agregado necesario por OpenAlex Author ID:

- nombres observados;
- firmas;
- tipos de alias;
- ORCID observados;
- métricas de corpus.

Esto permite recorrer las 1,024 particiones de alias sin conservar millones de duplicados de firma en memoria.

---

## 4. Conflicto de ORCID dentro de un OpenAlex ID

Si el mismo OpenAlex Author ID aparece con más de un ORCID válido:

- el perfil no entra al batch automático;
- se registra `openalex-author-orcid-conflict`;
- no se crea AuthorityPerson.

Un ORCID malformado no funciona como ancla determinista.

Sólo se admite el formato:

`0000-0000-0000-0000`

con `X` permitido en el último carácter.

---

## 5. Agrupación de candidatos

### Regla automática V1

Dos OpenAlex Author IDs diferentes sólo se agrupan automáticamente cuando comparten exactamente el mismo ORCID válido.

El nombre no produce agrupación.

Por tanto:

- mismo nombre + ORCID distinto → separados;
- mismo nombre + sin ORCID → separados;
- nombres distintos + mismo ORCID → mismo candidato de autoridad.

Esto permite conservar variantes reales sin convertir homónimos en una sola persona.

---

## 6. Candidate Group

Un grupo de identidad conserva:

- todos los OpenAlex Author IDs miembros;
- nombres observados;
- ORCID compartido cuando exista;
- corpus works;
- firmas del índice;
- metadata de los perfiles fuente.

Se transforma después en un `AuthorityCandidate`.

Un candidate group sigue sin ser un AuthorityPerson.

Debe pasar por el Identity Resolution Engine.

---

## 7. Sharding

El índice OpenAlex fuente utiliza:

- 1,024 buckets;
- FNV-1a 32-bit.

El Authority Batch V1 utiliza por defecto:

- 256 shards de autoridad.

El shard se deriva de un OpenAlex Author ID estable del candidate group, no del nombre visible.

Cambiar:

- acentos;
- forma canónica;
- alias;

no mueve por sí mismo una autoridad de shard.

---

## 8. Redistribución de works

Las filas de `works/*.jsonl` ya están particionadas por OpenAlex Author ID.

El batch las recorre en streaming y consulta:

`authorId → candidateRef → authority shard`.

Las filas se escriben temporalmente en staging por shard.

Así:

- no se carga todo `works` en memoria;
- un grupo con varios OpenAlex IDs recibe las obras de todos sus IDs;
- los homónimos siguen separados.

---

## 9. Conversión de cada work row

Cada fila del índice produce:

1. un `SourceRecord` de la relación de autoría del snapshot;
2. un `AuthorMention`;
3. una entrada al Identity Resolution Engine.

La mención incluye:

- OpenAlex Author ID;
- nombre observado;
- ORCID cuando exista;
- rol `author`;
- posición;
- SourceRecord asociado.

El OpenAlex Author ID actúa como evidencia A.

---

## 10. Promoción por shard

Cada shard llama al mismo:

`buildAuthorityGraph()`

aprobado en Fase 3.2.

No existe un resolvedor especial para batch.

La regla sigue siendo:

> sólo `confirmed` puede promover AuthorityPerson.

---

## 11. Salida

El comando:

`npm run build:authority-batch -- --input <author-index-v2> --output <destino>`

produce:

### manifest.json

Incluye:

- schema;
- buildRevision;
- datasetRevision;
- shardCount;
- manifest fuente;
- filas de alias vistas;
- perfiles agregados;
- candidate groups;
- work rows vistas;
- work rows encaminadas;
- obras sin candidato;
- conteos de decisiones;
- conflictos;
- inventario y SHA-256 de shards.

### registry.json

Contiene:

- `authorityLocations`;
- `identifierRegistry`;
- `candidateRegistry`.

Permite localizar rápidamente un AuthorityPerson sin escanear todos los shards.

### shards/*.json

Cada shard contiene:

- candidatos procesados;
- mentions;
- SourceRecord;
- AuthorityPerson;
- links;
- Decision Ledger;
- build metrics.

---

## 12. Reconstrucción incremental

El builder acepta:

`--previous <author-authority-v1>`

Cuando existe un shard previo en la misma posición:

- se reutiliza como `previousGraph`;
- se conserva AuthorityPerson.id;
- se conserva el Decision Ledger;
- se agregan identificadores nuevos;
- se actualiza `lastEvaluatedInRevision`.

Esto permite que un autor inicialmente identificado por OpenAlex ID conserve su AuthorityPerson.id si después aparece un ORCID o un nuevo OpenAlex ID dentro del mismo candidate group.

---

## 13. Homónimos

Dos candidatos con el mismo display name pero distintos OpenAlex Author IDs:

- permanecen como candidate groups distintos;
- producen AuthorityPerson distintos cuando cada mención confirma su ID;
- nunca se unen por número de obras.

El batch fixture contiene explícitamente dos `José Martínez` separados para bloquear una regresión de este tipo.

---

## 14. ORCID compartido

El fixture contiene:

- OpenAlex ID 123;
- OpenAlex ID 456;
- mismo ORCID;
- nombres ligeramente distintos.

Ambos deben converger al mismo AuthorityPerson.

El build falla si no lo hacen.

---

## 15. Fixture de CI

El comando:

`npm run build:authority-batch-fixture`

crea un mini author-index-v2 compatible con el formato real.

Contiene:

- dos IDs OpenAlex unidos por ORCID;
- dos homónimos sin ORCID compartido;
- cuatro obras.

Resultado esperado:

- 3 candidate groups;
- 3 AuthorityPerson;
- 4 AuthorMention;
- 0 conflictos de registry;
- los IDs unidos por ORCID comparten AuthorityPerson.id;
- los homónimos permanecen separados.

El artifact se publica como:

`author-authority-batch-fixture-v1`.

---

## 16. Reproducibilidad

El output conserva:

- SHA-256 del manifest fuente;
- revisiones de snapshot;
- revisión del corpus filosófico;
- buildRevision;
- checksum de registry;
- checksum de cada shard.

El input actual sigue anclado a:

- `Mearman/OpenAlex`;
- `CristianPelayo/openalex-philosophy`;

según las revisiones declaradas por el manifest de author-index.

No se llama a:

`api.openalex.org`.

---

## 17. Conflictos globales

El resumen del batch detecta:

- conflictos de alias/ORCID;
- una misma clave de identifierRegistry apuntando a dos autoridades;
- candidateRegistry contradictorio;
- AuthorityPerson repetido en shards distintos.

Estos casos no deben resolverse silenciosamente.

---

## 18. Qué todavía NO hace V1

Batch V1 todavía no:

- publica los shards en GitHub Pages;
- cambia el perfil de autor;
- usa `work-authors` para materializar Contribution completas;
- construye Work/WorkVersion;
- ejecuta Crossref/Internet Archive;
- calcula CoverageLedger por proveedor federado;
- ejecuta un golden set humano de cientos de autores;
- migra por completo la capa curada;
- resuelve automáticamente merges históricos entre shards cuando cambia una agrupación previa.

Es un batch de identidad, no todavía el Knowledge Graph completo.

---

## 19. Siguiente fase

Después de validar el batch V1, la siguiente fase debe ser el **benchmark masivo de autoridad** antes de servir estos shards al navegador.

Debe incluir:

1. muestra reproducible de autores;
2. homónimos reales;
3. autores con ORCID;
4. autores sin ORCID;
5. nombres con diacríticos;
6. nombres hispanos compuestos;
7. autores con alias;
8. autores con múltiples OpenAlex IDs;
9. golden set humano;
10. false merge rate como métrica de bloqueo.

Sólo después de superar ese gate debe comenzar la integración del Author Profile V2.
