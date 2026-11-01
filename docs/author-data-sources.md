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
