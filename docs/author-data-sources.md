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
