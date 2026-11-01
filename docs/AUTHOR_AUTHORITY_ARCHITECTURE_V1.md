# Arquitectura V1 — Author Authority Graph

## Estado

**Fase 1 — arquitectura solamente.**

Este documento define la arquitectura objetivo para reconstruir perfiles de autor de forma general, reproducible y trazable. No cambia todavía el comportamiento del sitio, no introduce nuevas llamadas de red y no sustituye las reglas actuales de producción.

La implementación posterior deberá mantener la política vigente de **cero llamadas directas a `api.openalex.org`**. El corpus `CristianPelayo/openalex-philosophy` y los índices derivados de snapshots de Hugging Face siguen siendo la fuente primaria de descubrimiento; Crossref, Internet Archive, CUCSH y futuras fuentes compatibles aportan evidencia complementaria.

---

## 1. Problema que esta arquitectura resuelve

El sistema actual ya puede:

- resolver algunos autores por nombre, alias, ORCID o ID de catálogo;
- recuperar obras desde el índice estático;
- complementar con fuentes federadas;
- distinguir parcialmente coautoría, obra colectiva y atribución no concluyente;
- incorporar bibliografías curadas para identidades verificadas.

Sin embargo, todavía existen dos modelos en tensión:

1. un resolvedor general que parte de nombres, IDs y heurísticas;
2. excepciones curadas para autores concretos cuando el corpus automático no alcanza la cobertura deseada.

Eso funciona para corregir casos puntuales, pero no escala a todos los autores. La arquitectura V1 sustituye la idea de «buscar obras de un nombre» por la de **reconstruir una autoridad bibliográfica**.

La pregunta fundamental deja de ser:

> «¿Qué resultados tengo para este nombre?»

y pasa a ser:

> «¿Qué persona representa esta mención, qué contribuciones podemos atribuirle, qué obras intelectuales representan esas contribuciones y qué evidencia sostiene cada afirmación?»

---

## 2. Objetivo

Cuando cualquier autor sea clickeado, el sistema deberá poder construir o recuperar un **expediente bibliográfico de autoridad** con la máxima cobertura justificable por las fuentes disponibles, sin mezclar homónimos y sin presentar como certeza aquello que sólo es probable.

La arquitectura debe permitir, de forma genérica:

- nombres completos, abreviados, transliterados y variantes ortográficas;
- segundos apellidos y apellidos compuestos;
- homónimos;
- ORCID e identificadores externos;
- múltiples afiliaciones y cambios institucionales;
- coautorías y redes de colaboración;
- libros, artículos, capítulos, reseñas, traducciones, prólogos, coordinaciones y otros roles;
- ediciones, reediciones y versiones de una misma obra;
- registros duplicados de múltiples proveedores;
- evidencia positiva, negativa y contradictoria;
- decisiones aceptadas, rechazadas o pendientes;
- medición explícita de cobertura de fuentes;
- reconstrucciones futuras sin perder las decisiones ya tomadas.

---

## 3. Principios no negociables

### 3.1 Persona no es nombre

Un texto como «Dinora Hernández», «D. Hernández López» o «Hernández López, Dinora» es una **mención de autor**, no una persona.

Una persona sólo se convierte en entidad canónica cuando existe evidencia suficiente para sostener la resolución.

### 3.2 Mención no implica autoría

Que un nombre aparezca en un título, descripción, reseña o campo libre no demuestra una relación de autoría.

La atribución debe provenir de metadatos de creador, relaciones explícitas, identificadores o evidencia bibliográfica equivalente.

### 3.3 Registro no es obra

Un registro de Crossref, otro de Internet Archive y otro del corpus OpenAlex pueden describir la misma obra.

Las fuentes se conservan como evidencia; no se presentan como tres obras distintas.

### 3.4 Obra no es edición

Un libro de 2008 y su reedición de 2016 pueden representar la misma obra intelectual con manifestaciones o versiones distintas.

La arquitectura debe preservar ambas dimensiones.

### 3.5 Incertidumbre es un estado válido

El sistema puede concluir:

- confirmada;
- probable;
- ambigua;
- no resuelta;
- rechazada.

No resolver es preferible a fusionar identidades incorrectamente.

### 3.6 Toda afirmación importante debe conservar procedencia

