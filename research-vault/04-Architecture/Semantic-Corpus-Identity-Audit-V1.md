---
type: validation
area: semantic-retrieval
status: corpus-gate-passed-no-serving-change
updated: 2026-10-09
---

# Auditoría corpus-wide de identidad semántica V1

## Pregunta del gate

¿Puede aplicarse la identidad exacta de [[Semantic-Presentation-Hygiene-V1]]
al índice V3.3 completo sin unir registros mediante similitud probable, perder
provenance o modificar recuperación y ranking?

## Contrato congelado

El runner quedó congelado en
`3b5e21ff32c2dd831ea6dd1c2a5fe6ecbf1e0ee9` antes de la pasada completa.
Abre SQLite como read-only e immutable y define identidad exacta como:

- DOI normalizado compartido; o
- título, año y abstract normalizados exactamente iguales.

No ejecuta embeddings ni reranker, no usa labels humanos y no cambia corpus,
FAISS, scores, orden, retrieval, API, frontend ni producción.

## Resultado V3.3

La ejecución aceptada auditó los 451.823 registros del metadata database con
SHA-256
`e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`.
Quedó congelada en `d9bb1ca`.

- 9.266 grupos exactos;
- 21.351 registros miembros;
- 12.085 filas repetidas potencialmente colapsables en presentación;
- grupo máximo de 471 miembros;
- cero DOI no vacíos en este snapshot;
- 12.284 hallazgos de HTML literal;
- 1.767 hallazgos de posible mojibake;
- 751 títulos vacíos.

El corpus no ejercitó la rama DOI: esa conducta permanece cubierta sólo por
pruebas sintéticas y exige revisión si una versión futura incorpora DOI.

## Validación independiente

La reconstrucción independiente confirmó:

- todos los 21.351 miembros existen en SQLite;
- ningún ID pertenece a dos grupos;
- cero discrepancias entre contenido fuente y hashes exactos;
- cero discrepancias de ID;
- cero variaciones de autores dentro de un grupo;
- cero conflictos entre autores no vacíos;
- muestra determinista y orden de grupos reproducidos.

Existieron 935 grupos con variación en `publication_type`. Esto no cambia su
igualdad exacta de título+año+abstract, pero impide tratar el colapso como una
reescritura del registro: todos los IDs y metadatos miembros deben conservarse
en provenance.

El primer intento de invocación llevaba un SHA esperado mal transcrito y se
detuvo antes de crear outputs o escanear documentos. La pasada aceptada usó el
hash ya fijado por los recibos del índice y del serving público.

## Interpretación

El gate corpus-wide pasa para una capa exclusivamente presentacional y
conservadora. No evalúa relevancia, no demuestra mejora de ranking y no
autoriza por sí solo una modificación de serving.

La fuente canónica está en
`benchmark/semantic-retrieval/corpus-identity-audit-v1/`; este documento sólo
conserva su interpretación metodológica.

## Próximo límite

Una integración posterior debe ser separada, default-off y verificable. Debe
demostrar que la respuesta API conserva scores y orden de representantes,
expone provenance completa para miembros colapsados y mantiene fallback. No
debe tocar `src/core/rank.js` ni convertir identidad probable en deduplicación.
