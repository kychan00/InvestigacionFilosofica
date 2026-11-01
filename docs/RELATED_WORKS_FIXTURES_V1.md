# Related Works — Matriz de fixtures V1

## Estado

**Fase 0 — golden contract sintético.**

Los fixtures ejecutables viven en:

`benchmark/related-works/v1/fixtures.json`

La suite:

`tests/related-work-contract.test.mjs`

verifica el contrato sin depender de red, navegador ni ranking.

---

## 1. Objetivo

Los fixtures no evalúan todavía si el ranking es «bueno».

Evalúan algo previo:

> ¿La relación que intentamos afirmar está autorizada por la evidencia disponible?

Esto evita optimizar Precision@6 sobre un modelo semánticamente incorrecto.

---

# 2. Casos ejecutables actuales

## RW01 — afinidad semántica válida

Una vecindad Qwen3 fuerte puede producir:

`semantic-affinity`.

No afirma autoría ni citación.

## RW02 — topic compartido

Dos obras comparten un topic estructurado.

Puede producir:

`shared-topic`.

## RW03 — mismo autor con identidad estructurada

Una AuthorityPerson compartida permite:

`same-author`.

## RW04 — mismo nombre no demuestra mismo autor

«José Martínez» aparece igual en dos obras.

Sin autoridad resuelta, la relación `same-author` debe fallar.

Este fixture protege contra homonimia.

## RW05 — coautor compartido

Una autoridad de coautor resuelta en ambas obras permite:

`shared-coauthor`.

## RW06 — citación explícita

Una tabla/fuente bibliográfica contiene la arista seed → target.

Puede producir:

`cited-by-seed`.

## RW07 — similitud semántica no inventa citación

Dos textos tienen similitud .95.

No existe referencia estructurada.

`cites-seed` debe fallar.

Éste es uno de los fixtures más importantes del sistema.

## RW08 — tiempo por sí solo es insuficiente

Dos publicaciones están separadas por un año.

`historical-context` como única relación debe fallar.

## RW09 — tiempo como refuerzo

La proximidad histórica sí puede coexistir con una relación semántica independiente.

## RW10 — autorelación

Una obra no puede ser su propia relacionada.

## RW11 — edición/version de la misma obra

Una nueva edición no ocupa un lugar en Obras relacionadas.

El sistema de obra/version deberá tratarla por separado.

## RW12 — mismo debate

Dos obras comparten un concepto estructurado y contexto de debate.

La relación puede conservar:

- `shared-concept`;
- `same-debate`.

## RW13 — razón sin evidencia

Una razón que apunta a un Evidence ID inexistente debe invalidar la arista.

## RW14 — señales múltiples

Una obra puede ser simultáneamente:

- semánticamente afín;
- del mismo autor.

Las razones permanecen separadas.

## RW15 — rango de señales

Una señal normalizada >1 o <0 invalida el contrato.

## RW16 — relación bibliográfica genérica

`bibliographic-reference` exige:

- evidencia bibliográfica;
- identidad estructurada;
- arista explícita.

---

# 3. Casos obligatorios antes de Fase 1 completa

La matriz debe crecer antes de congelar el builder.

## RW17 — veto activo

Una contradicción determinista/bibliográfica debe impedir publicar una arista aun si la semántica es alta.

## RW18 — duplicado DOI

Dos registros de proveedor describen la misma obra.

El objetivo debe deduplicarse antes de generar la arista.

## RW19 — dos ISBN de la misma obra

No deben ocupar dos posiciones de relacionadas si Work Resolution indica una misma IntellectualWork.

## RW20 — shared topic por string solamente

Misma palabra en título sin topic estructurado.

No debe producir automáticamente `shared-topic`.

## RW21 — coautor con homónimo

Dos cadenas de nombre iguales pero autoridades distintas.

No debe producir `shared-coauthor`.

## RW22 — concepto + semántica fuerte

Caso positivo de relación filosófica múltiple.

## RW23 — relación externa fuera del corpus

Seed curada/Internet Archive resuelta a un Work ID del índice.

Debe poder consumir vecinos del corpus.

## RW24 — seed sin mapeo

No existe identidad compatible en relation-index.

Debe producir empty/partial, no resultados inventados.

---

# 4. Regresiones reales futuras

Los fixtures sintéticos definen invariantes.

Después se agregará un golden set manual con casos reales.

## RR01 — Dinora Hernández López

Seleccionar varias obras verificadas y comprobar que:

- las relaciones de misma autora usan AuthorityPerson;
- las coordinaciones no se tratan automáticamente como autoría individual;
- no aparecen duplicados de metadatos históricos incorrectos;
- trabajos de teoría crítica relacionados no desplazan toda la diversidad.

## RR02 — Theodor W. Adorno

Debe comprobar:

- alta densidad semántica;
- riesgo de resultados redundantes;
- diversidad de autores;
- distinción entre obra primaria y literatura secundaria.

## RR03 — Immanuel Kant

Debe comprobar:

- versiones/ediciones/traducciones;
- obra primaria vs comentario;
- problemas filosóficos compartidos;
- deduplicación.

## RR04 — obra UdeG contemporánea

Debe comprobar:

- fuente institucional;
- autores locales;
- relaciones con corpus global;
- funcionamiento cuando no existe una cobertura semántica perfecta.

## RR05 — obra fuera de OpenAlex Philosophy

Debe comprobar fallback limpio y estado parcial.

---

# 5. Golden set humano de ranking

El contrato sintético no decide pesos.

Para calibrar el ranking se propone posteriormente:

- 30–50 seeds;
- 10–20 candidatos juzgados por seed;
- al menos dos revisores cuando sea posible.

Etiqueta humana:

- `3 — conexión central`;
- `2 — claramente útil`;
- `1 — relación marginal`;
- `0 — irrelevante`.

Además:

- tipo de relación percibido;
- duplicado;
- falso positivo de autoría;
- falso positivo de citación.

---

# 6. Métricas futuras

Ranking:

- Precision@6;
- nDCG@6;
- MRR cuando aplique.

Higiene:

- duplicate rate;
- self relation rate;
- same-work-version leakage;
- false citation rate;
- false authorship relation rate.

Diversidad:

- autores únicos@6;
- familias de relación@6;
- redundancia semántica media.

Producto:

- latencia p50/p95;
- bytes descargados;
- cache hit rate;
- porcentaje de fichas con 4+ relaciones confiables.

---

# 7. Regla de promoción

La Fase 1 no se considerará lista sólo porque el índice pueda generar vecinos.

Debe demostrar:

1. cero self-relations;
2. cero citas inventadas en fixtures;
3. cero relaciones de autoría basadas únicamente en nombre;
4. versiones duplicadas filtradas;
5. evidencia trazable;
6. reasons reproducibles;
7. integridad del artefacto estático;
8. cobertura medida.

---

# 8. Principio de benchmark

El algoritmo no puede definir su propio ground truth.

Los vecinos semánticos pueden generar candidatos, pero no deben usarse automáticamente como respuesta correcta en el benchmark humano.

El golden set se revisará por separado.
