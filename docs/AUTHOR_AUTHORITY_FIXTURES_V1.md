# Author Authority — Matriz de fixtures y benchmark V1

## Estado

**Fase 2 — diseño de validación.**

Este documento define los casos mínimos que deben existir antes de implementar el Identity Resolution Engine. No contiene lógica de producción ni thresholds.

La meta es impedir que el sistema se declare «general» por resolver uno o dos autores concretos.

---

## 1. Estrategia

Los fixtures se dividen en dos grupos.

### 1.1 Fixtures sintéticos

Casos fabricados para aislar una sola propiedad:

- homonimia;
- ORCID;
- segundo apellido;
- coautoría;
- rol editorial;
- edición;
- traducción;
- error de fuente;
- cobertura parcial;
- contradicción.

Estos casos deben ser pequeños, deterministas y fáciles de razonar.

### 1.2 Regresiones reales

Casos históricos del proyecto donde el perfil de autor presentó problemas reales.

Deben utilizarse como regresiones de extremo a extremo, pero **nunca como fundamento de reglas especiales**.

Entre los regresores iniciales del proyecto deben incluirse:

- Dinora Hernández López;
- Ángeles Eraña;
- otros autores que históricamente hayan mostrado bibliografía incompleta, alias o confusión de identidad.

El benchmark debe crecer con el proyecto.

---

# 2. Qué debe comprobar cada fixture

Cada escenario debe declarar explícitamente:

- entradas;
- menciones observadas;
- candidatos;
- identificadores;
- evidencias;
- vetos;
- decisión esperada;
- contribuciones esperadas;
- obras/versiones esperadas;
- Coverage Ledger esperado;
- resultado prohibido.

El «resultado prohibido» es especialmente importante porque define qué error sería inaceptable.

---

# 3. Matriz mínima de identidad

## F01 — misma persona, mismo ORCID, nombres distintos

### Entrada

Tres registros:

- «María Elena Torres»;
- «M. E. Torres»;
- «Torres, María Elena».

Los tres contienen el mismo ORCID válido.

### Esperado

- tres `AuthorMention`;
- una `AuthorityPerson`;
- evidencia clase A;
- decisión `confirmed`.

### Prohibido

Crear tres personas independientes sólo porque las cadenas difieren.

---

## F02 — mismo nombre, ORCID distintos

### Entrada

Dos registros con «José Martínez».

Cada uno contiene un ORCID distinto y válido.

### Esperado

- dos candidatos separados;
- evidencia `VETO`;
- prohibición de fusión automática.

### Prohibido

Fusionarlos por igualdad textual de nombre.

---

## F03 — nombre corto compartido, segundo apellido incompatible

### Entrada

- «Laura Hernández López»;
- «Laura Hernández García»;
- «Laura Hernández».

### Esperado

La forma corta puede generar ambos candidatos.

Las dos formas completas no se fusionan entre sí.

La forma corta queda:

- resuelta sólo si existe evidencia adicional;
- o `ambiguous`.

### Prohibido

Usar sólo «Laura Hernández» para colapsar las tres menciones.

---

## F04 — muchas más obras no demuestran identidad

### Entrada

Dos candidatos homónimos.

Candidato A tiene 80 obras.

Candidato B tiene 6.

No existen ORCID ni evidencias bibliográficas fuertes.

### Esperado

El número de obras puede ordenar la lista de candidatos, pero la decisión permanece ambigua.

### Prohibido

Resolver A automáticamente por popularidad o volumen.

---

## F05 — nombre exacto + afiliación + red de coautores

### Entrada

Una mención sin ORCID.

Existe una autoridad previa con:

- mismo nombre completo;
- misma afiliación específica;
- varios coautores recurrentes;
- obras temporalmente compatibles.

### Esperado

Evidencia B + C + D.

El caso puede llegar a `probable` o `confirmed` según las reglas que se definan posteriormente.

### Prohibido

Tratar el nombre exacto como la única evidencia.

---

## F06 — diacríticos

### Entrada

- «Ángeles Eraña»;
- «Angeles Erana».

### Esperado

La normalización produce candidatos relacionados.

La pérdida de diacríticos por sí sola no constituye prueba suficiente de identidad.

### Prohibido

