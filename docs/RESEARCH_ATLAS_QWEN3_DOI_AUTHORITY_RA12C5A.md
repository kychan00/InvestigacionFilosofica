# RA12-C5-A — Autoridad DOI → OpenAlex → Qwen V4

**Estado:** fase de identidad exacta previa al overlay semántico.

## Por qué existe esta fase

RA12-C4 mostró que el buscador federado ya recupera resultados útiles desde OpenAlex Philosophy, Crossref, CUCSH Filosofía e Internet Archive. Sin embargo, el corpus Qwen V4 congelado conserva 451,823 OpenAlex WorkIDs pero no aporta DOI utilizables dentro de su propio snapshot.

Eso crea una ambigüedad práctica: un resultado de Crossref puede parecer "nuevo" sólo porque llega como DOI, aunque la misma obra ya tenga un vector Qwen dentro de V4 con un identificador `W...`.

RA12-C5-A resuelve **identidad bibliográfica antes de generar embeddings**.

## Flujo

```text
Resultado federado con DOI
        │
        ▼
normalizar DOI
        │
        ▼
OpenAlex API por filtro DOI
        │
        ▼
¿OpenAlex devuelve exactamente ese DOI?
        │
   ┌────┴────┐
   │         │
  no        sí
   │         │
overlay    W-ID canónico
candidato    │
             ▼
       ¿W-ID está en V4?
        ┌────┴────┐
        │         │
       sí        no
        │         │
reutilizar     overlay
vector V4      candidato
```

OpenAlex soporta consultas OR por DOI y permite agrupar hasta 100 valores en un mismo filtro. C5-A usa esa ruta únicamente dentro del pipeline offline de auditoría; el navegador y el buscador público siguen sin usar la API OpenAlex en cliente.

## Estados de autoridad

### `v4-existing-by-doi`

El DOI se resuelve a un único OpenAlex WorkID y ese WorkID ya pertenece a los 451,823 documentos V4.

Resultado: **no se genera embedding nuevo**. El Atlas podrá reutilizar el vector autenticado existente.

### `openalex-outside-v4`

OpenAlex conoce exactamente el DOI, pero su WorkID no pertenece a nuestro V4 filosófico congelado.

Resultado: sigue siendo candidato real para el overlay.

### `openalex-unmatched`

OpenAlex no devuelve ninguna obra con ese DOI.

Resultado: se conserva como obra externa bajo la autoridad de la fuente original. No se inventa una identidad OpenAlex.

### `openalex-ambiguous`

El mismo DOI produce más de un WorkID distinto.

Resultado: se bloquea. No se elige uno por título, año, autor ni similitud.

## Lo que C5-A NO hace

- No modifica los 451,823 vectores V4.
- No añade documentos a `openalex-philosophy`.
- No genera embeddings.
- No publica artefactos nuevos en Hugging Face.
- No activa llamadas OpenAlex desde el navegador.
- No cambia ranking, SearchResponse ni la interfaz.
- No usa título+año como sustituto de identidad.
- No mezcla IDs locales de proveedores.
- No convierte Crossref, CUCSH o Internet Archive en "OpenAlex".

## Evidencia reproducible

El workflow:

`.github/workflows/research-atlas-ra12c5a.yml`

hace lo siguiente:

1. verifica los tests de identidad;
2. descarga y valida por SHA los metadatos/IDs V4 necesarios;
3. reconstruye el índice exacto de WorkIDs V4;
4. ejecuta en Chromium las mismas seis búsquedas federadas de RA12-C4;
5. exige cero errores de proveedor para aceptar la muestra;
6. extrae los DOI únicos;
7. consulta OpenAlex en lotes de máximo 100 DOI;
8. conserva la respuesta OpenAlex cruda y su SHA-256;
9. exige eco exacto del DOI;
10. comprueba si el WorkID resultante pertenece a V4;
11. vuelve a medir cobertura top 5 / 20 / 50;
12. guarda un índice DOI de 256 particiones gzip JSONL.

El índice usa filas:

```text
[doi, state, openalexWorkId, vectorId, cluster, ordinal]
```

Sólo `v4-existing-by-doi` dispone de una localización de vector V4.

## Qué esperamos aprender

C4 marcó 212 identidades externas únicas como posibles candidatas de overlay en su muestra corregida. C5-A contestará una pregunta más precisa:

> ¿Cuántas de esas obras eran realmente nuevas y cuántas ya existían dentro de Qwen V4, pero no podíamos reconocerlas porque nos faltaba DOI ↔ OpenAlex?

No debemos interpretar el número de candidatos de C4 como número de embeddings nuevos hasta terminar esta fase.

## Después: RA12-C5-B

Una vez resueltos todos los DOI que podamos:

1. retirar de la cola overlay las obras recuperadas por DOI;
2. deduplicar el resto por identidad estable;
3. auditar qué texto puede utilizarse para embedding según procedencia;
4. generar Qwen3-Embedding-0.6B con la misma revisión que V4;
5. normalizar L2 y cuantizar con el mismo contrato int8;
6. publicar un overlay semántico separado y versionado;
7. verificar V4 ↔ overlay ↔ overlay antes de activar nuevas aristas.

La regla sigue siendo: **resolver identidad primero; generar representación semántica después**.
