# RA13 — Author Identity / ORCID Graph

## Estado

**RA13-A · infraestructura de identidad dinámica.**

RA13 añade una capa query-scoped de identidad académica al Atlas sin modificar la topología primaria **Work-first** de RA11.

```text
Work ↔ Work                    ← geometría primaria RA11
  ↑
  │ contribution
  │
AuthorityPerson               ← identidad RA13
  │
  ├── ORCID
  ├── OpenAlex author ID
  ├── aliases observados
  └── affiliations observadas

AuthorityPerson ↔ AuthorityPerson
          coauthor
```

## 1. Regla central

**Nombre no es persona.**

RA13-A sólo materializa automáticamente `AuthorityPerson` cuando el `SearchResponse` contiene un identificador determinista admitido:

- ORCID;
- OpenAlex Author ID.

Una cadena de nombre sin identificador permanece como `AuthorMention`.

No existe fusión automática por similitud nominal.

## 2. ORCID como ancla

Cuando existe ORCID, éste funciona como la clave preferida de identidad query-scoped.

Ejemplo:

```text
Mauricio Méndez Huerta
M. Méndez Huerta
        │
        └── ORCID 0000-....
                  │
                  ▼
          AuthorityPerson única
```

Una observación que contiene simultáneamente ORCID + OpenAlex Author ID permite registrar ambos identificadores en la misma persona.

Si otra observación contiene solamente ese OpenAlex Author ID, puede converger hacia la autoridad ORCID ya observada.

## 3. Conflictos

RA13 falla cerrado.

Si un mismo OpenAlex Author ID aparece asociado a dos ORCID diferentes dentro del mismo territorio:

- el OpenAlex Author ID se marca como conflictivo;
- no entra al `identifierRegistry`;
- no se usa para fusionar personas;
- las observaciones con ORCID todavía pueden resolverse por su ORCID;
- una observación que dependa únicamente del identificador conflictivo queda sin resolver.

Nunca se elige un ORCID arbitrariamente.

## 4. Relaciones

RA13 reutiliza el contrato del Atlas existente.

No crea vocabulario paralelo cuando ya existe una relación formal:

- `contribution`: AuthorityPerson → Work;
- `same-author`: Work ↔ Work derivada de una AuthorityPerson compartida;
- `coauthor`: AuthorityPerson ↔ AuthorityPerson derivada de una obra compartida;
- `author-mention`: mención provisional → Work.

Toda relación sigue conservando evidencia y procedencia.

## 5. Instituciones

RA13-A conserva instituciones/afiliaciones como metadatos de `AuthorityPerson`.

Las instituciones pueden provenir de contexto ya presente en el `SearchResponse`, por ejemplo `orcidSearch.institutions`.

RA13-A **no hace una nueva llamada a ORCID desde el Atlas**.

Los nodos de institución y las aristas explícitas `affiliation` se reservan para RA13-B, después de congelar su contrato y semántica temporal.

## 6. Sin segunda búsqueda

Se conserva la regla RA0/RA9:

> El Atlas consume la búsqueda; no la reemplaza.

RA13 no consulta proveedores por su cuenta.

Consume:

```text
SearchResponse
   ├── works
   ├── authors
   ├── author.orcid
   ├── author.id (OpenAlex cuando existe)
   └── orcidSearch.institutions
```

y construye una autoridad temporal reproducible para esa consulta.

## 7. Work-first intacto

La capa de identidad es satélite.

No modifica:

- TF-IDF;
- Qwen3 semantic-neighbor;
- distancias obra↔obra;
- topK;
- maximumEdges;
- ranking.

Las pruebas RA13 comparan la topología Work↔Work con y sin identidad y exigen igualdad.

## 8. Integración

`ResearchAtlasAssembler` acepta:

```js
new ResearchAtlasAssembler({
  dynamicIdentity: true
})
```

Cuando está habilitado y no se proporciona un `authorityGraph` explícito:

1. se construye la autoridad query-scoped;
2. se reutiliza `enrichResearchAtlasWithAuthority()`;
3. se materializan personas, contribuciones, coautorías y menciones;
4. el snapshot registra `session.identityLayer` y `diagnostics.identityLayer`.

Un `authorityGraph` explícito siempre tiene prioridad sobre RA13 dinámico.

## 9. Diagnóstico visible

RA13 registra:

- observaciones de autor;
- AuthorityPersons;
- autoridades con ORCID;
- autoridades sólo OpenAlex;
- afiliaciones observadas;
- menciones sin identificador;
- conflictos de identificador.

Esto permite auditar cuánto del territorio tiene identidad fuerte y cuánto sigue siendo provisional.

## 10. Siguiente fase

**RA13-B · Institution Graph**

Objetivo:

```text
AuthorityPerson
      │
      ├── affiliation ── Institution
      │
      └── contribution ─ Work
```

Antes de activarlo se deberá definir:

- identidad canónica de institución;
- temporalidad de afiliaciones;
- fuente y estado de cada relación;
- tratamiento de nombres históricos;
- reglas para no confundir campus, departamento e institución matriz.
