# Arquitectura de Investigación Filosófica

## 1. Propósito

**Investigación Filosófica** es un motor federado de recuperación bibliográfica especializado en filosofía.

El sistema consulta fuentes académicas heterogéneas, normaliza sus resultados a un contrato común, fusiona registros equivalentes y los ordena mediante criterios de relevancia filosófica y bibliográfica.

No pretende sustituir los catálogos, índices ni bases de datos de origen. Su función es ofrecer una capa común de descubrimiento y acceso.

---

## 2. Principios de diseño

La arquitectura mantiene separadas varias responsabilidades que no deben confundirse:

1. **Recuperación**: obtener candidatos desde cada proveedor.
2. **Normalización**: convertir metadatos heterogéneos a un contrato común.
3. **Clasificación disciplinaria**: estimar si un documento pertenece o resulta relevante para filosofía.
4. **Rol documental**: distinguir investigación académica, reseñas, documentos adyacentes, paratextos y otros roles.
5. **Deduplicación**: reconocer el mismo trabajo procedente de múltiples proveedores.
6. **Ranking**: ordenar resultados según la consulta y sus evidencias.
7. **Presentación**: mostrar resultados, fichas, filtros y accesos.
8. **Acceso institucional**: construir enlaces hacia recursos licenciados sin gestionar credenciales institucionales.

La relevancia filosófica y la calidad o función documental son dimensiones distintas. Un documento puede ser filosóficamente pertinente y, al mismo tiempo, tener un rol documental de menor utilidad académica.

---

## 3. Arquitectura general

    Consulta del usuario
            │
            ▼
    Parser e interpretación
            │
            ▼
    Expansión de consulta
    ES / EN / autores / conceptos / obras
            │
            ▼
    ┌─────────────────────────────────────────────┐
    │               Proveedores                   │
    │                                             │
    │  OpenAlex          Crossref                 │
    │  Internet Archive                           │
    │  OpenAlex Philosophy V3.2                  │
    │  CUCSH Filosofía                            │
    └─────────────────────────────────────────────┘
            │
            ▼
    Normalización a contrato común
            │
            ▼
    Deduplicación y fusión
            │
            ▼
    Ranking filosófico y bibliográfico
            │
            ▼
    Filtros / orden / paginación
            │
            ▼
    Tarjetas y ficha bibliográfica
            │
            ├────────► Acceso abierto / DOI
            │
            └────────► Biblioteca Virtual UdeG

---

## 4. Ejecución

La aplicación se ejecuta principalmente en el navegador.

No existe un servidor de aplicación permanente ni una base de datos propia de usuarios o búsquedas.

GitHub Pages sirve los archivos estáticos y el navegador realiza la mayor parte de la federación, normalización, deduplicación y presentación.

---

## 5. Fuentes

### 5.1 OpenAlex

Proveedor académico consultado mediante API para recuperación dinámica de literatura.

### 5.2 Crossref

Proveedor de metadatos DOI y bibliográficos.

El adaptador normaliza, entre otros casos:

- JATS/XML;
- HTML;
- entidades HTML;
- entidades doblemente codificadas.

### 5.3 Internet Archive

Se utiliza para recuperar libros y textos digitalizados.

La búsqueda se restringe a textos y los candidatos reciben un preranking bibliográfico antes de incorporarse al ranking federado.

### 5.4 OpenAlex Philosophy

Corpus controlado especializado en filosofía.

La versión utilizada por producción es **V3.2** y se distribuye como Parquet mediante Hugging Face.

La aplicación fija una revisión inmutable del dataset y consulta el Parquet desde el navegador mediante DuckDB-Wasm.

La clasificación del corpus distingue:

- `CORE`
- `PROBABLE`
- `BORDERLINE`
- `EXCLUDE`

La colección utilizada para búsqueda contiene únicamente los registros admitidos por la política de inclusión de V3.2.

La clasificación no considera la etiqueta OpenAlex `Philosophy` como una condición suficiente. Combina distintas evidencias disciplinarias y documentales.

### 5.5 CUCSH Filosofía

Corpus bibliográfico local construido a partir de publicaciones de filosofía del CUCSH.

Actualmente integra:

- **Protrepsis**
- **Quadripartita Ratio**

La recolección se realiza mediante OAI-PMH fuera del flujo de búsqueda del usuario.

El navegador consulta un snapshot local:

    src/data/cucsh-filosofia.json

Esto evita consultar los sitios de las revistas en cada búsqueda.

El snapshot se actualiza automáticamente mediante:

    .github/workflows/cucsh-harvest.yml

La ejecución programada es mensual:

    17 12 3 * *

Es decir, el día 3 de cada mes a las 12:17 UTC.

Antes de publicar una actualización se valida el corpus y se ejecuta la suite de pruebas.

---

## 6. Contrato normalizado

Cada adaptador convierte los registros de su fuente a una estructura compatible que puede contener, entre otros campos:

    id
    title
    authors
    year
    type
    language
    doi
    isbn
    journal
    publisher
    abstract
    citedBy
    openAccess
    topics
    providers
    sourceRecords
    matchedQueries
    relevanceScore
    relevanceLevel
    urls

Los proveedores conservan trazabilidad mediante `providers` y `sourceRecords`.

---

## 7. Deduplicación

