# T2CS — Ledger de corroboración externa para tesis filosóficas UdeG

**Fecha:** 4 de noviembre de 2026  
**Ámbito:** evidencia de existencia/programa/autor fuera de Aleph, sin modificar
la identidad canónica ni atribuir paraderos físicos.

## Por qué existe esta fase

T2CQ/T2CR demostraron que los candidatos recuperados por Aleph pueden ser
otras publicaciones de la misma persona. Por tanto, la coincidencia de autor
no basta. T2CS añade una capa separada de corroboración para responder otra
pregunta: **¿hay evidencia independiente de que el trabajo, autor o programa
que aparecen en el catálogo CUCSH son reales, aunque todavía no conozcamos
su ejemplar físico?**

El ledger vive en
`scripts/thesis/config/philosophy-external-corroboration-v1.json`.
No entra automáticamente al corpus efectivo ni al índice público.

## Cuatro casos con corroboración adicional

### Daniel Galarza Santiago — 2025

**Trabajo:** *Filosofía de la pseudociencia. Conceptos fundamentales y
problemática de una rama emergente de la epistemología*.

PhilArchive registra el trabajo como una disertación de la Universidad de
Guadalajara y conserva una copia aportada por el autor cuya portada declara
CUCSH, Departamento de Filosofía y Licenciatura en Filosofía. La copia incluye
también una carta de supervisión académica.

**Decisión:** existencia, título/autor y programa quedan corroborados por una
fuente académica secundaria con evidencia institucional embebida. El trabajo
permanece sin paradero físico institucional reconciliado; no se crea holding.

Referencias:
- https://philarchive.org/rec/GALFDL-5
- https://philarchive.org/archive/GALFDL-5

### Adriel Manuel Hernández Guzmán — Maestría en Estudios Filosóficos

**Trabajo:** *¿El Estado que propone Platón en la República es una utopía?*

El perfil académico del propio autor en Academia.edu declara estudios de
Licenciatura en Filosofía y Maestría en Estudios Filosóficos en la Universidad
de Guadalajara y presenta este trabajo como tesis de maestría.

**Decisión:** corroboración secundaria controlada por el autor. Es evidencia
útil de existencia y programa, pero por sí sola no permite promover la identidad
a registro institucional confirmado.

Referencia:
- https://guadalajara.academia.edu/AdrielManuelHern%C3%A1ndezGuzm%C3%A1n

### Francisco Guízar Vázquez — 1999

**Trabajo:** *El significado del significante "bueno" en la obra Ética de la
liberación en la edad de la globalización y la exclusión de Enrique Dussel*.

Un documento de proyecto de la International Tropical Timber Organization
incluye el CV de Francisco Guízar Vázquez. En la sección de estudios consigna
Licenciatura en Filosofía, Universidad de Guadalajara, 1993–1999, y reproduce
el título de la tesis.

Esto también permite tratar `EXLUSIÓN` y el sufijo `Jr.` del inventario
CUCSH como **variantes de fuente para revisión**, no como texto a corregir
silenciosamente.

**Decisión:** trabajo, autor, UdeG y programa quedan corroborados por una
fuente organizacional independiente; ubicación física continúa sin resolver.

Referencia:
- https://www.itto.int/files/itto_project_db_input/3074/project/S-PPD-172-13-R1-I-Mexico.pdf?v=1709377939

### Ammiel Misraim García Diosdado — 2015

**Referencia CUCSH:** *Alexander von Humboldt: un ensayo sobre la antropología
filosófica de lo mexicano*.

RIUdeG conserva un artículo de 2016 de **Misraim Diosdado**, Universidad de
Guadalajara, titulado *Alexander von Humboldt: un ensayo sobre la antropología
filosófica del mexicano*. El contenido y el título muestran un linaje temático
muy estrecho, pero RIUdeG lo clasifica como **artículo**, no tesis.

Por separado, el Periódico Oficial del Estado de Jalisco registra
`GARCÍA DIOSDADO AMMIEL MISRAIM` con título profesional
`LICENCIADO EN FILOSOFIA`.

**Decisión:** el espaciado `Ammielmisraim` / `Ammiel Misraim` es una
variante razonable para revisión de identidad personal; el grado de Filosofía
está corroborado. El artículo de RIUdeG sugiere linaje de obra, pero **no se
fusiona con la tesis**.

Referencias:
- https://hdl.handle.net/20.500.12104/94563
- https://apiperiodico.jalisco.gob.mx/api/sites/periodicooficial.jalisco.gob.mx/files/01-10-17-viii.pdf

## Casos sin segunda fuente independiente suficiente en esta fase

No se encontró una segunda fuente pública suficientemente fuerte para promover
ninguna afirmación nueva sobre:

- Alberto Rafael Durán Ruezga — 1968;
- Silvia Graciela Moreno López — 1978;
- Francisco Salinas Paz — 1989;
- Juve Octavio Prieto Mendoza — 2009.

El antiguo listado de tesis aparece reproducido en sitios terceros y confirma
que esos títulos circulan públicamente, pero no se utiliza como corroboración
independiente porque puede ser una copia del mismo inventario CUCSH.

**Ausencia de resultados web no equivale a ausencia de tesis.** Estos cuatro
casos continúan en la ruta institucional: Biblioteca Rodríguez Lapuente,
CUCSH Belenes, Departamento de Filosofía y catálogos históricos.

## Contrato técnico

`validate_philosophy_external_corroboration_v1.py` exige:

- `referenceOnly=true`;
- cero mutaciones del corpus canónico;
- cero merges automáticos;
- `physicalLocation=unresolved` en todos los casos;
- URL pública y evidencia tipada;
- declaración explícita de qué claim soporta cada fuente;
- rechazo de rutas locales, bitstreams y endpoints de descarga usados como
  material almacenado.

El ledger **puede enlazar** una fuente remota que sea un documento publicado;
no descarga ni versiona esos documentos en el repositorio.

## Siguiente paso

T2CT deberá decidir, caso por caso, qué corroboraciones pueden mejorar la ficha
pública **sin cambiar su estatus de identidad**. La prioridad institucional
sigue siendo conseguir identificadores de catálogo, handle, signatura o
confirmación bibliotecaria para cada tesis.
