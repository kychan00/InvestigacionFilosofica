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
