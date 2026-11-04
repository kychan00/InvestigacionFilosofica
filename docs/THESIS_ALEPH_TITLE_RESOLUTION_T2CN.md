# T2CN — Resolución estricta por título en Aleph

## Objetivo

Antes de consultar las 233 referencias del Índice Maestro T2CL, validar que una
búsqueda por título en Aleph puede conducir de forma reproducible al mismo
`Número de sistema` que ya conocemos para tesis de control.

## Casos de control

- Raúl Sánchez Salas — `000551988`;
- José Antonio Ramírez Velasco — `000479311`;
- Víctor Manuel Espinosa Aguilar — `000168319`.

Los tres ya tienen holdings físicos confirmados por T2CM.

T2CN busca sus títulos en el catálogo general `UDG01` usando `WTI` y prueba
tanto palabras no adyacentes como adyacentes. El resultado sólo se considera
validado si la navegación Aleph conduce al mismo número de sistema.

## Caso de descubrimiento

También se prueba Guillermo Vargas Curiel, cuyo registro CUCSH está confirmado
pero aún no tiene número de sistema incorporado al índice maestro. El objetivo
es comprobar si el mismo mecanismo puede descubrir su identidad Aleph.

## Política para el barrido posterior

Una futura resolución masiva deberá aceptar automáticamente sólo cuando:

1. la búsqueda produzca una única identidad Aleph;
2. el registro completo preserve título y autor compatibles de forma
   determinista;
3. la nota de tesis/programa no contradiga la referencia de origen.

Cualquier búsqueda con múltiples identidades o contradicciones permanecerá en
revisión. No habrá fuzzy auto-merge.

## Reference-only

Se conservan únicamente metadatos de la respuesta, números de sistema y
holdings. No se descargan tesis, PDFs, bitstreams ni texto completo.


## Robustez de sesión — V2

El primer run recibió una portada Aleph transitoria sin formulario. V2 abre una sola
sesión para todo el probe, la reutiliza entre los cuatro casos y permite hasta cuatro
intentos acotados para obtener la acción dinámica del formulario. Esto reduce carga
sobre el OPAC y separa indisponibilidad transitoria de un fallo del contrato de búsqueda.


## Faceta Tesis inconsistente — V3

La prueba V2 llegó correctamente al índice `WTI`, pero `WFM=TESIS` produjo cero
resultados incluso para los tres registros de control que T2CM abrió directamente y
cuyas fichas dicen explícitamente `Base Lógica: Tesis` / `Nota de tesis`.

V3 elimina esa faceta durante el descubrimiento. La condición de tesis se valida en
el registro completo después de resolver una identidad, nunca mediante el filtro WFM.


## Fallback determinista por autor — V4

Sin la faceta WFM, el título exacto resolvió de forma única a Raúl Sánchez Salas y
Víctor Manuel Espinosa Aguilar. José Antonio Ramírez Velasco no resolvió porque el
registro Aleph conserva el título con `necesari`, mientras la referencia curada usa
`necesaria`. Guillermo Vargas Curiel produjo una permutación amplia.

V4 añade una búsqueda `WAU` por nombre completo. Esta búsqueda no autoriza por sí
sola una fusión: sólo descubre candidatos. La aceptación futura exige comprobar el
registro completo y conservar los casos con discrepancias textuales como revisión.


## Piloto de reconciliación de holdings

T2CN añade un resolvedor limitado a 24 referencias del Índice Maestro T2CL.

Orden de resolución:

1. identidad Aleph ya verificada por T2CM, cuando exista;
2. título exacto `WTI`;
3. autor completo `WAU` con adyacencia;
4. apertura del registro candidato por número de sistema;
5. aceptación automática sólo si título y autor coinciden exactamente después de
   normalización estructural;
6. extracción de holdings mediante `item-global`.

La salida nunca conserva la URL dinámica de sesión Aleph. Sólo persiste número de
sistema y metadatos de holdings. Los candidatos con errores tipográficos, títulos
distintos o múltiples coincidencias permanecen sin resolver.


## Muestra estratificada — piloto V2

El primer lote de 24 quedó dominado por 2014–2015 y sólo resolvió el seed de Raúl
Sánchez Salas. Eso no mide adecuadamente la cobertura histórica de Aleph.

El piloto V2 selecciona primero las tres identidades verificadas de T2CM y después
hace round-robin por década (1960s–2020s). Así la prueba incluye tesis históricas,
intermedias y recientes sin convertir la fecha en un criterio de admisión.


## Resultado del piloto estratificado

El run sobre 24 referencias produjo:

- 24 intentadas;
- **5 resueltas**;
- **5 con holdings físicos confirmados**;
- 3 resueltas mediante seeds T2CM;
- **2 descubiertas automáticamente mediante búsqueda Aleph**;
- 19 sin resolver;
- 0 ambiguas aceptadas.

### Nuevas identidades descubiertas

**Alejandro Loera García**

- sistema Aleph: `000588539`;
- biblioteca: **B.C. CUAAD**;
- colección: `Col. Area de Tesis`;
- clasificación: `068 MEEPA`;
- holdings observados: ejemplar impreso y ejemplar con CD.

**Jorge Lara Ramos — “José Gaos y la filosofía de la filosofía” (1973)**

- sistema Aleph: `000479362`;
- biblioteca: **B.C. CUCSH**;
- colección: `Col. Alberto Ladrón de Guevara`;
- clasificación: `196.1 LAT 1973`.

### Qué significa el 19/24 no resuelto

“No resuelto” no equivale a inexistente. En el lote aparecieron varias clases:

- cero resultados tanto por título como por autor;
- autores presentes en Aleph sólo mediante otras obras;
- títulos Drupal con errores tipográficos;
- referencias recientes todavía no visibles en Aleph.

El resolvedor rechazó correctamente candidatos de otros libros/artículos del mismo
autor. Por ejemplo, no confundió una obra posterior de Iker Javier Pulido Rodríguez
con su trabajo de titulación de 2014.

La siguiente fase debe ampliar cobertura por lotes y añadir estrategias de
descubrimiento más tolerantes **sólo para generar candidatos**; la aceptación final
seguirá exigiendo compatibilidad bibliográfica determinista.
