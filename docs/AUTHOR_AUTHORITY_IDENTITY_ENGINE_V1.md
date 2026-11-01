# Identity Resolution Engine V1

## Estado

**Fase 3 — núcleo implementado, todavía no conectado al runtime de perfiles.**

El módulo `src/core/author-authority-resolution.js` implementa la primera versión del resolvedor genérico definido por:

- `AUTHOR_AUTHORITY_ARCHITECTURE_V1.md`;
- `AUTHOR_AUTHORITY_DATA_CONTRACTS_V1.md`;
- `AUTHOR_AUTHORITY_FIXTURES_V1.md`.

La intención de esta fase es validar la lógica de identidad de forma aislada antes de permitir que gobierne perfiles reales.

## API inicial

El módulo expone:

- `authorityIdentifiers(entity)`;
- `authorityNames(entity)`;
- `blockAuthorityCandidates(mention, candidates)`;
- `evaluateIdentityCandidate(mention, candidate)`;
- `resolveAuthorMention(mention, candidates)`;
- `evaluateAuthorityMerge(left, right)`.

## Jerarquía de evidencia

El motor no utiliza una puntuación total acumulativa.

Las evidencias se clasifican en:

- **A** — identificadores deterministas;
- **B** — evidencia bibliográfica fuerte;
- **C** — evidencia contextual;
- **D** — evidencia nominal;
- **VETO** — contradicción que impide la resolución automática.

La comparación entre candidatos es lexicográfica por clase de evidencia y sólo se usa para ordenar/inspeccionar. La decisión no se obtiene sumando puntos.

### Clase A

En V1 se consideran deterministas cuando coinciden:

- ORCID;
- OpenAlex Author ID;
- Wikidata ID.

Un ORCID incompatible genera `VETO`.

### Clase B

Actualmente puede provenir de:

- afiliación exacta;
- obra conocida compartida;
- red de al menos dos coautores compartidos.

### Clase C

Actualmente incluye:

- un coautor compartido.

### Clase D

Puede provenir de:

- nombre normalizado exacto;
- firma nominal con los mismos tokens en distinto orden;
- inicial compatible;
- nombre corto contenido en una forma más completa.

Una señal D puede generar candidato, pero nunca confirma por sí sola una identidad.

## Vetos

V1 implementa dos vetos explícitos:

1. ORCID incompatibles.
2. Segundo apellido completo incompatible cuando ambas entradas proporcionan estructura explícita de apellidos y comparten el primer apellido.

Un veto domina cualquier cantidad de evidencia B, C o D.

## Candidate blocking

El bloqueador sólo conserva candidatos que compartan al menos una de estas señales:

- identificador determinista;
- compatibilidad nominal;
- evidencia bibliográfica fuerte.

Candidate blocking no resuelve identidad. Sólo reduce el conjunto que debe evaluarse.

## Estados de decisión

### confirmed

Sólo se produce automáticamente cuando existe un único candidato con evidencia A y sin veto.

### probable

Se produce cuando existe un único candidato con evidencia B y no hay otro candidato fuerte compatible.

No equivale a identidad confirmada.

### ambiguous

Se produce, entre otros casos, cuando:

- varios candidatos siguen siendo compatibles;
- varios candidatos comparten el mismo identificador determinista y deben resolverse como posible merge;
- una forma corta coincide con varios nombres completos.

### unresolved

Se produce cuando:

- no se bloquea ningún candidato;
- sólo existe evidencia nominal/contextual insuficiente;
- todos los candidatos disponibles fueron vetados.

### rejected

Se aplica a la evaluación individual o pairwise cuando existe un veto.

## Resolución de merge

`evaluateAuthorityMerge(left, right)` reutiliza la misma jerarquía de evidencia.

Dos autoridades con ORCID distintos se rechazan como merge automático.

Dos autoridades con el mismo ORCID pueden producir evidencia determinista de merge, pero el pipeline futuro deberá conservar redirect e historial según los contratos de Fase 2.

## Lo que el motor deliberadamente no utiliza

La cantidad de obras de un candidato no participa en la decisión.

Campos como:

- `corpusWorks`;
- citas;
- popularidad;
- posición en resultados;

no pueden demostrar identidad.

Esto corrige explícitamente la heurística histórica en la que un candidato con muchas más obras podía parecer dominante.

## Pruebas implementadas

`tests/author-authority-resolution.test.mjs` implementa los fixtures de identidad iniciales:

- F01 — mismo ORCID, nombres distintos;
- F02 — mismo nombre, ORCID incompatibles;
- F03 — segundo apellido incompatible;
- F03b — forma corta compartida;
- F04 — popularidad bibliográfica no demuestra identidad;
- F05 — evidencia bibliográfica fuerte frente a homónimos;
- F06 — diacríticos;
- F07 — orden apellido/nombre;
- F08 — iniciales insuficientes.

También prueba:

- ORCID compartido por dos autoridades → merge pendiente, no elección arbitraria;
- candidate blocking por identificador aunque cambie el nombre;
- veto prevalece sobre evidencia débil acumulada;
- un caso conocido puede recorrer exactamente el mismo resolvedor genérico.

## Regla anti-excepciones

El núcleo no contiene nombres de autores, IDs curados ni ramas específicas de investigadores.

Los casos reales pueden aparecer en pruebas como regresiones, pero nunca dentro de las reglas del motor.

## Integración futura

Esta fase no sustituye todavía:

- `author-identity-lookup.js`;
- `remote-author-resolution.js`;
- `author-deep-discovery.js`;
- la capa curada;
- el perfil de autor.

La integración deberá hacerse sólo después de que el motor y sus fixtures pasen la suite del repositorio.

## Siguiente paso

La siguiente subfase de Identity Resolution debe añadir:

1. persistencia/versionado de `ResolutionDecision`;
2. conversión explícita de registros actuales a `AuthorMention`;
3. adaptadores desde author-index-v3 a candidatos de `AuthorityPerson`;
4. pruebas de merge/split y memoria de rechazos;
5. benchmark con autores reales múltiples antes de activar el motor en UI.