Nombres, ORCID, afiliaciones, fechas, roles, DOI, ISBN y relaciones de coautoría deben poder rastrearse hasta uno o más registros fuente.

### 3.7 La cobertura se mide; no se promete exhaustividad universal

«Todos los registros de las fuentes configuradas fueron agotados» es una afirmación verificable.

«Toda la producción de esta persona en toda su vida» no lo es.

---

## 4. Modelo conceptual

La arquitectura se organiza alrededor de nueve entidades.

### 4.1 AuthorityPerson

Representa una persona bibliográfica canónica dentro de Investigación Filosófica.

Propiedades conceptuales:

- ID interno estable;
- nombre canónico actual;
- nombres alternativos;
- identificadores externos;
- afiliaciones observadas;
- rango temporal de actividad;
- temas o áreas observadas;
- estado de resolución;
- historial de fusiones o separaciones;
- referencias a evidencia.

El ID interno **no debe derivarse del nombre ni depender de OpenAlex**. Debe sobrevivir a cambios de nombre, incorporación posterior de ORCID o sustitución de una fuente.

### 4.2 AuthorMention

Representa una aparición concreta de una cadena de autor dentro de un registro fuente.

Ejemplos:

- «Dinora Hernández López» en Crossref;
- «D. Hernández» en una revista;
- «Hernández López, Dinora» en un catálogo.

Cada mención mantiene:

- texto original;
- forma normalizada;
- posición o rol cuando exista;
- identificadores incluidos en el registro;
- registro fuente que la contiene.

Nunca se fusionan menciones destructivamente: se enlazan a una autoridad cuando la resolución lo justifica.

### 4.3 ExternalIdentifier

Representa identificadores de terceros, por ejemplo:

- ORCID;
- OpenAlex Author ID;
- Wikidata;
- identificadores institucionales;
- identificadores de otros catálogos que se incorporen posteriormente.

Una autoridad puede tener varios. Un identificador contradictorio puede actuar como veto de fusión.

### 4.4 IntellectualWork

Representa la obra intelectual canónica.

Ejemplos:

- un artículo;
- un libro;
- un capítulo;
- una reseña;
- una ponencia publicada;
- un prólogo;
- una traducción como trabajo intelectual cuando corresponda.

No contiene por sí misma la afirmación «X es autor». Esa relación pertenece a Contribution.

### 4.5 WorkVersion

Representa una edición, versión, traducción, reedición o manifestación bibliográfica cuando la distinción sea relevante.

Un artículo con un único registro puede no necesitar separación visible entre Work y WorkVersion. Un libro con varias ediciones sí.

### 4.6 Contribution

Es la relación entre AuthorityPerson y IntellectualWork.

Debe poder expresar roles como:

- autoría;
- coautoría;
- coordinación;
- edición;
- compilación;
- traducción;
- prólogo;
- introducción;
- colaboración;
- otro rol documentado;
- rol no determinado.

Una obra colectiva no debe colapsar todos los participantes bajo «autor».

### 4.7 SourceRecord

Es la representación inmutable de lo que una fuente afirmó.

Debe conservar, cuando esté disponible:

- proveedor;
- ID de origen;
- metadatos originales relevantes;
- URL de origen;
- revisión o fecha de captura;
- DOI, ISBN u otros identificadores;
- creadores tal como fueron publicados.

Los SourceRecord no se corrigen sobrescribiéndolos. Las normalizaciones y decisiones se construyen encima.

### 4.8 EvidenceAssertion

Representa una pieza de evidencia a favor o en contra de una resolución.

Ejemplos positivos:

- ORCID idéntico;
- mismo ID estable;
- afiliación coincidente;
- coautores recurrentes;
- obra ya confirmada;
- nombre completo compatible;
- periodo de actividad compatible.

Ejemplos negativos:

- ORCID diferente;
- identificador institucional incompatible;
- segundo apellido incompatible;
- dos trayectorias bibliográficas claramente separadas;
- conflicto temporal fuerte;
- fuente que atribuye explícitamente la obra a otra persona.

Cada evidencia conserva procedencia y tipo.

### 4.9 ResolutionDecision

Registra una decisión persistente de resolución.

Estados mínimos:

- `confirmed`;
- `probable`;
- `ambiguous`;
- `unresolved`;
- `rejected`.

La decisión guarda:

