# Continuación de la matriz bibliográfica de filósofos latinoamericanos

**Estado de corte:** 16 de noviembre de 2026  
**Repositorio:** `kychan00/InvestigacionFilosofica`  
**PR anterior:** #336 — mergeado a `main`  
**Merge commit de corte:** `b4563ee0dcc2e7bb0daae2e639a8db4d6ba402ab`  
**Nueva rama de trabajo:** `data/philosopher-works-matrix-continuation-049`

## 1. Objetivo

Continuar y completar la matriz bibliográfica y de metadatos para el inventario canónico de **1,504 filósofos, pensadores e intelectuales latinoamericanos, caribeños y latinos** del proyecto Investigación Filosófica.

La fuente canónica del inventario es:

> Enrique Dussel, Eduardo Mendieta y Carmen Bohórquez (eds.), *El pensamiento filosófico latinoamericano, del Caribe y “latino” (1300–2000): historia, corrientes, temas y filósofos*.

Inventario de autoridad:

`src/data/latin-american-philosophers-metadata.json`

Matriz bibliográfica:

`src/data/philosopher-works/`

## 2. Estado ya mergeado

El PR #336 quedó **mergeado a `main`** y constituye la base cerrada de la primera etapa.

Estado absorbido en `main`:

- **1,504 autores** en el inventario maestro.
- **480 autores con ficha bibliográfica**, IDs **0001–0480**.
- **2,908 obras, manuscritos, artículos, tesis, documentos, traducciones, ediciones y contribuciones** registradas.
- Lotes completados: **001–048**.
- Último archivo de autor mergeado: `authors/0480.json`.
- Último lote mergeado: **048**.
- PR histórico consolidado: **#336**.
- El PR #336 ya no debe reutilizarse para nuevos lotes.

## 3. Trabajo pendiente

Quedan:

- **1,024 autores**.
- IDs pendientes: **0481–1504**.
- Próximo lote: **049**, IDs **0481–0490**.

Autores del lote 049:

1. 0481 — Vicente Ferreira da Silva
2. 0482 — Moacir Teixeira de Aguiar
3. 0483 — Gerd Alberto Bornheim
4. 0484 — Emmanuel Carneiro Leão
5. 0485 — Antônio Luís Machado Neto
6. 0486 — Ernildo Stein
7. 0487 — Creusa Capalbo
8. 0488 — Maria do Carmo Tavares de Miranda
9. 0489 — Tarcísio Meirelles Padilla
10. 0490 — Euryalo Cannabrava

Después se continúa estrictamente por IDs consecutivos hasta **1504**.

## 4. Regla operativa del nuevo PR

Esta rama y su PR son el **nuevo PR consolidado** para la continuación de la matriz.

- Añadir aquí los lotes **049 en adelante**.
- Trabajar normalmente de **10 autores por lote**.
- **No crear un PR nuevo por cada lote.**
- Mantener este PR abierto durante la investigación.
- **No hacer merge a `main` sin autorización explícita del usuario.**
- Si el usuario dice “sigamos”, continuar con los siguientes 10 IDs.
- Antes de cada escritura, comprobar el HEAD real de la rama porque puede haber cambios paralelos.
- Si la rama se mueve, montar el siguiente lote sobre el HEAD más reciente y preservar los cambios ajenos.
- No reescribir ni borrar fichas ya mergeadas salvo corrección documental explícita.

## 5. Alcance de los cambios

La continuación debe limitarse principalmente a:

- `src/data/philosopher-works/authors/NNNN.json`
- `src/data/philosopher-works/manifest.json`
- este documento de continuidad, cuando haga falta actualizar el corte.

No tocar frontend, CSS, navegación, atlas, runtime, workflows ni scripts de QA salvo que el usuario lo pida expresamente.

## 6. Estructura por autor

Cada autor tiene un archivo independiente:

`src/data/philosopher-works/authors/NNNN.json`

Debe mantener, cuando proceda:

- `schema_version`
- `author_id`
- `canonical_name`
- `alternate_names`
- `life`
- `coverage`
- `works`
- `non_bibliographic_contributions`
- `sources`
- `research_notes`

Los `work_id` deben ser consecutivos dentro del autor:

- `0481-w001`
- `0481-w002`
- etc.

## 7. Criterios editoriales y bibliográficos

### Identidad

