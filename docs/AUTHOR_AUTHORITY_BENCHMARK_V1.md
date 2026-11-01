# Author Authority Benchmark V1

## Estado

**Fase 3.4 — benchmark masivo de identidad previo a Author Profile V2.**

Esta fase no cambia la interfaz ni publica todavía los Authority Graph shards.

Su función es responder una pregunta anterior:

> ¿podemos escalar la resolución de identidad sin empezar a fusionar personas distintas?

El benchmark trabaja sobre la release real `author-index-v3`, no sobre una muestra sintética aislada.

---

## 1. Principio de evaluación

La evaluación es deliberadamente asimétrica.

Un falso merge es más peligroso que una omisión temporal.

Por tanto:

- un falso merge bloquea;
- un false split determinista por ORCID bloquea;
- un perfil perdido del candidate map bloquea;
- una discrepancia de cobertura con el manifest bloquea;
- las omisiones no deterministas se documentan para revisión y no justifican una fusión.

---

## 2. Tres capas

### 2.1 Gold

Gold significa evidencia humana explícita ya verificada.

V1 contiene únicamente casos que ya tienen autoridad curada documentada dentro del repositorio.

Actualmente:

- Dinora Hernández López;
- ORCID 0000-0001-7335-1790;
- variantes con y sin diacríticos;
- variantes con tratamiento académico.

Este conjunto es pequeño a propósito.

No se agregan nombres famosos o IDs externos sólo porque “parezcan obvios”.

### 2.2 Silver

Silver evalúa invariantes deterministas sobre todo el índice.

Para cada perfil OpenAlex:

`expectedIdentityKey = ORCID si existe; de lo contrario OpenAlex Author ID`.

Esto no pretende afirmar que dos OpenAlex IDs sin ORCID sean necesariamente personas distintas en la realidad.

Afirma algo más conservador:

> V1 no tiene evidencia suficiente para fusionarlos automáticamente.

De aquí salen dos fallos críticos:

#### False merge

Un candidate group contiene más de una `expectedIdentityKey`.

Ejemplo:

- OpenAlex A1 + ORCID X;
- OpenAlex A2 + ORCID Y;
- ambos terminan en el mismo candidate group.

Eso bloquea el benchmark.

#### False split

Dos o más perfiles con el mismo ORCID válido terminan en candidate groups diferentes.

Eso también bloquea.

### 2.3 Stress / auditoría

El benchmark produce muestras reproducibles de casos de riesgo:

- homónimos con ORCID distintos;
- homónimos sin ancla determinista;
- colisiones mixtas;
- nombres con diacríticos;
- nombres con iniciales;
- nombres de tres o más tokens;
- candidate groups con múltiples OpenAlex IDs.

Estas muestras no reciben automáticamente una etiqueta humana.

Sirven para construir el siguiente golden set.

---

## 3. Dataset fijado

El benchmark V1 está pinneado a:

- GitHub release: `author-index-v3`;
- asset: `author-index-v3.tar.gz`;
- SHA-256:
  `f04eb636744f4cce7f694b1d64eab19acfbccae7a5b588b4f6102e1006930e7d`.

También fija:

### OpenAlex snapshot

- repo: `Mearman/OpenAlex`;
- revision:
  `ef02effac13bfbd0991612f444cebcef8a882453`.

### Corpus filosófico

- repo: `CristianPelayo/openalex-philosophy`;
- revision:
  `5a4a195085de54bf607a6c4397092ffb32716dcc`;
- path:
  `v3.2/philosophy-corpus-v3-2-search.parquet`.

El benchmark falla si el manifest extraído no coincide con estas revisiones.

---

## 4. Sin OpenAlex API

La evaluación no consulta:

`api.openalex.org`.

GitHub Actions descarga únicamente el artifact ya construido y publicado por el proyecto.

La identidad se evalúa sobre la copia estática fijada.

---

## 5. Escaneo masivo

El runner:

`scripts/authority/benchmark-author-authority-v1.mjs`

recorre todas las rutas:

`aliases/*.jsonl`

declaradas por el manifest.

Usa el mismo:

`createAuthorAliasAccumulator()`

que alimenta el batch pipeline.

Esto evita que benchmark y producción tengan normalizadores paralelos.

---

## 6. Por qué aliases es suficiente para este gate

Esta fase mide identidad, no bibliografía.

Para detectar:

- merges indebidos;
- splits por ORCID;
- perfiles perdidos;
- colisiones nominales;

no es necesario cargar todas las obras.

`works/` y `work-authors/` se evaluarán en los benchmarks de Contribution y Work Resolution.

Separar esos problemas permite atribuir una regresión a su capa correcta.

---

## 7. Cobertura exacta

El manifest fuente declara:

`counts.resolved_authors`.

El benchmark exige:

`aggregatedProfiles + quarantinedOpenAlexIds == resolved_authors`.

Si no coincide, el gate falla.

