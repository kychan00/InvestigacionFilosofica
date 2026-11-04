# T2CM — Recon de OPAC/holdings para tesis filosóficas UdeG

## Objetivo

Resolver la ubicación física de las referencias del Índice Maestro T2CL.

La primera revisión de T2CM no consulta todavía una tesis concreta. Descubre de forma reproducible qué endpoint usa actualmente SiUBiUDG para el catálogo colectivo y CUCSH, incluyendo enlaces que puedan estar escondidos en JavaScript o atributos HTML.

## Fuentes semilla

- `https://bibliotecas.udg.mx/catalogos-en-linea`
- `https://wdg.biblio.udg.mx/`

Ambas son superficies institucionales que describen el OPAC como el catálogo para localizar recursos físicos de la Red Universitaria.

## Descubrimiento

El probe:

- analiza enlaces, atributos y scripts inline;
- conserva únicamente URLs UdeG o direcciones de la red institucional `148.202.*`;
- rechaza PDF, bitstream y download;
- prueba conectividad sólo contra endpoints descubiertos en las páginas oficiales;
- no persiste HTML bruto;
- no usa credenciales ni sesión UdeG.

## Regla de holdings

T2CL mantiene todas las ubicaciones físicas en `null`.

T2CM sólo podrá afirmar:

- biblioteca;
- sede;
- colección;
- signatura;
- número de sistema;
- disponibilidad física;

cuando el OPAC o un registro bibliotecario institucional lo devuelva explícitamente.

## Siguiente revisión

Una vez identificado el endpoint/contrato del OPAC, T2CM V2 probará una muestra de identidades ya conocidas:

- Guillermo Vargas Curiel;
- Guillermo Castillo Ramírez;
- Raúl Sánchez Salas;
- José Antonio Ramírez Velasco.

La muestra servirá para definir una consulta determinista antes de ejecutar el inventario de 233 referencias.


## Endpoint CUCSH confirmado

El primer artifact T2CM descubrió, desde la página oficial de SiUBiUDG, el endpoint:

`http://148.202.248.73/F/?func=find-b-0&local_base=CUCSH`

La respuesta fue HTTP 200 y el título de página fue `CUCSH - Búsqueda básica`.

T2CM V2 extrae el contrato del formulario Aleph de esa página —acción, método, inputs, selects y opciones— sin enviar todavía una consulta bibliográfica. Este contrato será la base para consultas reproducibles por título/autor/número de sistema.


## Optimización V3

El primer recon encontró 113 URLs institucionales, muchas de ellas hojas de estilo, scripts y páginas Drupal sin relación con holdings. T2CM V3 conserva ese inventario como evidencia pero limita las pruebas de conectividad al endpoint CUCSH, la portada Aleph y el catálogo colectivo UDG01. Esto reduce latencia sin cambiar el descubrimiento.


## Muestra exacta por número de sistema — V4

El contrato Aleph expone `find_code=SYS`, por lo que T2CM V4 consulta una muestra sin fuzzy matching:

- Raúl Sánchez Salas — `000551988`;
- José Antonio Ramírez Velasco — `000479311`;
- Víctor Manuel Espinosa Aguilar — `000168319`.

Cada consulta fuerza `local_base=CUCSH` y `filter_request_4=TESIS`. El probe conserva únicamente metadatos de respuesta, fragmentos relevantes, filas tabulares y enlaces Aleph hacia registro completo/ítems; no persiste HTML.


## Sesión Aleph — V5

La prueba V4 confirmó que enviar parámetros directamente a `/F/` no ejecuta la búsqueda: Aleph devuelve de nuevo la pantalla básica. El formulario genera una acción dinámica `/F/<session-token>`.

T2CM V5 abre el OPAC, conserva la cookie de sesión, toma la acción real del formulario y envía allí la consulta `SYS`. Para búsquedas por número de sistema no se exige el filtro histórico de formato Tesis, ya que el identificador de sistema es único y un registro antiguo podría carecer de ese clasificador.


## Acceso directo por número de sistema — V6

La búsqueda `find-b` con sesión siguió mostrando la forma básica. Aleph dispone de una vía más exacta para una identidad conocida: `func=direct&doc_number=<SYS>`.

T2CM V6 abre una sesión y prueba cada número de sistema en dos bases:

- `CUCSH` — catálogo local;
- `UDG01` — catálogo general de Centros Universitarios.

Luego sigue sólo enlaces institucionales de registro completo/ítems para detectar holdings. Esta vía evita búsqueda textual y conserva el número de sistema como identidad primaria.
