# Tesis Humanidades UdeG — Arquitectura V1

## Estado

**T0 — Architecture Freeze.**

Este documento define la arquitectura objetivo de la futura sección **Tesis** de Investigación Filosófica. Esta fase es exclusivamente normativa y arquitectónica: no cambia el runtime, la interfaz, los proveedores de producción ni el despliegue.

La sección se concibe como un **atlas y sistema de descubrimiento de trabajos recepcionales humanísticos de la Universidad de Guadalajara**, conectado con el sistema de autoridades bibliográficas ya existente.

---

## 1. Propósito

La sección Tesis deberá permitir:

1. buscar trabajos recepcionales de Humanidades de la Universidad de Guadalajara;
2. recorrerlos mediante filtros bibliográficos e institucionales;
3. explorar relaciones semánticas entre trabajos;
4. visualizar un atlas bidimensional del espacio humanístico;
5. consultar fichas canónicas con procedencia verificable;
6. navegar entre tesis, personas, programas y unidades académicas;
7. analizar una propuesta de investigación contra antecedentes reales del corpus;
8. identificar personas con antecedentes documentados de dirección en áreas temáticamente próximas;
9. conservar reproducibilidad de corpus, índices, embeddings, clústeres y decisiones.

No pretende sustituir a RIUdeG, UDGVirtual ni a los sistemas académicos de la Universidad. Actúa como capa de descubrimiento, normalización, relación y visualización.

---

## 2. Alcance disciplinario

### 2.1 Regla central

El corpus no se define por similitud temática.

Una tesis entra porque el **programa académico que otorgó el grado está admitido como humanístico mediante evidencia institucional**, no porque su título o resumen “parezca de Humanidades”.

Por tanto:

- una tesis de Filosofía sobre inteligencia artificial puede entrar;
- una tesis de Derecho sobre Kant no entra automáticamente;
- una tesis de Administración con contenido histórico no entra automáticamente;
- una tesis de Historia económica sí puede entrar;
- una tesis de un programa desconocido queda en revisión, no se clasifica por palabras clave.

### 2.2 Alcance por nivel

El corpus no se limita a licenciaturas.

Debe poder incluir, cuando exista producción recepcional y evidencia institucional suficiente:

- licenciatura;
- especialidad;
- maestría;
- doctorado;
- programas interinstitucionales;
- programas históricos ya cerrados;
- planes anteriores o renombrados;
- modalidades presenciales, semiescolarizadas, abiertas, a distancia o mixtas;
- otras figuras de grado humanístico que aparezcan documentadas en las fuentes institucionales.

El nivel académico es una dimensión descriptiva. No determina por sí solo la pertenencia a Humanidades.

### 2.3 Semilla institucional inicial

La **División de Estudios Históricos y Humanos del CUCSH** es la primera semilla institucional del registro de programas por su adscripción explícita a Historia, Geografía, Filosofía, Letras y Lenguas Modernas.

A fecha de esta arquitectura, las páginas institucionales publican entre sus programas asociados:

- Licenciatura en Antropología;
- Licenciatura en Didáctica del Francés como Lengua Extranjera;
- Licenciatura en Docencia del Inglés Modalidad Semiescolarizada Abierta y a Distancia;
- Licenciatura en Docencia del Inglés como Lengua Extranjera;
- Licenciatura en Filosofía;
- Licenciatura en Geografía;
- Licenciatura en Historia;
- Licenciatura en Letras Hispánicas;
- Doctorado en Historia;
- Maestría en Desarrollo Local y Territorio;
- Maestría en Enseñanza del Inglés como Lengua Extranjera;
- Maestría en Estudios Críticos del Lenguaje;
- Maestría en Estudios de las Lenguas y Culturas Inglesas;
- Maestría en Estudios de Literatura Mexicana;
- Maestría en Estudios Filosóficos;
- Maestría en Historia de México;
- Maestría Interinstitucional en Deutsch als Fremdsprache: Estudios Interculturales de Lengua, Literatura y Cultura Alemanas.

