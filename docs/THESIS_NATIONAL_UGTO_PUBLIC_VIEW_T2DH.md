# T2DH · Tesis nacionales por institución + Universidad de Guanajuato

Fecha: 2026-11-07

## Objetivo

Convertir `tesis.html` de una superficie visualmente anclada a UdeG en una arquitectura extensible para tesis de universidades mexicanas:

`Tesis → Institución → colección/área`.

La primera incorporación externa es la Universidad de Guanajuato (UG), Filosofía.

## Compatibilidad

- UdeG conserva sus vistas Humanidades, Filosofía y Editorial UdeG.
- `?scope=philosophy` y `?scope=editorial` siguen resolviendo a UdeG.
- UG usa `?institution=ugto&scope=philosophy`.
- La navegación visible cambia de «Tesis UdeG» a «Tesis».

## Corpus UG

El índice público T2DH congela 59 tesis visibles el 7 de noviembre de 2026 en tres colecciones oficiales del Repositorio Institucional de la Universidad de Guanajuato:

- Licenciatura en Filosofía: 14 tesis.
- Maestría en Filosofía: 35 tesis.
- Doctorado en Filosofía: 10 tesis.

Existe además una colección separada con 3 trabajos de investigación de Licenciatura en Filosofía. Se documenta, pero no se suma al conteo de tesis.

## Política de procedencia

- Reference-only.
- 0 PDF alojados.
- Sólo se publican enlaces a páginas `/handle/20.500.12059/<id>` del repositorio UG.
- Un registro visible en el repositorio no se presenta como inventario histórico completo de titulaciones.
- No se infieren autores, directores, unidades académicas ni metadatos que la colección pública no proporcione.

## Escalabilidad

Nuevas universidades deberán incorporarse como datasets institucionales independientes con:
1. contrato de validación;
2. procedencia explícita;
3. conteos congelados;
4. URL compartible;
5. pruebas de no-regresión;
6. separación estricta entre tesis y otros tipos documentales.