Crear una regla especial para este nombre concreto.

---

## F07 — orden apellido/nombre

### Entrada

- «Hernández López, Dinora»;
- «Dinora Hernández López».

### Esperado

Ambas formas generan firmas nominales compatibles.

La resolución final depende de evidencia.

### Prohibido

Interpretar «Hernández López» como nombres propios.

---

## F08 — iniciales insuficientes

### Entrada

«J. Pérez».

Existen cinco autoridades compatibles.

### Esperado

- cinco candidatos o subconjunto bloqueado;
- estado `ambiguous` o `unresolved`.

### Prohibido

Elegir automáticamente el candidato con más publicaciones.

---

# 4. Matriz de autoría y roles

## F09 — nombre sólo en título

### Entrada

Un artículo titulado:

> Sobre la filosofía de X

donde X aparece en el título, pero no en los campos de creador.

### Esperado

No se crea una `Contribution` para X.

### Prohibido

Incluir el artículo en el perfil de X como obra propia.

---

## F10 — coautoría estructurada

### Entrada

Un registro con tres creadores estructurados.

### Esperado

- tres AuthorMention;
- tres Contribution si las identidades se resuelven;
- rol de coautoría cuando corresponda;
- red de colaboración derivable.

### Prohibido

Mostrar la obra como autoría individual de cualquiera de los tres.

---

## F11 — coordinador explícito

### Entrada

Un libro registra:

> Ana Ruiz, coordinadora.

### Esperado

Contribution con rol `coordinator`.

### Prohibido

Normalizar automáticamente a `author`.

---

## F12 — cadena colectiva no separable

### Entrada

Campo de creador:

> Ana Ruiz y colaboradores

sin nombres individuales adicionales.

### Esperado

- una mención para Ana Ruiz si puede separarse con seguridad;
- señal de obra colectiva;
- ningún coautor inventado.

### Prohibido

Crear personas ficticias o afirmar autoría individual.

---

## F13 — editor y autor en la misma obra

### Entrada

La misma persona aparece como:

- editor del volumen;
- autor de un capítulo.

### Esperado

Dos Contribution distintas ligadas a objetos/roles correspondientes.

### Prohibido

Colapsar todos los roles bajo «autor del libro».

---

## F14 — traductor

### Entrada

Una traducción registra explícitamente autor original y traductor.

### Esperado

- Contribution de autoría al original;
- Contribution de traducción a la versión traducida;
- relación entre WorkVersion cuando sea justificable.

### Prohibido

Presentar al traductor como autor original.

---

# 5. Matriz de obras, versiones y duplicados

## F15 — mismo DOI en dos proveedores

### Entrada

Crossref e índice local describen el mismo artículo con DOI idéntico.

### Esperado

- dos SourceRecord;
- una WorkVersion;
- una IntellectualWork;
- procedencia múltiple.

### Prohibido

Mostrar dos obras independientes.

---

## F16 — mismo título, años distintos

### Entrada

Dos libros con título idéntico, 2008 y 2016.

Sin ISBN ni relación editorial explícita.

### Esperado

Candidato a relación entre versiones, pero no fusión automática.

### Prohibido

Decidir «reedición» sólo por título.

---

## F17 — reedición documentada

### Entrada

Dos registros con:

- título compatible;
- edición explícita;
- relación editorial documentada;
- ISBN diferentes.

### Esperado

Una IntellectualWork con dos WorkVersion.

### Prohibido

Reducir ambas a una sola versión y perder ISBN/fecha.

---

## F18 — traducción documentada

### Entrada

Una edición en español declara traducción de una obra original.

### Esperado

- una obra intelectual relacionada;
- versión traducida distinta;
- Contribution del traductor.

### Prohibido

Fusionar metadatos destruyendo el idioma y la edición.

---

## F19 — títulos deformados por proveedor

### Entrada

Dos registros del mismo DOI con diferencias de entidades HTML o marcas editoriales.

### Esperado

Una versión bibliográfica tras normalización.

### Prohibido

Crear duplicado sólo por codificación textual.

---

# 6. Matriz de contradicción y memoria

## F20 — decisión rechazada persistente

### Entrada

Una publicación fue evaluada anteriormente y rechazada para una autoridad por ORCID incompatible.