Esta lista es una **semilla de autoridad**, no una lista eterna ni exhaustiva.

### 2.4 Red UdeG e historia institucional

La frontera final será **Humanidades UdeG**, no “programas visibles hoy en una sola página del CUCSH”.

El registro de programas debe poder incorporar:

- equivalencias históricas;
- programas renombrados;
- programas extintos;
- programas humanísticos de otras dependencias de la Red UdeG;
- cambios de centro, división o departamento;
- programas interinstitucionales;
- cambios de modalidad;
- fusiones o escisiones administrativas.

Ninguna ampliación se hará por inferencia semántica. Toda inclusión debe aportar evidencia institucional rastreable.

---

## 3. Unidad documental

La unidad principal es un **trabajo recepcional canónico**, no un PDF ni una fila de proveedor.

Un trabajo puede tener:

- un registro en RIUdeG;
- un registro en UDGVirtual;
- un Handle;
- uno o varios archivos;
- revisiones de metadatos;
- variantes de título;
- autores o directores expresados de maneras diferentes.

La entidad canónica debe sobrevivir a cambios en cualquiera de esos registros externos.

---

## 4. Arquitectura general

    RIUdeG / DSpace / OAI-PMH        UDGVirtual / DSpace
                 │                         │
                 └──────────┬──────────────┘
                            ▼
                    SourceRecord Layer
               registros fuente inmutables
                            │
                            ▼
                     Normalización
        nombres · fechas · roles · programas · unidades
                            │
                            ▼
                 Academic Program Authority
                            │
                            ▼
                 Humanities Admission Gate
           INCLUDE · REVIEW · QUARANTINE · EXCLUDE
                            │
                            ▼
                 Canonical Thesis Corpus
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
    Authority Graph   Retrieval Index     Atlas Artifacts
 personas/roles      léxico/semántico     vecinos/clústeres/2D
          │                 │                  │
          └─────────────────┼──────────────────┘
                            ▼
                         Tesis
             Buscar · Atlas · Laboratorio
                            │
                            ▼
                    Ficha bibliográfica

---

## 5. Separación de planos

La arquitectura debe mantener cuatro planos distintos.

### 5.1 Plano de fuente

Conserva lo que cada repositorio afirmó.

No corrige silenciosamente.

### 5.2 Plano canónico

Resuelve identidades de trabajo, personas, programas, unidades, roles y fechas.

### 5.3 Plano semántico

Produce embeddings, vecinos, clústeres, etiquetas y proyecciones.

Todo elemento de este plano es reconstruible y versionado.

### 5.4 Plano de presentación

Muestra búsqueda, atlas, fichas, explicaciones y Laboratorio.

La UI no es fuente de verdad.

---

## 6. Integración con Author Authority Graph

Tesis no tendrá un sistema paralelo de personas.

Las menciones de estudiante, director, codirector u otros participantes deben pasar por los contratos del Author Authority Graph:

    SourceRecord
        │
        ▼
    AuthorMention
        │
        ▼
    EvidenceAssertion
        │
        ▼
    ResolutionDecision
        │
        ▼
    AuthorityPerson

Una misma persona podrá aparecer posteriormente en:

- producción bibliográfica;
- autoría de tesis;
- dirección de tesis;
- coautorías;
- perfiles de autor.

### 6.1 Roles

El contrato de contribuciones deberá ampliarse de forma explícita antes de integrar runtime para representar, como mínimo:

- thesis-author;
- thesis-director;
- thesis-codirector;
- thesis-advisor cuando la fuente utilice una figura distinta;
- committee-member, sólo si una fuente institucional lo documenta de forma inequívoca.

Director no equivale a autor.

Una fuente que mezcle ambos nombres en el mismo campo no autoriza a Investigación Filosófica a conservar esa confusión.

---

## 7. Academic Program Authority

Se introduce conceptualmente una autoridad institucional de programas.

Su función es responder:

