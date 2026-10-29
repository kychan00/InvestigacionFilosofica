---
type: product-architecture
project: InvestigacionFilosofica
status: deployed
updated: 2026-10-29
---

# Multi-Author Relationship Search V1

## Problema

La resolución de identidad de autor era singular. Ante `Kant y Hegel`, el
parser reconocía ambos filósofos, pero la capa remota devolvía la primera
identidad válida y anteponía sus obras. El resultado privilegiaba a Kant en vez
de representar la consulta como una relación entre dos autores.

## Decisión de producto

Una consulta con dos o más nombres se trata como una búsqueda relacional:

```text
consulta multiautor
→ segmentación de nombres
→ resolución independiente de cada identidad
→ perfiles biográficos breves
→ recuperación normal en las fuentes disponibles
→ cobertura determinista de autores por resultado
→ artículos que cubren más autores primero
```

La prioridad usa únicamente presencia explícita de los nombres en título,
abstract o autoría. Dentro de la misma cobertura conserva el orden previo. No
crea un score semántico, no interpreta una mención como relevancia humana y no
modifica `src/core/rank.js`.

## Identidad y biografía

Cada nombre se resuelve por separado contra [[Remote-Author-Identity-V1]]. Si
existe evidencia pública:

- el snapshot propio OpenAlex Philosophy aporta identidad, ORCID y obras;
- Wikidata aporta identidad humana, alias y una descripción breve;
- Wikipedia aporta el enlace a la biografía en español o, como fallback, en
  inglés.

No se usa la API de OpenAlex ni se descarga un corpus o modelo al navegador.
Si una identidad no puede resolverse, el sistema conserva literalmente el
nombre escrito para recuperar y priorizar coincidencias bibliográficas. Ante
homónimos mantiene la selección explícita existente.

## Segmentación admitida

- conjunciones `y`, `e`, `and`, `et`, `und` y `&`;
- listas con tres o más segmentos separados por coma;
- nombres canónicos detectados por el parser;
- sufijos temáticos, por ejemplo `Kant y Hegel sobre la libertad`, sin tratar
  `sobre la libertad` como parte del segundo autor.

Un nombre individual como `Alonso Nava Amezcua` conserva el flujo singular y
continúa anteponiendo obras de autoría directa.

## Verificación pública

La consulta `Kant y Hegel` mostró dos perfiles:

- Immanuel Kant · descripción `filósofo prusiano` · Wikipedia · Wikidata;
- Georg Wilhelm Friedrich Hegel · descripción `filósofo alemán` · Wikipedia ·
  Wikidata.

Los primeros resultados fueron relaciones explícitas, entre ellas:

1. `La aleccionadora contienda entre Kant y Hegel sobre la filosofía práctica`;
2. `Génesis y estructura de la teoría de la apariencia en Kant y Hegel`;
3. `Introducción. Kant y Hegel en el pensamiento de Habermas`.

Los artículos dedicados sólo a Kant quedaron después de los documentos que
cubren ambos nombres.

## Linaje de despliegue

- Implementación: `1926c5e4472dd283d1f152c5f793a93cf8e985b9`.
- PR: `#26`.
- Merge: `4eaecb0e17035378d35dcdd152f84e0b0e3306c4`.
- GitHub Pages: workflow `40935062110`.
- Suite: 102/102 pruebas JavaScript.

## Límites

- La ficha biográfica depende de que Wikidata tenga una entidad humana y un
  sitelink de Wikipedia enlazable.
- Un nombre parcial no presente en Wikidata o en el índice puede quedar sin
  identidad; la búsqueda bibliográfica sigue funcionando con el texto escrito.
- La prioridad por cobertura es una regla de presentación solicitada por el
  producto, no un resultado experimental Qwen ni una evaluación de relevancia.
- No se cambió retrieval semántico, reranker, scores, producción Qwen ni
  artefactos congelados de `benchmark/qwen3`.