En una reconstrucción posterior vuelve a aparecer por coincidencia de nombre.

### Esperado

La decisión previa se reutiliza o se reevalúa explícitamente sin perder el veto.

### Prohibido

Volver a aceptar automáticamente el mismo falso positivo.

---

## F21 — nueva evidencia supersede una decisión

### Entrada

Una atribución estaba `unresolved`.

Posteriormente aparece una fuente institucional con ORCID verificable.

### Esperado

Nueva ResolutionDecision que supersede la anterior.

La decisión histórica permanece auditable.

### Prohibido

Editar destructivamente la decisión previa como si nunca hubiera existido.

---

## F22 — split de autoridad

### Entrada

Una autoridad histórica contiene publicaciones ligadas a dos ORCID distintos.

### Esperado

- detección de contradicción;
- creación de autoridades separadas;
- redistribución de contribuciones según evidencia;
- historial de split.

### Prohibido

Mantener un perfil mezclado por continuidad histórica del ID.

---

## F23 — merge legítimo de autoridades

### Entrada

Dos autoridades internas creadas en builds previos aparecen posteriormente unidas por ORCID idéntico y evidencia fuerte.

### Esperado

- una autoridad canónica;
- redirect desde la absorbida;
- historial de merge;
- URLs antiguas recuperables.

### Prohibido

Eliminar físicamente el ID anterior.

---

# 7. Matriz temporal y afiliaciones

## F24 — afiliaciones sucesivas

### Entrada

La misma persona figura en dos instituciones en periodos diferentes.

### Esperado

Ambas afiliaciones se conservan con rango temporal.

### Prohibido

Interpretar automáticamente el cambio institucional como homonimia.

---

## F25 — afiliaciones simultáneas

### Entrada

La misma persona declara dos afiliaciones en el mismo artículo.

### Esperado

Dos AffiliationAssertion simultáneas.

### Prohibido

Tratarlo como contradicción dura.

---

## F26 — cronología imposible

### Entrada

Una autoridad tiene actividad documentada en un rango coherente.

Una mención homónima aparece varias décadas fuera de ese rango y con otra red bibliográfica.

### Esperado

Evidencia contextual negativa fuerte que obliga a mantener candidatos separados salvo prueba determinista contraria.

### Prohibido

Fusionar sólo por nombre.

---

# 8. Matriz de cobertura

## F27 — fuente agotada

### Entrada

El proveedor devuelve todas sus páginas y finaliza correctamente.

### Esperado

Coverage status `exhausted`.

### Prohibido

Traducir `exhausted` a «bibliografía completa universal».

---

## F28 — límite defensivo

### Entrada

La fuente aún tiene resultados, pero el pipeline alcanza límite de seguridad.

### Esperado

Coverage status `partial`.

### Prohibido

Marcar la fuente como agotada.

---

## F29 — proveedor caído

### Entrada

Una fuente no responde.

### Esperado

Coverage status `unavailable`.

El resto del expediente puede construirse.

### Prohibido

Ocultar el fallo y declarar cobertura completa.

---

## F30 — fuente no aplicable

### Entrada

Una autoridad no posee ninguna clave válida para cierto proveedor.

### Esperado

`not-applicable`.

### Prohibido

Confundirlo con error o con `exhausted`.

---

## F31 — fuente deliberadamente no consultada

### Entrada

Una política de ejecución deshabilita un proveedor.

### Esperado

`not-queried`.

### Prohibido

Presentar ausencia de resultados como evidencia de que no existen obras.

---

# 9. Matriz de saturación bibliográfica

## F32 — convergencia limpia

### Iteraciones

1. semillas iniciales → 5 obras;
2. nuevas variantes/coautores → +3 obras;
3. nuevos DOI → +1 obra;
4. ninguna evidencia nueva.

### Esperado

`saturationState = reached`.

### Prohibido

Seguir iterando indefinidamente.

---

## F33 — ciclo de expansión

### Entrada

Dos proveedores se redescubren mutuamente mediante los mismos identificadores.

### Esperado

Deduplicación de claves de frontera y terminación.

### Prohibido

Loop infinito.

---

## F34 — saturación interrumpida por límite

### Entrada

La frontera aún contiene nuevas claves, pero se alcanza el límite de iteraciones.

