# RA1 — Matriz de fixtures V1 del Atlas de Investigación

## Estado

**Fixtures contractuales sintéticos.**

Archivo ejecutable:

`benchmark/research-atlas/v1/fixtures.json`

Los casos parten de un snapshot base deliberadamente rico y aplican mutaciones pequeñas.

Esto permite aislar exactamente qué regla se está probando.

---

## 1. Snapshot base

El snapshot base contiene:

- una consulta;
- dos hits directos;
- una obra expandida;
- tres AuthorityPerson confirmadas;
- una AuthorMention no resuelta;
- query-result;
- contributions;
- author-mention;
- semantic-neighbor;
- lexical-neighbor;
- same-author;
- coauthor;
- shared-coauthor;
- related-work;
- citation explícita.

Todas las relaciones contienen evidencia trazable.

---

## 2. Casos mínimos

### RA01 — base válida

Debe pasar completa.

### RA02 — DOI/identidad duplicada

Dos WorkNode reciben la misma identidad.

Debe fallar.

### RA03 — browser semantic sin consentimiento

La sesión cambia a `browser-semantic` sin `browserOptIn: true`.

Debe fallar.

### RA04 — secreto dentro de sesión

Se introduce un token.

Debe fallar.

### RA05 — obra expandida presentada como hit

Una query-result apunta a una obra con `directHit: false`.

Debe fallar.

### RA06 — hit directo sin query-result

Se elimina la arista que prueba la recuperación directa.

Debe fallar.

### RA07 — misma cadena tratada como AuthorityPerson

Una AuthorMention se transforma artificialmente en AuthorityPerson sin authorityRef válido.

Debe fallar.

### RA08 — contribution desde AuthorMention

Se cambia el origen de una contribution hacia una mención no resuelta.

Debe fallar.

### RA09 — author-mention confirmada

Una arista provisional se marca `confirmed`.

Debe fallar.

### RA10 — semantic-neighbor sin revisión de modelo

Se elimina `modelRevision`.

Debe fallar.

### RA11 — same-author sin identidad estructurada

Se eliminan `authorityRefs`.

Debe fallar.

### RA12 — coauthor sin obra de soporte

Se eliminan `supportWorkRefs`.

Debe fallar.

### RA13 — citation basada sólo en semántica

La evidencia deja de ser bibliográfica explícita.

Debe fallar.

### RA14 — influence

Se cambia el tipo de una arista a `influence`.

Debe fallar porque el vocabulario V1 no lo contiene.

### RA15 — arista hacia nodo inexistente

Debe fallar.

### RA16 — evidencia inexistente

Debe fallar.

### RA17 — self-edge

Debe fallar.

### RA18 — AuthorityPerson duplicada

Dos nodos apuntan a la misma autoridad.

Debe fallar.

### RA19 — diagnostics falsos

Debe fallar.

---

## 3. Regla de crecimiento

Todo bug epistemológico futuro debe añadir un fixture antes o junto con su corrección.

No se crearán excepciones por autor, obra o proveedor concreto dentro del contrato general.
