---
type: product-ranking-decision
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-27
---

# Author Intent Ranking V1

## Problema observado

La búsqueda federada ponderaba principalmente el título. Al consultar un nombre
de persona, una mención parcial podía preceder obras cuya autoría coincidía de
forma directa. En la consulta `Alonso Nava Amezcua`, una obra del autor aparecía
en el puesto 11; búsquedas como `Kant` favorecían comentarios sobre el filósofo
antes que obras atribuidas a él.

## Decisión productiva

Cuando el conjunto recuperado contiene una coincidencia fuerte en `authors`, el
orden aplica primero una prioridad bibliográfica y después conserva el score
preexistente como desempate:

1. **A3 · autor exacto:** los tokens normalizados del nombre y de la consulta
   coinciden como conjunto, aun cuando el catálogo invierta el orden mediante
   coma.
2. **A2 · autor contenido:** todos los tokens de la consulta pertenecen al
   nombre del autor. Esta prioridad sólo se activa con dos o más tokens o cuando
   el parser reconoce a un filósofo, como `Kant` → `Kant, Immanuel`.
3. **A0 · sin coincidencia fuerte:** se conserva el ranking anterior.

La comparación usa tokens completos, no subcadenas. Una coincidencia parcial de
apellido —por ejemplo `Amezcua` dentro de un autor distinto— no desplaza una
coincidencia exacta. Un término temático aislado no reconocido como filósofo no
activa la prioridad A2.

Para que la presentación no contradiga el orden, A3 fija un piso visible de
95/100 y A2 de 90/100. La tarjeta expone `A 3`, `A 2` o `A 0`, y la explicación
indica la autoría coincidente.

## Retirada del modo browser público

El mismo cambio retiró de `index.html` la opción `En este navegador · beta`, su
panel de consentimiento, estilos y lógica de activación. `js/app.js` ya no
importa ni ejecuta el cliente browser-static V4, incluso si se añade el antiguo
parámetro URL. Permanecen disponibles `Tradicional` y `Semántica · alfa`.

Los módulos, shards y evidencia de [[Browser-Semantic-Static-V4]] no fueron
eliminados ni modificados: se conservan como historia técnica y material
reproducible, pero no como superficie pública de producto.

## Verificación

- PR de producción: `#18`.
- Merge: `e4c5646f1db7cd50cbe151acba4114c17c9639a0`.
- GitHub Pages: workflow `40616167147`, exitoso.
- Suite: 84/84 pruebas JavaScript.
- `Alonso Nava Amezcua`: tres obras del autor quedaron en puestos 1–3; antes la
  primera coincidencia exacta observada estaba en el puesto 11.
- `Kant`: una obra con autor `Kant, Immanuel` precede un texto contemporáneo
  acerca de Kant.
- Producción pública: sólo dos modos visibles y primer resultado de Alonso con
  `A 3` y relevancia 95.

## Límite científico

Esta es una corrección explícita de comportamiento bibliográfico en producción,
no una promoción de Qwen. No usa inferencia, reranker, labels humanos, ajuste a
holdouts ni datos del adjudicador externo. No altera retrieval, el índice
semántico ni los artefactos congelados bajo `benchmark/qwen3`; sus conclusiones
permanecen intactas.

## Evolución

[[Remote-Author-Identity-V1]] añade una capa posterior: además de reordenar
coincidencias ya recuperadas, puede resolver variantes del nombre contra un
índice remoto del corpus propio y anteponer obras de autoría directa. La regla
V1 permanece como fallback cuando el autor no existe en ese snapshot o la
resolución externa no está disponible.
