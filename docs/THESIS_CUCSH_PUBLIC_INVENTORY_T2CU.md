# T2CU — Inventario histórico CUCSH en la vista pública de Filosofía

**Fecha de corte:** 4 de noviembre de 2026  
**Base pública:** T2CT, 18 referencias (16 INCLUDE / 2 REVIEW)  
**Fuente institucional histórica:** catálogo de tesis de la Biblioteca CUCSH,
reconstruido por T2CJ como metadata reference-only.

## Objetivo

La vista pública de Filosofía no debe limitarse a las tesis digitalizadas en
RIUdeG. La Biblioteca CUCSH mantiene un inventario histórico de
**217 filas** bajo `Licenciatura en Filosofía`, con título, autor, año,
programa y, cuando existe, enlace de detalle.

T2CU integra ese inventario en la vista pública sin almacenar tesis ni afirmar
que cada ficha represente un ejemplar físico actualmente localizado.

## Deduplificación

El inventario contiene 217 filas, pero sólo **216 identidades bibliográficas
únicas** bajo una clave estricta:

`título normalizado + autor normalizado + año`.

La única duplicación observada es:

- *El enunciado desde la perspectiva de Michel Foucault* — Ismael Jiménez
  Alvarado — 2011.

El catálogo expone dos filas/URLs con variantes de comillas, puntuación y
acentuación. T2CU conserva ambas URLs como evidencia de catálogo, pero publica
una sola referencia.

Al cruzar las 216 identidades CUCSH con T2CT existe **una coincidencia exacta**
ya publicada:

- Guillermo Vargas Curiel — 2006 — *Análisis descriptivo sobre a modificación
  curricular a la Licenciatura en Filosofía de la Universidad de Guadalajara
  en 1996 desde la perspectiva del pensamiento complejo*.

Por tanto:

- 217 filas CUCSH;
- 216 identidades únicas;
- 1 duplicación interna colapsada;
- 1 merge exacto con T2CT;
- 215 referencias públicas nuevas;
- 18 + 215 = **233 referencias finales**.

Este total coincide con el Índice Maestro de paraderos T2CL, construido por
una ruta independiente. Esa convergencia no prueba holdings físicos, pero sí
aporta una comprobación cruzada de cardinalidad bibliográfica.

## Dos reconciliaciones que motivaron la fase

### Ammiel Misraim García Diosdado

El artifact T2CJ contiene la ficha CUCSH exacta:

- título: *Alexander von Humboldt: un ensayo sobre la antropología filosófica
  de lo mexicano*;
- autor en catálogo: `AMMIELMISRAIM GARCÍA DIOSDADO`;
- año: 2015;
- programa: Licenciatura en Filosofía;
- director: José María Nava Preciado;
- URL de detalle CUCSH específica.

T2CS ya había corroborado independientemente el grado de Licenciado en
Filosofía y una publicación UdeG derivada sobre Humboldt. T2CU no necesita
usar esa publicación como sustituto de la tesis: la identidad bibliográfica
pública proviene ahora del catálogo oficial CUCSH.

### Francisco Guízar Vázquez

El artifact T2CJ contiene:

- título de catálogo: *El significado del significante "bueno" en la obra
  Ética de la liberación en la edad de la globalización y la exlusión de
  Enrique Dussel*;
- autor: `FRANCISCO GUIZAR VAZQUEZ, JR.`;
- año: 1999;
- programa: Licenciatura en Filosofía;
- URL de detalle CUCSH específica.

T2CS había encontrado un CV organizacional que corrobora la Licenciatura en
Filosofía UdeG y una variante corregida del título. T2CU **preserva la grafía
del catálogo CUCSH** (`EXLUSIÓN`, `JR.`) en la ficha pública; no corrige
silenciosamente la fuente.

## Modelo de publicación

Los registros CUCSH añadidos usan:

- `philosophyStatus=include`;
- `philosophyRole=program-core`;
- `programRef=program:udg:lic-filosofia`;
- `validationTier=official-cucsh-library-record`;
- `classificationSource=official-cucsh-catalog`;
- `sourceKind=official-cucsh-inventory`.

El enlace público se normaliza a HTTPS sobre el mismo host, path y query del
catálogo legado. El navegador sólo acepta URLs CUCSH con una estructura
controlada, incluyendo `?q=content/<slug>`.

## Qué NO significa una ficha CUCSH

Una referencia de catálogo prueba que el trabajo está inventariado por la
Biblioteca CUCSH. **No prueba por sí sola**:

- que exista actualmente un ejemplar disponible;
- que esté en La Normal, Belenes u otra sede;
- que tenga una signatura vigente;
- que esté digitalizada;
- que exista un PDF abierto.

Por eso T2CU mantiene `physicalHoldingsClaimed=false`. Los cinco holdings
confirmados de T2CN siguen siendo una capa distinta y más fuerte.

## Contrato público esperado

Después de T2CU:

- **233** referencias filosóficas;
- **231 INCLUDE**;
- **2 REVIEW**;
- `program-core=224`;
- `philosophical-content=6`;
- `curated-manual-classification=1`;
- `program-core-candidate=2`;
- Licenciatura en Filosofía documentada: **221 referencias públicas**
  (220 INCLUDE / 1 REVIEW);
- Maestría en Estudios Filosóficos: 3;
- Maestría histórica en Filosofía: 2;
- 0 PDFs almacenados;
- 0 holdings físicos nuevos inferidos.

## Reproducibilidad

`scripts/thesis/merge_philosophy_cucsh_inventory_t2cu.py` consume:

1. el índice público T2CT;
2. el reporte vivo generado por
   `scripts/thesis/probe_cucsh_thesis_catalog_v1.py`.

En CI y Pages se vuelve a enumerar el catálogo CUCSH. Si la cardinalidad,
el esquema o las invariantes esperadas cambian, el despliegue falla cerrado en
vez de publicar silenciosamente otro universo.

El reporte de catálogo se conserva como artifact de CI para auditoría, no se
publica como texto completo ni contiene HTML bruto.

## Siguiente frontera

T2CU resuelve el gran hueco de **Licenciatura**. El siguiente trabajo debe
ampliar Maestría en Estudios Filosóficos y la producción filosófica del
Doctorado en Humanidades mediante fuentes institucionales, porque el filtro
Drupal de maestría sigue siendo incompleto y el doctorado requiere adjudicación
obra por obra.