> ¿qué programa otorgó el grado y cuál es su identidad institucional a través del tiempo?

Debe soportar:

- ID interno estable;
- nombre canónico;
- aliases;
- nivel;
- disciplina o familia humanística;
- unidad académica;
- vigencia observada;
- modalidades;
- predecesores y sucesores;
- evidencia institucional;
- estado de admisión al corpus;
- historial de decisiones.

El nombre textual de un programa nunca será el ID primario.

---

## 8. Humanities Admission Gate

Todo trabajo debe pasar por una decisión de admisión antes de entrar al corpus semántico.

Estados:

- **INCLUDE**: programa humanístico confirmado;
- **REVIEW**: evidencia suficiente para revisión, pero no para inclusión automática;
- **QUARANTINE**: programa o institución sin resolver;
- **EXCLUDE**: programa confirmado fuera del alcance;
- **REJECT_SOURCE**: el registro no representa una tesis/trabajo recepcional UdeG elegible.

### 8.1 Evidencia de admisión

Orden de preferencia:

1. catálogo institucional oficial del programa;
2. dictámenes, normatividad o documentación oficial UdeG;
3. adscripción explícita de división/departamento;
4. metadatos institucionales consistentes del repositorio;
5. equivalencia histórica curada y documentada.

No se admiten como criterio suficiente:

- palabras del título;
- palabras clave;
- resumen;
- similitud con tesis ya incluidas;
- modelo de lenguaje;
- embedding;
- clasificación temática automática.

---

## 9. Fuentes

### 9.1 RIUdeG

Es la fuente institucional primaria.

La Universidad documenta DSpace como plataforma y OAI-PMH como estándar de interoperabilidad. La cosecha debe realizarse fuera del flujo de búsqueda del usuario y producir snapshots versionados.

### 9.2 UDGVirtual

Es fuente complementaria.

Su colección pública de tesis contiene trabajos de distintas universidades, no sólo de la Universidad de Guadalajara. Por tanto, pertenecer a la colección UDGVirtual **no es evidencia suficiente de pertenencia al corpus**.

Cada registro debe resolver:

- institución otorgante;
- programa;
- nivel;
- rol de las personas;
- relación con UdeG.

### 9.3 Futuras fuentes

Una nueva fuente podrá incorporarse si:

- aporta registros institucionales o metadatos útiles;
- su contrato de procedencia es explícito;
- no obliga a borrar o reemplazar SourceRecord previos;
- pasa los benchmarks de cobertura y calidad;
- su incorporación queda versionada.

---

## 10. Cosecha

No se consulta el repositorio institucional en cada búsqueda del usuario.

El patrón objetivo es:

    fuente institucional
            │
            ▼
      harvest offline
            │
            ▼
       raw snapshot
            │
            ▼
       validación
            │
            ▼
    corpus normalizado
            │
            ▼
     artefactos publicados

La actualización debe ser incremental cuando la fuente lo permita y conservar ventanas solapadas para evitar pérdidas por marcas temporales o correcciones tardías.

Los resumption tokens, borrados, revisiones y fallos parciales deben quedar registrados.

Si una fuente falla, no se reemplaza un snapshot válido por uno vacío o truncado.

---

## 11. Deduplicación de tesis

La deduplicación será conservadora.

Se separan:

- generación de candidatos;
- evidencia;
- decisión.

### 11.1 Evidencia fuerte

Puede incluir:

- Handle idéntico;
- identificador institucional idéntico;
- relación explícita entre registros;
- título + autor confirmado + fecha/programa compatibles;
- archivo o checksum compartido cuando sea legítimo utilizarlo como evidencia.

### 11.2 Vetos

Pueden bloquear la fusión automática:

- autores confirmados incompatibles;
- instituciones otorgantes incompatibles;
- programas incompatibles cuando la fuente es explícita;
- grados incompatibles sin evidencia de doble depósito;
- Handles distintos acompañados de evidencia contradictoria fuerte.

Un false merge es peor que conservar temporalmente dos trabajos sin fusionar.