Esto evita producir métricas aparentemente verdes después de perder silenciosamente un shard de alias.

---

## 8. Perfiles sin candidate group

Además del control de cobertura, todos los perfiles agregados deben aparecer en:

`authorIdToCandidateRef`.

`unmappedProfileCount`

debe ser exactamente cero.

Esto cierra el caso donde un perfil fue leído correctamente pero desapareció durante la agrupación.

---

## 9. Homónimos reales del índice

Las colisiones se agrupan por el mismo normalizador de nombre.

Un grupo entra al análisis cuando:

- contiene dos o más perfiles;
- representa dos o más identity keys conservadoras.

Se clasifica como:

### distinct-orcid-homonym

Todos los perfiles tienen ORCID y existen al menos dos ORCID diferentes.

### anchorless-homonym

Ningún perfil tiene ORCID.

### mixed-anchor-homonym

Existe una combinación de perfiles con y sin ancla.

El benchmark conserva una muestra determinista de cada estrato.

---

## 10. Muestreo reproducible

Configuración:

- seed: `20261101`;
- hasta 100 casos por estrato.

La selección utiliza hashing estable.

La misma release, seed y código producen la misma muestra.

No se usa aleatoriedad de runtime.

---

## 11. Strata de auditoría de nombres

Además de homónimos se generan muestras de:

### Diacríticos

Nombres cuya forma Unicode contiene marcas diacríticas.

### Iniciales

Nombres con tokens de una sola letra.

### Multi-token

Nombres con tres o más tokens normalizados.

### Multi-ID

Candidate groups que contienen más de un OpenAlex Author ID.

Estos grupos son especialmente útiles para auditoría manual.

---

## 12. Gate V1

La configuración inicial exige:

- `goldFailures = 0`;
- `falseMergeGroups = 0`;
- `falseSplitGroups = 0`;
- `unmappedProfiles = 0`;
- cobertura fuente exacta.

Un solo false merge basta para fallar el workflow.

---

## 13. Archivos de salida

El benchmark produce:

### report.json

Contiene:

- source manifest resumido;
- release fijada;
- conteos de corpus;
- gold;
- silver;
- colisiones de nombre;
- muestras estratificadas;
- cobertura;
- resultado del gate.

### audit-sample.json

Contiene las muestras reproducibles para revisión humana.

### violations.json

Contiene:

- fallos gold;
- false merges;
- false splits;
- conflictos ORCID cuarentenados;
- razones del gate.

Los tres archivos se suben como artifact incluso cuando el benchmark falla.

---

## 14. Reproducibilidad del reporte

El resultado lógico no incorpora hora actual automática.

`generatedAt` permanece nulo en el artifact determinista.

El timestamp de ejecución pertenece al workflow, no al contenido evaluado.

Esto permite comparar reportes byte a byte cuando:

- código;
- configuración;
- release;

no cambian.

---

## 15. GitHub Actions

Workflow:

`.github/workflows/author-authority-benchmark-v1.yml`.

Secuencia:

1. checkout;
2. npm ci;
3. tests del benchmark;
4. lectura de configuración pinneada;
5. descarga de release con `gh release download`;
6. verificación SHA-256;
7. extracción;
8. benchmark masivo;
9. subida de evidencia.

El workflow tiene permiso de contenido de sólo lectura.

---

## 16. Qué significa pasar

Pasar V1 significa:

- la política determinista actual no produjo merges contradictorios;
- los ORCID compartidos convergen;
- ningún perfil del índice desapareció;
- el source manifest fue recorrido completamente;
- los casos gold curados siguen resolviendo correctamente.

No significa:

- que todas las personas del mundo estén correctamente desambiguadas;
- que OpenAlex no tenga errores;
- que todos los perfiles sin ORCID sean personas distintas;
- que la bibliografía sea exhaustiva;
- que Author Profile V2 esté listo para producción sin auditoría humana adicional.

---

## 17. Limitación del gold actual

El gold humano inicial es deliberadamente pequeño.

Antes de activar Author Profile V2 debe crecer usando `audit-sample.json`.

La siguiente auditoría humana debe incluir, como mínimo:

- homónimos reales;
- nombres hispanos compuestos;
- cambios de firma;
- iniciales;
- diacríticos;
- transliteraciones;
- múltiples OpenAlex IDs;
- autores sin ORCID.

Las etiquetas deben conservar evidencia y fecha de juicio.

---

## 18. Próximo paso

Si el benchmark masivo V1 pasa, el siguiente paso es **Human Authority Audit V1**:

1. congelar la muestra generada;
2. seleccionar casos de alto riesgo;
3. emitir juicios humanos de same-person / different-person / unresolved;
4. ampliar el golden set;
5. calcular false merge rate humano;
6. fijar el gate mínimo de Author Profile V2.

Sólo después debe comenzar el consumo de Authority Graph shards desde el navegador.