- objeto resuelto;
- evidencias utilizadas;
- contradicciones;
- versión del algoritmo;
- revisión del dataset;
- fecha de evaluación.

Las decisiones rechazadas son tan importantes como las aceptadas: impiden repetir falsos candidatos en reconstrucciones posteriores.

---

## 5. Grafo de autoridad

El modelo lógico objetivo es:

    SourceRecord
        │
        ├── contiene ──► AuthorMention
        │                  │
        │                  └── resuelve a ──► AuthorityPerson
        │
        └── describe ──► WorkVersion ──► IntellectualWork
                                         ▲
                                         │
                               Contribution
                                         │
                                  AuthorityPerson

Y en paralelo:

    AuthorityPerson
        ├── ExternalIdentifier
        ├── afiliaciones
        ├── variantes de nombre
        ├── temas observados
        ├── coautores
        └── EvidenceAssertion

El grafo evita que el perfil de autor dependa de una sola cadena textual.

---

## 6. Resolución de identidad

La resolución de identidad no debe ser una suma ingenua de puntos. Se divide en capas.

### 6.1 Capa A — identificadores deterministas

Señales de máxima fuerza:

- ORCID idéntico;
- ID de autoridad estable compartido;
- vínculo explícito y verificable entre dos IDs.

Un mismo ORCID válido puede unir variantes de nombre salvo evidencia extraordinaria de corrupción de fuente.

Dos ORCID distintos deben bloquear una fusión automática.

### 6.2 Capa B — evidencia bibliográfica fuerte

Incluye:

- varias obras ya confirmadas en común;
- afiliación exacta o altamente específica;
- combinación consistente de coautores;
- DOI o ISBN ligados a una identidad ya confirmada;
- nombre completo y segundo apellido compatibles;
- autoridad institucional o editorial explícita.

### 6.3 Capa C — evidencia contextual

Incluye:

- disciplina;
- revistas frecuentes;
- editoriales;
- ubicación académica;
- rango temporal;
- temas;
- red de colaboradores.

Sirve para reforzar o separar candidatos, pero no debe resolver por sí sola una homonimia difícil.

### 6.4 Capa D — similitud nominal

Incluye:

- nombre exacto;
- nombre sin diacríticos;
- iniciales;
- orden apellido/nombre;
- nombre + primer apellido;
- transliteraciones.

Es útil para generar candidatos, no para probar identidad.

### 6.5 Vetos

Algunas contradicciones deben impedir la fusión automática aunque existan muchas señales débiles a favor.

Vetos iniciales:

- ORCID incompatibles;
- dos IDs externos explícitamente incompatibles;
- segundo apellido incompatible cuando ambas fuentes lo presentan de forma completa;
- atribución explícita a otra autoridad ya confirmada.

Otros conflictos pueden reducir confianza sin ser veto absoluto.

### 6.6 Prohibición de resolver por popularidad

La cantidad de obras de un candidato puede ordenar candidatos para revisión, pero **no debe demostrar identidad**.

Una regla como «el candidato con cinco veces más obras es el autor correcto» puede servir como heurística de presentación, nunca como fundamento suficiente para una fusión canónica.

---

## 7. Descubrimiento iterativo

Una autoridad no se reconstruye con una única consulta.

La reconstrucción sigue un proceso de expansión controlada.

### 7.1 Semillas

El proceso puede comenzar desde:

- nombre clickeado;
- Author ID conocido;
- ORCID;
- una obra ya confirmada;
- una bibliografía curada existente;
- una autoridad previamente creada.

### 7.2 Frontera de descubrimiento

Cada nueva evidencia puede generar claves adicionales:

- variantes de nombre;
- identificadores;
- coautores;
- DOI;
- ISBN;
- afiliaciones;
- títulos conocidos;
- revistas;
- editoriales.

### 7.3 Iteraciones

En cada iteración se:

1. consultan proveedores permitidos;
2. crean nuevos SourceRecord;
3. extraen AuthorMention;
4. generan candidatos;
5. aplican resolución;
6. crean o actualizan Contribution;
7. resuelven obras y versiones;
8. producen nuevas claves de expansión.

### 7.4 Saturación bibliográfica

La reconstrucción alcanza saturación operativa cuando:

- la frontera de nuevas claves queda vacía, o
- una iteración completa no produce nuevas autoridades, identificadores, obras o contribuciones relevantes, y
- las fuentes configuradas han alcanzado su estado terminal para esa ejecución.