La deduplicación ocurre después de la normalización.

El identificador preferente es el DOI cuando está disponible.

Cuando no existe DOI pueden utilizarse señales bibliográficas adicionales, incluyendo títulos normalizados.

La fusión conserva la procedencia de los proveedores originales en lugar de ocultarla.

Un mismo documento recuperado, por ejemplo, desde CUCSH Filosofía y Crossref debe representarse como un único resultado multi-proveedor.

---

## 8. Ranking

El ranking final es determinista.

Entre las dimensiones utilizadas por la interfaz se encuentran:

- `Q`: coincidencia con la consulta;
- `P`: relevancia filosófica;
- `D`: confianza disciplinaria;
- `S`: consenso entre evidencias;
- `B`: calidad bibliográfica;
- `I`: impacto.

El objetivo no es sustituir una evaluación académica humana, sino ordenar candidatos de manera reproducible y explicable.

La interfaz permite inspeccionar las razones por las que un resultado fue recuperado.

---

## 9. Idioma

La aplicación combina metadatos de idioma con inferencia a partir del texto cuando es necesario.

La detección de idioma también controla algunos accesos institucionales.

Por ejemplo:

- **Aula** se ofrece para registros en español;
- **Britannica UdeG** se ofrece para registros en inglés.

---

## 10. Biblioteca Virtual UdeG

Los recursos institucionales funcionan como **launchers**, no como proveedores de datos almacenados por Investigación Filosófica.

El sistema construye una consulta a partir de los metadatos del documento y abre el recurso institucional correspondiente en otra pestaña.

Actualmente pueden aparecer:

- wdg.búsqueda · UdeG;
- Ebook Central;
- Britannica UdeG;
- Aula.

La aplicación no recibe ni almacena:

- contraseñas institucionales;
- cookies institucionales;
- tokens de sesión;
- credenciales UdeG.

La autenticación ocurre directamente en los servicios institucionales.

---

## 11. Privacidad y estado

Investigación Filosófica no mantiene una base de datos de actividad de los usuarios.

Por diseño:

- no almacena historial de búsquedas;
- no almacena credenciales;
- no almacena cookies institucionales;
- no crea perfiles de usuario;
- el estado de búsqueda es temporal y permanece en memoria del navegador.

---

## 12. Datos pesados y repositorio

El repositorio Git contiene código, configuración y corpora pequeños.

Los artefactos de gran tamaño, como OpenAlex Philosophy V3.2, se mantienen fuera del repositorio y se fijan mediante revisiones inmutables.

Actualmente OpenAlex Philosophy se distribuye desde:

    CristianPelayo/openalex-philosophy

en Hugging Face.

---

## 13. Pruebas

La suite principal se ejecuta mediante:

    npm test

También existe una prueba de red:

    npm run test:network

y una tarea para preparar DuckDB-Wasm:

    npm run build:duckdb

Las pruebas cubren, entre otras áreas:

- normalización Crossref;
- CUCSH Filosofía;
- deduplicación;
- recuperación bilingüe;
- idioma;
- Internet Archive;
- ranking;
- accesos institucionales;
- manejo de límites HTTP de OpenAlex.

---

## 14. Despliegue

La aplicación se publica mediante GitHub Pages.

El flujo de despliegue es:

    main
      │
      ▼
    GitHub Actions
      │
      ├── tests
      ├── build DuckDB browser assets
      ├── prepare site
      └── deploy GitHub Pages

Un cambio no debe considerarse release estable hasta que:

1. pase `npm test`;
2. pase `git diff --check`;
3. el commit esté en `main`;
4. el workflow de GitHub Pages termine correctamente.

---

## 15. Reproducibilidad

`release-manifest.json` registra la fotografía técnica de una versión desplegada.

El manifest vincula:

    commit de aplicación
            │
            ├── OpenAlex Philosophy version
            ├── Hugging Face revision
            ├── SHA-256 del Parquet
            │
            ├── snapshot CUCSH
            ├── SHA-256 del snapshot
            │
            └── estado esperado de pruebas

Esto permite distinguir claramente entre:

- versión del código;
- versión del corpus;
- versión de los datos institucionales locales.

El `runtimeCommit` identifica el commit que efectivamente modificó el comportamiento de la aplicación. El commit que incorpora esta documentación puede ser posterior sin modificar el runtime documentado.

---

## 16. Límites metodológicos

El corpus filosófico es una clasificación heurística, no un conjunto de verdad disciplinaria revisado manualmente en su totalidad.

Por ello:

- puede contener falsos positivos;
- puede omitir literatura relevante;
- las fuentes externas pueden cambiar sus metadatos;
- la cobertura depende de las fuentes disponibles;
- el ranking expresa una política de recuperación, no una evaluación del valor filosófico de una obra.

Estas limitaciones deben medirse progresivamente mediante un benchmark humano independiente.

---

## 17. Próximos pasos arquitectónicos

Las siguientes mejoras previstas son:

1. construir un benchmark humano de precisión y recuperación;
2. añadir pruebas end-to-end de navegador;
3. ampliar CUCSH Filosofía a nuevas revistas;
4. utilizar IA generativa únicamente como capa auxiliar, sin sustituir la trazabilidad, deduplicación y ranking determinista del motor.