Antes de atribuir obras:

- resolver homónimos;
- conservar el nombre canónico del inventario;
- añadir formas de autoridad correctas en `alternate_names`;
- documentar discrepancias onomásticas en `research_notes`.

### Fechas

Distinguir siempre:

- fecha de composición;
- tesis o manuscrito;
- primera publicación;
- reedición;
- traducción;
- edición póstuma;
- recopilación posterior.

Nunca convertir una reedición en una obra nueva.

### Autoría

Distinguir expresamente:

- autor;
- coautor;
- editor;
- coordinador;
- compilador;
- traductor;
- prologuista;
- copista;
- director de revista;
- responsable institucional.

No atribuir al editor o coordinador todos los textos de una obra colectiva.

### Evidencia

Prioridad aproximada:

1. ejemplar/edición primaria o catálogo de biblioteca;
2. repositorio universitario o archivo nacional;
3. editorial;
4. autoridad académica o biobibliografía;
5. artículo académico especializado;
6. fuente secundaria confiable.

Cuando dos fuentes discrepen:

- no ocultar la discrepancia;
- seleccionar la fecha o forma mejor sustentada;
- registrar la variante en `notes` o `research_notes`.

Si una obra no puede verificarse con suficiente seguridad, es preferible **no incluirla** antes que inventar metadatos.

### Palabras clave

Usar procedencia explícita cuando sea posible:

- `editorial`
- `catalog`
- `scholarly`
- `inferred`

Evitar inferencias innecesarias si existe vocabulario documental.

## 8. Cobertura

`coverage.status: "seeded"` significa:

> ficha bibliográfica inicial, verificable y auditable; **no bibliografía exhaustiva**.

No intentar completar absolutamente toda la producción de cada autor en esta primera pasada. Priorizar las obras filosóficamente centrales y documentalmente verificables.

## 9. Contribuciones no bibliográficas

Puede registrarse una contribución intelectual por autor cuando ayude a situar:

- corriente;
- problema;
- escuela;
- influencia;
- institucionalización;
- recepción filosófica;
- docencia o proyecto intelectual.

No sustituye obras que sí sean bibliográficamente verificables.

## 10. Actualización de manifest

Al cerrar cada lote:

- incrementar `authors_seeded`;
- reducir `authors_remaining`;
- sumar obras + contribuciones a `works_or_contributions_seeded`;
- actualizar `current_batch`;
- actualizar `last_updated`;
- añadir `batch_0XX` con los 10 autores y rutas correspondientes.

Estado de arranque del nuevo PR:

```json
{
  "authors_total": 1504,
  "authors_seeded": 480,
  "authors_remaining": 1024,
  "works_or_contributions_seeded": 2908,
  "current_batch": "048",
  "last_updated": "2026-11-16"
}
```

## 11. Auditoría obligatoria por lote

Después de cada commit comprobar:

- 10 IDs correctos para el lote;
- archivos consecutivos desde `0001.json` hasta el nuevo último ID;
- cero faltantes;
- JSON válido;
- `work_id` consecutivos;
- nombres canónicos correctos;
- URLs de evidencia presentes;
- roles de autoría explícitos;
- manifiesto actualizado;
- conteo exacto de obras + contribuciones;
- ausencia de cambios inesperados fuera de la matriz.

Informar siempre el nuevo:

- HEAD;
- total de autores cubiertos;
- porcentaje de cobertura;
- total de registros;
- autores pendientes;
- siguiente lote.

## 12. Historial relevante

El PR #336 consolidó y absorbió los lotes **001–048**.

Último lote mergeado, **048 — IDs 0471–0480**:

- Aníbal Fornari
- Roberto Prudencio
- Augusto Pescador
- Mariano Morales Dávila
- Rubén Carrasco de la Vega
- René Mayorga
- María Emma Ivanovich
- Víctor Quelca
- Arturo Orías Median
- Marvin Sandi

Ese lote añadió **42 obras/documentos + 10 contribuciones = 52 registros**, llevando el total a **2,908**.

## 13. Meta de cierre

La tarea termina cuando existan fichas consecutivas:

`0001.json → 1504.json`

y el manifiesto indique:

- `authors_seeded: 1504`
- `authors_remaining: 0`

Antes del merge final se debe hacer una auditoría global de identidad, estructura, consecutividad y conteos.
