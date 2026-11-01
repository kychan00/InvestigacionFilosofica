# Política de fuentes y uso de OpenAlex

El sitio debe priorizar el corpus propio [CristianPelayo/openalex-philosophy](https://huggingface.co/datasets/CristianPelayo/openalex-philosophy), hospedado en Hugging Face, **sin consumir llamadas de la API pública de OpenAlex**.

## Búsquedas de obras

- Búsqueda filosófica: archivo Parquet de OpenAlex Philosophy descargado directamente desde Hugging Face y consultado con DuckDB en el navegador.
- Identidad de autores: `data/authors/author-index-v2/aliases/`, un índice estático publicado con GitHub Pages.
- Obras de cada autor: `data/authors/author-index-v2/works/`, otro índice estático publicado con GitHub Pages.
- Ambos índices de autores se generan previamente a partir del corpus de CristianPelayo y de las tablas de autorías de la copia de OpenAlex alojada en Hugging Face (`Mearman/OpenAlex`). No se generan mediante peticiones a `api.openalex.org` en tiempo de consulta.
- Fuentes adicionales: Crossref e Internet Archive cuando sus servicios respondan y se verifique la autoría.
- Las búsquedas directas a la API pública de OpenAlex están desactivadas y no pueden reactivarse mediante las opciones habituales del buscador.

## Cobertura, identidad y límites

El corpus especializado no contiene necesariamente toda la bibliografía de una persona. Por eso «índice consultado por completo» **no** significa «todas las obras de su vida».

En un enlace que contenga solamente el nombre, la resolución de identidad utiliza las particiones de alias del índice estático; cuando haya identidades ambiguas se requiere selección explícita. Si una persona no está indexada, se usan las referencias identificables en Crossref e Internet Archive, marcando el resultado como parcial.

Cuando se elija un autor, se deben recuperar todas las obras disponibles en su partición de índice (dentro del límite de protección de la interfaz), no sólo las primeras 50. Las fechas imprecisas permanecen agrupadas como año o «mes no registrado» en la cronología.

## Norma para cambios posteriores

Ninguna función de perfil ni de búsqueda del sitio puede introducir llamadas a `https://api.openalex.org` sin cambiar deliberadamente esta política y obtener aprobación explícita del propietario. Las pruebas automatizadas deben bloquear y detectar peticiones a ese dominio. Los archivos de Hugging Face y el índice estático local son la procedencia preferente.

## Identidades alternativas y autoría compartida

- El índice de alias se construye sin API de OpenAlex, a partir de Hugging Face. El generador ignora tratamientos profesionales («Dra.», «Dr.», etc.) y registra variantes con nombre y primer apellido. **Una coincidencia textual nunca prueba por sí sola que sean la misma persona.**
- Un ID OpenAlex estable o un ORCID idéntico puede unir varios nombres e IDs. Ante homónimos sin esa evidencia, la interfaz ofrece selección de identidad, sin adjudicar automáticamente las obras.
- Las particiones `works` ya incluyen trabajos en los que el investigador es coautor, y el nuevo generador guarda además la cantidad de colaboradores por obra (`co`). El índice inverso `work-authors` permite recuperar sus nombres e identificadores para las publicaciones visibles.
- El perfil muestra separadamente obras individuales, en colaboración y con autoría insuficiente. Si un índice antiguo carece de información de coautoría, no se inventa que la obra sea individual.
- Para que los alias y la cantidad de colaboradores nuevos sean visibles, **es necesario reconstruir las particiones de formato `author-index-v2` y publicar la **nueva release inmutable `author-index-v3`**** ejecutando `.github/workflows/build-author-index-v1.yml` después del merge, y después desplegar el sitio con el artefacto nuevo. La publicación del JS/CSS por sí sola no actualiza los datos existentes.
- Todas las obras siguen limitadas a la cobertura del corpus filosófico de Hugging Face y sus fuentes federadas; no se garantiza exhaustividad.

### Publicación coordinada del índice actualizado

1. Integrar el PR de código; nunca realizar cambios directos en `main`.
2. Ejecutar manualmente `Build remote author index v2` (`.github/workflows/build-author-index-v1.yml`). Construye los datos desde Hugging Face y publica **`author-index-v3`**, sin sobrescribir la release existente `author-index-v2`.
3. Verificar el manifest, los archivos comprimidos y su checksum; el contenido utiliza por compatibilidad la ruta `author-index-v2/`.
4. Ejecutar el despliegue de GitHub Pages después de la release y confirmar el SHA desplegado. El workflow de despliegue reemplaza las particiones antiguas por las nuevas.
5. Probar las rutas públicas con «Dra Dinora Hernández», «Dinora Hernández» y «Dinora Hernández López», comprobando alias, autorías compartidas, ausencia de peticiones a `api.openalex.org` y no atribución de homónimos.

**Importante:** un merge y un despliegue de la web sin reconstrucción de la release no satisfacen la publicación de los nuevos alias y recuentos.

## Recuperación bibliográfica federada y obras colectivas (noviembre de 2026)

La búsqueda general y los perfiles de autores **no son intercambiables**: la búsqueda general también contiene resultados donde un nombre aparece sólo en el título, en una reseña o como mención temática. Un perfil debe recuperar registros cuya atribución figura en el campo bibliográfico de creadores, sin importar si la persona firma individualmente, escribe en coautoría o coordina un volumen.

- El motor federado consulta nombres normalizados sin títulos académicos y descubre variantes completas desde los campos de autoría, no desde coincidencias temáticas. Puede consultar adicionalmente Crossref, Internet Archive y el catálogo local CUCSH.
- Los creadores separados por comas o punto y coma se representan como participantes individuales cuando la sintaxis es inequívoca. Un campo concatenado con «coordinadores», «colaboradores» o «y varios» se reconoce como evidencia de obra colectiva, pero **no se inventan los nombres de coautores que no puedan separarse**.
- Un campo que sólo contiene un nombre no prueba autoría individual. En esa situación la clasificación queda **no concluyente**; sólo una fuente que reporta explícitamente cero coautores permite afirmar autoría individual.
- El nombre presente exclusivamente en el título o en la descripción no acredita autoría. Los segundos apellidos u ORCID incompatibles impiden una fusión automática de identidades.
- El número de resultados generales no debe mostrarse como si representara la bibliografía de una persona: incluye homónimos, reseñas y menciones ajenas. La cronología del perfil sólo incorpora entradas con evidencia bibliográfica de participación.
- Mantener la política de **cero llamadas a la API pública OpenAlex**. La recuperación amplía consultas únicamente a las fuentes federadas ya disponibles.

La interfaz debe distinguir las obras «en coautoría», las «colectivas/coordinadas» y las de «autoría no concluyente». La cobertura siempre depende de las fuentes; no se promete exhaustividad.


## Capa de autoridad bibliográfica verificada

Los índices automáticos pueden omitir autores o transportar metadatos incorrectos. Cuando una identidad ha sido comprobada mediante ORCID y fuentes institucionales/editoriales, el perfil puede incorporar una bibliografía curada en `src/data/curated-author-bibliography.js`.

Reglas:

- La capa curada se enlaza a una identidad canónica y ORCID; no se activa por semejanza aproximada de nombres.
- Los registros conservan la fuente de evidencia y se muestran como **Bibliografía verificada**, no como OpenAlex ni como coincidencias automáticas.
- DOI, ISBN, año, revista, editorial y rol bibliográfico de una fuente curada tienen prioridad sobre un registro automático duplicado.
- `alternativeTitles` sólo se usa para unir copias conocidas del mismo registro cuando un proveedor ha deformado el título o la fecha; no es un algoritmo general de similitud.
- Las coordinaciones, capítulos, coautorías y autorías individuales se mantienen como roles distintos.
- La capa curada mejora cobertura y precisión, pero no permite afirmar exhaustividad universal.

### Dinora Hernández López

La identidad canónica verificada es **Dinora Hernández López**, ORCID **0000-0001-7335-1790**. Las formas «Dra Dinora Hernández», «Dinora Hernández» y «Dinora Hernandez» se consideran aliases de esa identidad únicamente en enlaces por nombre; un `authorId` explícito sigue siendo autoritativo.

El corpus OpenAlex Philosophy/Hugging Face actualmente desplegado no contiene esta identidad. Su archivo se construye, por tanto, combinando la bibliografía verificada con Crossref, Internet Archive y catálogos institucionales, conservando las protecciones contra homónimos y sin usar `api.openalex.org`.