La saturación no significa «bibliografía universal completa». Significa que el algoritmo agotó las rutas disponibles en esa reconstrucción.

Debe existir además un límite defensivo de iteraciones y volumen para evitar ciclos o explosiones de grafo.

---

## 8. Resolución de obras

La deduplicación actual por DOI y título normalizado es una buena base de recuperación, pero el archivo de autoridad necesita separar tres preguntas:

1. ¿estos registros describen el mismo objeto bibliográfico?
2. ¿pertenecen a la misma obra intelectual?
3. ¿son versiones o ediciones distintas?

### 8.1 Evidencias fuertes de identidad bibliográfica

- DOI idéntico;
- ID estable de fuente;
- combinación ISBN + edición;
- coincidencia exacta de metadatos estructurados;
- relación explícita entre versiones.

### 8.2 Evidencias de agrupación intelectual

- título canónico;
- autores o contribuciones compatibles;
- editorial o revista;
- año;
- volumen/número/páginas;
- relación traducción/edición/reedición.

### 8.3 Reglas conservadoras

- ISBN distintos no deben fusionarse automáticamente como la misma edición;
- años distintos pueden ser reediciones, no duplicados;
- título similar por sí solo sólo genera un candidato;
- un DOI tiene prioridad fuerte para el objeto que identifica, pero no debe borrar la posibilidad de versiones relacionadas;
- las fuentes originales se conservan aunque sus registros se fusionen en una entidad superior.

---

## 9. Coverage Ledger

La arquitectura no utilizará un porcentaje global de «bibliografía completa», porque el denominador real es desconocido.

En su lugar cada reconstrucción tendrá un **Coverage Ledger**.

Por proveedor o índice se registra:

- fuente;
- consulta o partición utilizada;
- versión/revisión;
- paginación recorrida;
- número de candidatos;
- número de registros aceptados;
- número de rechazados;
- errores;
- estado terminal.

Estados mínimos:

- `exhausted`: se agotó lo que esa fuente ofrece para la consulta;
- `partial`: hubo límites, corte defensivo o resultados no recorridos;
- `unavailable`: la fuente falló;
- `not-applicable`: no era pertinente;
- `not-queried`: la política o la ejecución no la consultó.

El perfil futuro podrá comunicar algo como:

> 5 de 6 fuentes configuradas agotadas · 42 contribuciones confirmadas · 3 candidatas pendientes.

Sin afirmar que 42 sea el total absoluto de la vida del autor.

---

## 10. Arquitectura de ejecución

Investigación Filosófica es una aplicación estática publicada en GitHub Pages. Por ello la reconstrucción se divide en dos planos.

### 10.1 Plano de construcción — Authority Build Pipeline

Se ejecuta fuera de la interacción del usuario, mediante scripts y GitHub Actions.

Responsabilidades:

- leer snapshots y datasets;
- construir menciones;
- resolver identidades de alta confianza;
- construir el grafo de contribuciones;
- producir índices compactos;
- conservar decisiones previas;
- publicar una release inmutable;
- generar manifest y checksums;
- ejecutar benchmarks de autoridad.

Este plano debe realizar el trabajo pesado.

### 10.2 Plano de navegación — Author Enrichment

Se ejecuta en el navegador.

Responsabilidades:

- cargar inmediatamente la autoridad preconstruida;
- mostrar expediente y cobertura conocida;
- usar fuentes federadas permitidas para enriquecimiento limitado;
- añadir candidatos sin degradar decisiones de mayor autoridad;
- no reconstruir la identidad completa desde cero en cada clic;
- no contactar `api.openalex.org`.

El clic sobre un autor debe ser una operación de **lectura + enriquecimiento**, no una investigación completa desde cero.

---

## 11. Registro estable y versionado

### 11.1 Authority ID

Cada persona promovida a autoridad recibe un ID interno inmutable.

El ID no cambia si:

- se añade ORCID después;
- cambia el nombre canónico;
- aparece un nuevo ID OpenAlex;
- se corrige una afiliación;
- se agregan obras.

### 11.2 Fusiones

Si dos autoridades se demuestran equivalentes:

- una sobrevive como ID canónico;
- la otra queda como redirect;
- se preserva la historia de la fusión;
- ninguna URL antigua debe quedar huérfana.

