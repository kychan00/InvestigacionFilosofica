# Author Authority — Decision Ledger y adaptadores V1

## Estado

**Fase 3.1 — infraestructura de identidad, todavía sin activar en la UI.**

Esta subfase conecta conceptualmente el Identity Resolution Engine V1 con los datos que ya existen en Investigación Filosófica, sin sustituir todavía el resolvedor de producción.

Introduce dos componentes:

- `author-resolution-decision-ledger.js`;
- `author-authority-adapters.js`.

---

## 1. Decision Ledger

El Decision Ledger permite conservar decisiones de resolución entre reconstrucciones.

Su objetivo es evitar que el sistema vuelva a evaluar desde cero decisiones ya conocidas sin conservar su historia.

### Contrato

El ledger serializable tiene:

- `schemaVersion`;
- colección de `ResolutionDecision`.

Cada decisión conserva:

- tipo;
- sujetos;
- targets;
- estado;
- evidencia snapshot;
- vetos snapshot;
- versión del algoritmo;
- revisión del dataset;
- modo de decisión;
- revisión en la que se decidió;
- decisión anterior que supersede.

### Propiedades

#### Inmutabilidad histórica

Una decisión nueva no reescribe la anterior.

Si una atribución pasa de:

`unresolved`

a:

`confirmed`

se crea una nueva decisión con `supersedesDecisionRef`.

#### Dedupe

La misma decisión, con el mismo resultado, algoritmo y revisión de datos, no se vuelve a insertar.

#### Memoria negativa

Un rechazo puede persistirse.

Esto permite recordar que:

> cierta mención no pertenece a cierta autoridad

por una razón como ORCID incompatible.

La futura reconstrucción podrá utilizar este conocimiento para no reabrir falsos positivos conocidos salvo que exista una nueva decisión que superseda el rechazo.

#### Serialización

El ledger puede serializarse a JSON y rehidratarse sin perder:

- IDs;
- historia;
- evidencia;
- vetos;
- supersesión.

### Lo que todavía no hace

Esta fase no decide dónde vivirá físicamente el ledger publicado.

Eso corresponde al Authority Build Pipeline.

Puede terminar como:

- artefacto de release;
- shard del grafo;
- snapshot generado en CI;
- otro formato versionado.

La interfaz no escribe decisiones globales.

---

## 2. Adaptadores del sistema actual

El archivo `author-authority-adapters.js` traduce estructuras existentes a entradas del nuevo Authority Graph.

No modifica las fuentes originales.

### author-index / snapshot

Un registro del índice actual se convierte en un:

`AuthorityCandidate`

y no en un `AuthorityPerson`.

Esto es deliberado.

El ID OpenAlex se conserva como:

`ExternalIdentifierAssertion(openalex-author)`

y ORCID como:

`ExternalIdentifierAssertion(orcid)`.

Ninguno se convierte en el ID interno canónico del futuro `AuthorityPerson`.

### IDs enlazados

Cuando el resolvedor actual agrupa varios OpenAlex Author IDs por evidencia determinista, el candidato conserva todos esos IDs como identificadores externos.

El grupo sigue siendo candidato hasta que el Authority Build Pipeline lo promueva.

### Obras actuales

Una obra normalizada puede producir uno o más `SourceRecord`.

Si existen varios `sourceRecords`, todos se conservan.

Esto impide convertir una obra fusionada en una sola procedencia ficticia.

### Creadores

Los creadores actuales se convierten en `AuthorMention`.

Se conserva:

- texto original;
- forma normalizada;
- posición;
- rol original;
- rol normalizado candidato;
- ORCID embebido;
- OpenAlex Author ID embebido;
- indicio de cadena compuesta.

### Cadenas colectivas

Los adaptadores reutilizan la política de `splitCreatorMetadata`.

Cuando una cadena puede separarse con seguridad, produce menciones individuales.

Cuando no puede separarse, conserva la naturaleza compuesta y no inventa personas.

---

## 3. IDs técnicos

Los IDs de `SourceRecord` y `AuthorMention` son deterministas dentro de una revisión lógica.

No se construyen únicamente eliminando signos de:

- URLs;
- DOI;
- identificadores externos.

Se utiliza un hash FNV-1a de la procedencia/identificador original para evitar colisiones simples causadas por sanitización.

Esto no convierte esos IDs técnicos en IDs de autoridad personal.

---

## 4. Relación con AuthorityPerson

La cadena correcta queda:

    author-index / proveedor
             │
             ▼
      AuthorityCandidate
             │
             ▼
      Identity Resolution
             │
             ▼
      ResolutionDecision
             │
             ▼
       AuthorityPerson
       (fase posterior)

Un proveedor nunca crea directamente la identidad canónica.

---

## 5. Compatibilidad con el resolvedor V1

Los candidatos generados por los adaptadores tienen el mismo vocabulario que consume:

`resolveAuthorMention()`

Por tanto, ya es posible hacer:

    datos actuales
        │
        ▼
    AuthorMention
        │
        + AuthorityCandidate[]
        ▼
    resolveAuthorMention()
        │
        ▼
    ResolutionDecision
        │
        ▼
    Decision Ledger

sin modificar todavía la UI.

---

## 6. Tests

### Decision Ledger

Se comprueba:

- serialización/rehidratación;
- dedupe de decisión activa;
- supersesión sin borrado;
- memoria de rechazo;
- validación de referencias históricas.

### Adaptadores

Se comprueba:

- OpenAlex queda como identificador externo;
- ORCID queda como identificador externo;
- grupos de IDs snapshot preservan todos los IDs;
- varios SourceRecord no se colapsan;
- IDs técnicos no colisionan por diferencias de separadores;
- creador → AuthorMention;
- cadenas estructuradas → menciones separadas;
- obra del índice → mención target;
- adaptador + resolvedor funcionan juntos sin lógica especial por autor.

---

## 7. Seguridad arquitectónica

Esta fase mantiene:

- cero llamadas a `api.openalex.org`;
- UI sin cambios;
- perfiles de producción sin cambios;
- capa curada actual sin eliminación;
- author-index-v3 sin modificación física;
- historia de decisiones separada de la evidencia fuente.

---

## 8. Siguiente paso

Una vez validada esta subfase, el siguiente paso es construir el primer **Authority Build Pipeline mínimo**:

1. tomar candidatos del índice;
2. crear menciones;
3. resolverlas con el motor;
4. persistir decisiones;
5. promover únicamente identidades justificadas a `AuthorityPerson`;
6. producir un fixture/grafo estático pequeño;
7. medir falsos merges antes de escalar.

Todavía no se activará el perfil V2 hasta que ese pipeline tenga regresiones masivas.