---

## 12. Representaciones semánticas

Se separan dos propósitos.

### 12.1 Topology embedding

Construye vecindarios y el atlas.

Contrato inicial:

    título normalizado

La disciplina, programa, centro, nivel y director no se incorporan al texto que decide la posición.

Esto permite observar interdisciplinariedad en vez de imponerla administrativamente.

### 12.2 Retrieval embedding

Sirve para búsqueda y Laboratorio.

Contrato candidato:

    título + resumen + palabras clave

con políticas de fallback cuando un componente no exista.

El modelo, dimensionalidad y forma exacta no se fijan en T0. Deben ganar un benchmark congelado.

---

## 13. Búsqueda

La sección Tesis combinará tres rutas conceptuales:

1. **Known-item retrieval**: Handle, título, persona, programa, identificadores;
2. **lexical retrieval**: título, resumen, palabras clave y metadatos;
3. **semantic retrieval**: similitud conceptual.

Los filtros institucionales son restricciones deterministas, no señales de similitud.

El ranking híbrido debe favorecer métodos que no mezclen escalas incompatibles sin calibración. Reciprocal Rank Fusion es candidato preferente para la primera evaluación, no decisión definitiva de T0.

---

## 14. Atlas

El atlas representa parentesco semántico entre trabajos admitidos.

Debe permitir una jerarquía reconstruible como:

    campo
      └── tema
            └── subtema
                  └── tesis

La jerarquía no tiene que coincidir con departamentos universitarios.

### 14.1 Overlays

La topología permanece constante y puede colorearse por:

- disciplina/programa;
- unidad académica;
- nivel;
- periodo;
- modalidad;
- densidad;
- acceso abierto;
- otros metadatos verificables.

El usuario debe poder distinguir claramente entre:

- posición semántica;
- etiqueta curada;
- atributo institucional.

---

## 15. Etiquetado de clústeres

Las etiquetas pueden proponerse algorítmicamente mediante c-TF-IDF u otra técnica reproducible.

Una propuesta automática no se convierte silenciosamente en nombre oficial.

Cada etiqueta publicada debe registrar:

- versión;
- método;
- términos de evidencia;
- revisión humana cuando exista;
- reemplazos históricos.

---

## 16. Laboratorio

El Laboratorio recibe una propuesta de investigación y la compara con el corpus.

Su núcleo V1 debe ser determinista:

    propuesta
       │
       ▼
    embedding
       │
       ▼
    vecinos reales
       │
       ├── posición aproximada
       ├── distribución temática
       ├── densidad
       ├── cronología
       ├── antecedentes cercanos
       └── directores con antecedentes documentados

### 16.1 Lenguaje permitido

Puede informar:

- cercanía;
- densidad;
- distribución;
- cobertura;
- concentración;
- novedad relativa dentro del corpus;
- actividad temporal observada.

No debe afirmar:

- “originalidad universal”;
- calidad académica de una propuesta;
- aceptación probable;
- que una persona aceptará dirigir el trabajo;
- que un tema está agotado;
- que no existe literatura fuera del corpus.

### 16.2 Directores

El sistema muestra:

> personas con antecedentes documentados de dirección en tesis temáticamente próximas

No:

> mejores directores

ni:

> directores disponibles.

El repositorio no contiene disponibilidad, carga académica ni intención de aceptar estudiantes.

---

## 17. IA generativa

No es requisito para buscar, filtrar, crear vecinos, construir el atlas ni calcular métricas del Laboratorio.

Si se incorpora:

- recibe sólo datos recuperados y estructurados;
- no inventa referencias;
- no decide inclusión disciplinaria;
- no decide identidad;
- no decide deduplicación;
- no decide clústeres;
- no sustituye métricas deterministas;
- su salida se valida contra esquema;
- existe fallback completo sin IA.

---

## 18. Privacidad

Las propuestas introducidas en el Laboratorio pueden contener ideas no publicadas.

Por defecto:

- no se guarda historial;
- no se crean perfiles de investigación;
- no se persiste el planteamiento;
- no se usa la consulta para entrenamiento;
- no se publica;
- no se comparte con otros usuarios.

Cualquier función futura de guardado debe ser explícita y opt-in.

---

## 19. Datos y publicación

Git debe contener:

- código;
- contratos;
- manifiestos;
- fixtures pequeños;
- benchmarks;
- reglas de curaduría.

Los artefactos grandes deben publicarse fuera de la historia ordinaria de Git:

- snapshots completos;
- Parquet;
- embeddings;
- vecinos;
- índices;
- coordenadas;
- clústeres;
- páginas de metadatos.

Cada release debe fijar hashes y revisiones inmutables.

---

## 20. Release manifest

La release de Tesis debe registrar al menos:

- schemaVersion;
- app commit;
- source revisions;
- harvest timestamps;
- raw snapshot hashes;
- normalized corpus hash;
- número de SourceRecord;
- número de tesis canónicas;
- número INCLUDE / REVIEW / QUARANTINE / EXCLUDE;
- versión del registro de programas;
- versión del normalizador;
- versión del deduplicador;
- modelo y revisión de embeddings;
- contrato de texto embebido;
- dimensión;
- versión del índice;
- versión del algoritmo de vecinos;
- versión del clustering;
- versión de etiquetas;
- versión de proyección 2D;
- benchmark revision;
- resultado de gates.

---

## 21. Fases

### T0 — Architecture Freeze

Arquitectura, contratos, fuentes, benchmark y límites.

### T1 — Source reconnaissance

Confirmar endpoints, sets, schemas, granularidad, borrados, resumption tokens y muestras reales.

### T2 — Canonical thesis corpus

Cosecha, normalización, programa, admisión, roles, fechas y deduplicación.

### T3 — Authority integration

Personas y contribuciones conectadas con Author Authority Graph.

### T4 — Semantic benchmark

Comparar modelos, representaciones, dimensionalidad, tamaño, latencia y calidad.

### T5 — Atlas pipeline

Vecinos, clustering, jerarquía, etiquetas, 2D y auditoría.

### T6 — Search V1

Búsqueda, filtros, ficha y tesis relacionadas.

### T7 — Atlas UI

Mapa navegable, overlays, móvil, accesibilidad y temas.

### T8 — Deterministic Lab

Ubicación, vecinos, densidad, cronología y antecedentes de dirección.

### T9 — Grounded AI optional layer

Explicaciones opcionales y estrictamente aterrizadas.

---

## 22. No objetivos de T0

Esta fase no:

- cosecha el corpus completo;
- elige modelo de embeddings;
- fija algoritmo de clustering;
- modifica producción;
- añade pestaña Tesis;
- crea endpoints;
- publica datasets;
- migra datos existentes;
- activa IA;
- afirma cobertura exhaustiva.

---

## 23. Criterio de cierre

T0 queda cerrado cuando las fases posteriores pueden implementarse sin volver a decidir:

- qué significa “Humanidades UdeG”;
- cómo entra un programa;
- cómo se conserva procedencia;
- qué es una tesis canónica;
- cómo se relacionan personas y roles;
- qué diferencia fuente, entidad canónica y artefacto semántico;
- qué puede afirmar el Laboratorio;
- qué métricas deben bloquear una release.

---

## 24. Referencias institucionales iniciales

Consultadas para esta arquitectura el 1 de noviembre de 2026:

- División de Estudios Históricos y Humanos, CUCSH: https://www.cucsh.udg.mx/node/6942
- Estructura de la División de Estudios Históricos y Humanos: https://www.cucsh.udg.mx/index.php/division_departamentos/Divisi%C3%B3n%20de%20Estudios%20Hist%C3%B3ricos%20y%20Humanos/estructuradiv
- Lineamientos de interoperabilidad de RIUdeG: https://www.riudg.udg.mx/info/politicas.jsp
- Colección Tesis de UDGVirtual: https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6