### 11.3 Separaciones

Si una autoridad mezcló dos personas:

- se crean o reactivan autoridades separadas;
- las contribuciones se redistribuyen con evidencia;
- queda registrada la decisión de split;
- el ID antiguo conserva historial y redirección contextual cuando sea posible.

### 11.4 Reconstrucciones

Cada release del Authority Graph debe registrar:

- versión de algoritmo;
- versión del corpus;
- revisión de índices;
- fecha;
- checksum;
- métricas de benchmark.

---

## 12. Migración desde la arquitectura actual

La Fase 1 no elimina módulos. Define cómo se reinterpretarán en fases posteriores.

### `remote-author-resolution.js`

Pasa de ser un resolvedor casi canónico a ser un **proveedor de candidatos y registros del índice estático**.

El índice OpenAlex/Hugging Face aporta evidencia; no define por sí solo la identidad interna.

### `author-identity-lookup.js`

Evoluciona hacia la puerta de entrada al Authority Resolver.

Los estados `resolved`, `ambiguous` y `none` se conservarán conceptualmente, pero la decisión deberá estar respaldada por EvidenceAssertion.

### `author-federated-matching.js`

Su lógica de extracción de creadores y prevención de falsos positivos se reutiliza como base de:

- extracción de AuthorMention;
- detección de roles;
- evidencia federada.

### `author-deep-discovery.js`

Deja de orquestar principalmente por nombre y pasa a orquestar por **Authority ID**, utilizando las variantes y claves ya resueltas en el grafo.

### `author-collaborations.js`

Se convierte naturalmente en una vista derivada de Contribution.

La red de colaboradores no debe inferirse de una lista plana de autores cuando el rol o la identidad no están resueltos.

### `author-curated-identities.js` y `curated-author-bibliography.js`

Las capas curadas dejan de ser excepciones de ejecución.

Su contenido se transforma en:

- EvidenceAssertion de alta autoridad;
- semillas del Authority Build Pipeline;
- fixtures y casos de benchmark.

**Dinora Hernández López debe convertirse en un caso de validación del sistema general, no en una rama lógica especial.**

### `author-index-v3`

Deja de conceptualizarse como «la verdad del autor».

Se convierte en uno de los grandes insumos del Authority Build Pipeline.

---

## 13. Política de fuentes

La arquitectura mantiene la política actual:

### Fuente primaria

- `CristianPelayo/openalex-philosophy`;
- snapshots de autorías necesarios para construir los índices derivados.

### Complementarias actuales

- Crossref;
- Internet Archive;
- CUCSH Filosofía;
- Wikidata sólo como señal de identidad cuando corresponda.

### Fuentes futuras posibles

La arquitectura debe permitir añadir proveedores sin cambiar el modelo:

- ORCID público;
- DataCite;
- repositorios institucionales;
- catálogos bibliotecarios;
- índices regionales o disciplinares compatibles;
- autoridades nacionales o internacionales.

Añadir una fuente significa crear nuevos SourceRecord y EvidenceAssertion, no escribir un algoritmo especial para un autor.

---

## 14. Priorización de errores

Para resolución de personas:

**un falso merge es más grave que una omisión temporal.**

Mezclar dos investigadores contamina:

- bibliografía;
- cronología;
- coautorías;
- temas;
- estadísticas;
- navegación del grafo.

Por ello el resolvedor automático debe optimizar primero precisión.

Los casos dudosos permanecen ambiguos y pueden seguir descubriéndose en reconstrucciones posteriores.

Para recuperación de obras, el objetivo posterior será aumentar recall sin sacrificar la identidad resuelta.

---

## 15. Benchmark de autoridades

La implementación no se considerará general por funcionar con Dinora, Ángeles o cualquier otro autor individual.

Debe existir un benchmark separado del ranking bibliográfico.

### Conjunto mínimo de casos

Debe incluir:

- autores con ORCID;
- autores sin ORCID;
- homónimos;
- nombres con diacríticos;
- nombres hispanos con dos apellidos;
- iniciales;
- cambios de firma;
- transliteraciones;
- autores con muchas coautorías;
- autores con producción individual;
- coordinadores y editores;
- capítulos de libro;
- reediciones;
- registros contradictorios;
- autores ausentes del corpus principal.

