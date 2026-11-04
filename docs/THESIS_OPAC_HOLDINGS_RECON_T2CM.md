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
