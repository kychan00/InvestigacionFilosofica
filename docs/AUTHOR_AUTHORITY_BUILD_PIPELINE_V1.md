# Author Authority Build Pipeline V1

## Estado

**Fase 3.2 — primer build reproducible del grafo de autoridades.**

Esta fase conecta los componentes creados en las fases anteriores:

- adaptadores del sistema actual;
- Identity Resolution Engine;
- Decision Ledger;
- promoción conservadora a AuthorityPerson;
- registro estable de identificadores;
- benchmark de falsos merges.

Todavía no cambia el perfil visible ni reemplaza el runtime actual.

---

## 1. Objetivo

El pipeline mínimo debe transformar entradas bibliográficas existentes en un grafo estático y auditable:

    datos actuales
        │
        ▼
    AuthorityCandidate + AuthorMention
        │
        ▼
    resolveAuthorMention()
        │
        ▼
    ResolutionDecision
        │
        ▼
    Decision Ledger
        │
        ▼
    promoción conservadora
        │
        ▼
    AuthorityPerson
        │
        ▼
    Authority Graph V1

La regla fundamental es:

> sólo una resolución `confirmed` puede crear o actualizar un `AuthorityPerson`.

Los estados:

- `probable`;
- `ambiguous`;
- `unresolved`;
- `rejected`;

se conservan como decisiones, pero no crean una identidad canónica.

---

## 2. Salida del pipeline

El grafo V1 contiene:

- `authorities`;
- `mentions`;
- `sourceRecords`;
- `mentionAuthorityLinks`;
- `identifierRegistry`;
- `candidateRegistry`;
- `decisionLedger`;
- `buildMetrics`;
- conflictos de registry.

Su schema es:

`author-authority-graph-v1`.

---

## 3. Asignación de AuthorityPerson.id

El ID interno sigue siendo independiente del nombre visible.

### Primer build

Para una autoridad nueva se necesita al menos un identificador determinista.

La primera asignación utiliza una huella opaca y reproducible de los identificadores deterministas disponibles.

El nombre no participa en esa semilla.

### Builds posteriores

La fuente principal de continuidad deja de ser la semilla.

El pipeline consulta:

- `identifierRegistry`;
- `candidateRegistry`.

Si alguno ya apunta a un `AuthorityPerson.id`, ese ID se reutiliza.

Esto permite que una reconstrucción posterior añada nuevos identificadores sin crear otra persona.

### Conflictos

Si los identificadores de un mismo candidato apuntan en el registry previo a autoridades diferentes, el pipeline:

- no promueve silenciosamente;
- registra un `registry-conflict`;
- conserva el caso para resolución posterior.

---

## 4. Promoción

Una promoción requiere simultáneamente:

1. resolución `confirmed`;
2. candidato existente;
3. al menos un ancla determinista;
4. ausencia de conflicto de registry.

Un candidato `probable` no se promueve.

Esto evita convertir evidencia contextual o nominal en una persona canónica antes de tiempo.

---

## 5. Decision Ledger

Cada mención genera una `ResolutionDecision`.

Cuando la identidad se promueve, una decisión confirmada apunta al `AuthorityPerson.id` canónico, no únicamente al ID temporal del candidato.

Las decisiones históricas se conservan mediante las reglas del Decision Ledger.

---

## 6. Registry

### identifierRegistry

Mapea claves como:

- `orcid:...`;
- `openalex-author:...`;
- `wikidata:...`;

hacia un AuthorityPerson.id.

### candidateRegistry

Mapea el candidato técnico utilizado por un build hacia la autoridad ya promovida.

El candidate ID no sustituye al AuthorityPerson.id.

---

## 7. Rebuild

El pipeline acepta un grafo anterior.

En un rebuild:

- carga autoridades previas;
- conserva IDs;
- añade nuevos nombres;
- añade identificadores;
- agrega nuevas menciones y decisiones;
- actualiza `lastEvaluatedInRevision`.

No reinventa la identidad desde cero.

---

## 8. Benchmark integrado

El pipeline acepta un `goldExpectations` opcional.

El reporte calcula inicialmente:

- menciones evaluadas;
- `falseMergeCount`;
- `missedConfirmationCount`;
- fallos individuales.

### Política

Un build de benchmark se considera fallido si:

`falseMergeCount > 0`.

La precisión de identidad tiene prioridad sobre maximizar el número de perfiles creados.

---

## 9. Fixture real V1

El comando:

`npm run build:authority-fixture`

construye un grafo estático pequeño usando la bibliografía verificada actualmente disponible para Dinora Hernández López.

La entrada real incluye:

- su ORCID verificado;
- sus obras curadas actuales;
- los SourceRecord ya conservados por esas obras;
- una mención target por obra.

El fixture añade además un **homónimo sintético de control** con:

- el mismo nombre;
- ORCID incompatible.

Ese candidato no es una persona real del catálogo. Existe exclusivamente para verificar que coincidencia nominal exacta no pueda superar un veto determinista.

### Condiciones de éxito

El script falla si:

- la bibliografía curada no existe;
- se promueve más de una autoridad;
- el benchmark detecta un falso merge.

### Artefacto

Por defecto genera:

`artifacts/author-authority/fixture-v1.json`

El CI lo publica como artifact:

`author-authority-fixture-v1`.

Este fixture todavía no se sirve a la web.

---

## 10. Reproducibilidad

La primera asignación de ID no depende de:

- fecha;
- SHA del commit;
- buildRevision;
- orden de ejecución;
- nombre visible.

Con la misma evidencia determinista, una reconstrucción limpia produce la misma asignación inicial.

Con un grafo previo, el registry publicado tiene prioridad.

---

## 11. Validaciones

`validateAuthorityGraph()` comprueba al menos:

- schema correcto;
- IDs de AuthorityPerson únicos;
- registries apuntando sólo a autoridades existentes;
- menciones enlazadas existentes;
- links hacia autoridades existentes.

Las pruebas de Fase 3.2 cubren:

- promoción de una identidad real verificada;
- homónimo con ORCID incompatible;
- cero falsos merges en el fixture;
- ambigüedad sin promoción;
- candidato probable sin promoción;
- continuidad del AuthorityPerson.id entre builds;
- incorporación de un nuevo OpenAlex Author ID sin cambiar el ID interno;
- detección del benchmark cuando se confirma al candidato equivocado.

---

## 12. CI

Los cambios del pipeline disparan el workflow `Mobile UI regression`.

Además de la suite existente, CI ahora:

1. ejecuta `npm test`;
2. construye el fixture de Authority Graph;
3. falla si el fixture no supera el gate de identidad;
4. publica el fixture como artifact;
5. continúa con contratos Python;
6. ejecuta las regresiones de navegador.

---

## 13. Límites actuales

V1 todavía no:

- procesa todo author-index-v3 en masa;
- publica el grafo para consumo del navegador;
- construye Contribution canónicas;
- resuelve Work/WorkVersion;
- implementa split automático;
- migra completamente la capa curada;
- reemplaza el perfil de autor existente.

El propósito de este build mínimo es demostrar que la cadena completa de identidad es reproducible antes de escalarla.

---

## 14. Próximo paso

Después de validar este PR, la siguiente fase debe ampliar el build desde el fixture mínimo a un **Authority Build Pipeline de lote**:

1. leer múltiples candidatos desde el índice;
2. agrupar menciones por bloques;
3. reutilizar registry y Decision Ledger;
4. producir shards estáticos;
5. ejecutar golden sets con homónimos reales;
6. medir false merge rate sobre una muestra amplia;
7. sólo entonces comenzar a servir AuthorityPerson al perfil V2.