### Métricas

Como mínimo:

- precisión de fusión de menciones;
- recall de menciones correctamente agrupadas;
- tasa de falsos merges;
- tasa de falsos splits;
- precisión de atribución de contribuciones;
- precisión de deduplicación de obras;
- cobertura por proveedor;
- cantidad de casos que permanecen ambiguos.

La tasa de falsos merges debe ser una métrica de primer orden, no quedar escondida dentro de una media global.

---

## 16. Invariantes

Toda implementación posterior debe respetar estas reglas.

1. Un nombre por sí solo nunca prueba identidad.
2. Un resultado de búsqueda general nunca prueba autoría.
3. Un ORCID incompatible impide la fusión automática.
4. Una autoridad interna no depende de un proveedor concreto.
5. Toda contribución debe poder rastrearse a evidencia.
6. Toda decisión de rechazo debe poder persistirse.
7. Las fusiones no destruyen SourceRecord.
8. Una edición no se convierte automáticamente en una obra distinta ni idéntica sin resolver la relación.
9. Un perfil nunca debe declarar exhaustividad universal.
10. El navegador no debe contactar `api.openalex.org`.
11. Una bibliografía curada no debe activarse sólo por similitud aproximada de nombre.
12. La cantidad de obras no demuestra identidad.
13. Ningún autor específico debe requerir lógica especial para que su perfil funcione.
14. El mismo algoritmo debe procesar autores conocidos y nuevos.
15. Toda release del grafo debe ser reproducible y versionada.

---

## 17. Salida conceptual de un perfil

La futura página de autor será una vista del Authority Graph, no una búsqueda filtrada.

Podrá organizar:

- identidad canónica;
- variantes de nombre;
- identificadores;
- afiliaciones;
- periodo de actividad;
- producción por tipo;
- contribuciones por rol;
- cronología;
- obras y versiones;
- colaboraciones;
- temas;
- revistas y editoriales;
- idiomas;
- disponibilidad documental;
- fuentes;
- nivel de atribución;
- candidatos pendientes;
- Coverage Ledger;
- fecha y versión de reconstrucción.

---

## 18. Qué NO forma parte de la Fase 1

Esta fase no debe:

- cambiar la UI;
- cambiar resultados de Dinora;
- agregar nuevos proveedores en producción;
- alterar el índice desplegado;
- crear nuevos pesos o thresholds de runtime;
- migrar todavía las bibliografías curadas;
- modificar el algoritmo de deduplicación;
- publicar un nuevo dataset;
- tocar el despliegue de Pages.

Su resultado es el **contrato arquitectónico** que las fases siguientes deberán implementar y probar.

---

## 19. Fases posteriores propuestas

### Fase 2 — contratos de datos y fixtures

Definir esquemas serializables para:

- AuthorityPerson;
- AuthorMention;
- Contribution;
- SourceRecord;
- EvidenceAssertion;
- ResolutionDecision;
- CoverageLedger.

Crear fixtures genéricos y migrar los casos curados a datos de prueba/semilla.

### Fase 3 — Identity Resolution Engine

Implementar candidate blocking, vetos, evidencia positiva/negativa y persistencia de decisiones.

### Fase 4 — Work Resolution Engine

Separar registro, versión y obra intelectual.

### Fase 5 — Iterative Discovery Engine

Expandir por identificadores, coautores, obras, afiliaciones y alias hasta saturación operativa.

### Fase 6 — Authority Build Pipeline

Construir y publicar el grafo estático versionado.

### Fase 7 — Author Profile V2

Hacer que la interfaz consuma Authority ID y muestre el expediente completo.

### Fase 8 — benchmark masivo

Evaluar cientos de autores y bloquear releases con regresiones de identidad o atribución.

---

## 20. Criterio de éxito de la arquitectura

La arquitectura se considerará correctamente implementada cuando la siguiente frase sea verdadera:

> Cualquier nombre clickeable entra al mismo pipeline de autoridad; el sistema puede resolverlo, mantenerlo ambiguo o rechazar atribuciones con evidencia, reconstruir sus contribuciones desde todas las fuentes configuradas y explicar de dónde salió cada afirmación, sin depender de una excepción escrita para esa persona.

Ese es el significado operativo de aspirar a mostrar «todo» sobre un autor dentro de Investigación Filosófica.