### Esperado

`saturationState = cutoff`.

### Prohibido

Marcar `reached`.

---

# 10. Regresiones reales iniciales

## R01 — Dinora Hernández López

Debe utilizarse como **regresión real**, no como excepción.

El caso debe comprobar al menos:

- variantes nominales;
- ORCID ya verificado en la capa curada existente;
- obras procedentes de más de una fuente;
- roles bibliográficos conservados;
- ausencia de mezcla con homónimos;
- capacidad de reconstrucción sin ruta lógica exclusiva para Dinora.

Criterio de éxito:

> El perfil obtenido por el sistema general conserva o mejora la cobertura actual sin depender de `if (author === Dinora)` ni de una ruta equivalente.

---

## R02 — Ángeles Eraña

Debe utilizarse como regresión de cobertura porque históricamente el perfil mostró muy pocas obras.

El caso debe comprobar:

- que el sistema no se detenga en las primeras coincidencias;
- que las variantes de identidad no reduzcan artificialmente la cobertura;
- que los resultados adicionales conserven evidencia de atribución.

Criterio de éxito:

> El aumento de recall no incrementa falsos merges de identidad.

---

## R03 — autor homónimo real

Debe incorporarse al benchmark un autor real del corpus con homónimos bibliográficos.

No debe elegirse sólo un caso fácil.

Criterio de éxito:

> La arquitectura mantiene separadas las identidades aun cuando el nombre normalizado sea idéntico.

---

## R04 — autor ausente del corpus primario

Debe seleccionarse un autor real cuya producción no esté suficientemente representada en OpenAlex Philosophy/Hugging Face.

Criterio de éxito:

> El Authority Graph puede construirse con fuentes complementarias sin crear una excepción nominal.

---

# 11. Métricas del benchmark

## 11.1 Identidad

- precision de merge;
- recall de menciones pertenecientes a la misma persona;
- false merge rate;
- false split rate;
- unresolved rate.

La métrica prioritaria es **false merge rate**.

## 11.2 Contribución

- precision de atribución;
- recall de contribuciones;
- exactitud de rol;
- tasa de falsos «autor individual».

## 11.3 Obras

- precision de deduplicación;
- false work merge rate;
- false work split rate;
- exactitud de relación obra/versión.

## 11.4 Cobertura

- fuentes agotadas correctamente;
- fuentes parciales correctamente señaladas;
- errores no ocultados;
- saturación correctamente clasificada.

---

# 12. Política de promoción

Ninguna fase posterior debe promoverse porque:

- Dinora se vea bien;
- Ángeles tenga más resultados;
- un fixture individual pase.

La implementación debe superar:

1. todos los invariantes estructurales;
2. la matriz sintética obligatoria;
3. las regresiones reales;
4. un muestreo amplio de autores del corpus.

El benchmark masivo de una fase posterior deberá tomar una muestra suficientemente grande y diversa, idealmente cientos de autores, no una lista manual de favoritos.

---

# 13. Golden set humano

La arquitectura debe permitir un conjunto de evaluación revisado manualmente.

Cada caso del golden set debe registrar:

- autoridad correcta;
- menciones pertenecientes;
- menciones excluidas;
- contribuciones confirmadas;
- roles;
- obras agrupadas;
- versiones relacionadas;
- evidencia principal.

El golden set no debe generarse con el mismo algoritmo que se evalúa.

---

# 14. Prohibiciones del benchmark

No se permite:

- modificar un fixture para que pase una implementación concreta;
- añadir excepciones nominales;
- usar cantidad de obras como ground truth de identidad;
- considerar resultados de búsqueda general como autorías verificadas;
- ocultar casos ambiguos;
- eliminar regresiones incómodas;
- declarar exhaustividad universal.

---

# 15. Criterio de cierre de Fase 2

Fase 2 se considera lista para avanzar cuando:

- los contratos de datos representan todos los escenarios de esta matriz;
- ningún fixture requiere una entidad ad hoc;
- Dinora y Ángeles pueden describirse con el mismo modelo que los casos sintéticos;
- quedan diferenciados identidad, contribución, obra, versión, fuente, evidencia, decisión y cobertura;
- la futura Fase 3 puede implementar resolución sin rediseñar el modelo conceptual.
