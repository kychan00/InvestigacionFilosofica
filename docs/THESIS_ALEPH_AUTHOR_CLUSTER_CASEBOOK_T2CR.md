# T2CR — Expediente curatorial de candidatos Aleph por tesis de origen

**Corte de evidencia:** 4 de noviembre de 2026. Origen verificable: PR #182 T2CQ,
workflow run [41914841293](https://github.com/kychan00/InvestigacionFilosofica/actions/runs/41914841293),
artifact ID `13364886141` (`discrepancy-review.json`). Este expediente
conserva referencias bibliográficas; no contiene PDFs ni reproduce obras.

## Resultado central

En ocho tesis CUCSH de la primera muestra T2CQ, se inspeccionaron
**17 registros candidatos Aleph** y **siete** coincidían en tokens completos
de autor con su tesis de origen. **Esas siete coincidencias pertenecen
sólo a tres tesis de origen**, no a siete tesis distintas: 1 de Silvia
Graciela Moreno López, 5 de Francisco Salinas Paz y 1 de Juve Octavio
Prieto Mendoza. **Ninguno** de los 17 candidatos tiene identidad
bibliográfica exacta con la tesis de origen. Confirmaciones nuevas: **cero**.

| Tesis CUCSH buscada | Año | Autor de origen | Aleph con mismo autor | Observación |
|---|---:|---|---:|---|
| Análisis filosófico de las ideologías y su presencia en México | 1968 | Alberto Rafael Durán Ruezga | 0 | Sin candidatos inspeccionados; el título de la metadata de origen termina en `ºº`; revisar, no corregir automáticamente |
| Concepto del hombre en el joven Marx | 1978 | Silvia Graciela Moreno López | 1 | SYS 000220110 corresponde a **Polvo de tormenta**, título distinto; consulta T2CQ sufrió además candidate overflow |
| Fidel Castro y su posición respecto al análisis del fenómeno religioso, comparación teórico filosófica con Marx, Engels y Lenin | 1989 | Francisco Salinas Paz | 5 | Cinco títulos distintos del original, relacionados con pobreza, liberación, política y epistemología |
| El significado del significante «bueno» en la obra Ética de la liberación en la edad de la globalización y la exlusión de Enrique Dussel | 1999 | Francisco Guizar Vazquez, Jr. | 0 | Sin candidatos; conservar el original y marcar posible error `EXLUSIÓN` sólo para cotejo editorial |
| Análisis de la concepción epistemológica de Thomas Hobbes | 2009 | Juve Octavio Prieto Mendoza | 1 | SYS 000570466 corresponde a otra obra, sobre planificación didáctica |
| Alexander von Humboldt: un ensayo sobre la antropología filosófica de lo mexicano | 2015 | Ammielmisraim García Diosdado | 0 | Desbordamiento de búsqueda; corroborar espaciado del nombre `AMMIELMISRAIM` con fuente institucional |
| Filosofía de la pseudociencia. Conceptos fundamentales y problemática de una rama emergente de la epistemología | 2025 | Daniel Galarza Santiago | 0 | Tres fichas recuperadas de otros autores, no equivalentes |
| ¿El Estado que propone Platón en la República es una utopía? | sin año | Adriel Manuel Hernández Guzmán | 0 | Tres obras colectivas con su nombre en una lista de colaboradores, no autor principal equivalente |

### Cinco títulos observados para Francisco Salinas Paz

Se conservan los números SYS para revisar registros, **no para
atribuirles la tesis de 1989**:

| SYS Aleph | Título observado |
|---|---|
| `000463678` | *Anatomía de la pobreza en Guadalajara* |
| `000507202` | *Hacia una genealogía y arqueología de la liberación* |
| `000568989` | *Saber del otro: una epistemología de la liberación* |
| `000569016` | *Prácticas políticas de estado, representación y violencia* |
| `000569098` | *Epistemo-grafía de la liberación, saber otro y prácticas de liberación: la experiencia del tiempo* |

Otras fichas listaban nombres de colaboradores (por ejemplo
`Estudios filosóficos` o `200 años con Marx`), pero no constituyen
coincidencia de identidad exacta por título y autor.

## Precisión sobre «siete»

Los números expresan **hits** de registro, no tesis comprobadas ni
siete personas distintas. Una misma obra de origen puede generar
varias coincidencias de autor con otros libros. El agregador
`scripts/thesis/summarize_aleph_author_clusters_t2cr.py` recibe los
artifacts `thesis-philosophy-aleph-discrepancy-review-v1`,
deduplica números SYS por tesis fuente, agrupa las coincidencias
por registro de origen y expone métricas separadas de fuentes y hits.
Falla ante duplicados, información promovida a identidad o cambios de
política `referenceOnly`. No altera T2CQ, T2CL, ni el corpus V2.

## Próximas verificaciones con las fuentes

1. Recuperar en el catálogo original CUCSH la ficha correspondiente a
   cada título. Anotar ruta o identificador persistente y fecha de
   consulta, verificando autor, año, programa y director cuando exista.
2. Consultar registro completo Aleph por SYS de los siete candidatos y
   distinguir publicación posterior, capítulo y obra colectiva.
3. Investigar acervo general de la Biblioteca Central Dr. Manuel
   Rodríguez Lapuente en La Normal y fondos conservados en CUCSH Belenes;
   solicitar **referencia/cota/colección** y no archivo PDF de tesis.
4. Mantener `unresolved` cuando sólo hay coincidencia de nombre,
   tema o año, o cuando Aleph devuelve sus primeras 10 fichas.
5. Examinar errores tipográficos del catálogo de origen sin modificar el
   texto institucional hasta contar con segunda fuente.

### Fuentes y localización

- [Catalogo físico SiUBiUDG](https://bibliotecas.udg.mx/catalogos-en-linea):
  localiza recursos físicos, no prueba exhaustividad de todas las tesis.
- [Biblioteca Central Dr. Manuel Rodríguez Lapuente](https://bibliotecas.udg.mx/Red-de-Bibliotecas/Centros-Universitarios-Tematicos/CUCSH/Biblioteca-Central-Dr-Manuel-RodrIguez-Lapuente):
  Guanajuato 1045, edificio B, colonia La Normal. Contacto institucional
  publicado: `rodolfog@csh.udg.mx`.
- [Traslado parcial de acervos a Belenes](https://www.cucsh.udg.mx/noticias/parte-del-acervo-de-la-biblioteca-manuel-rodriguez-lapuente-se-traslada-cucsh-belenes):
  el primer traslado de cinco colecciones no equivale a traslado de
  todas las tesis ni permite inferir ubicación de un ejemplar concreto.

**Estado:** revisión de metadatos completada para ocho referencias;
ninguna nueva tesis ni ubicación adjudicada. No se ha enviado una
solicitud a la biblioteca en nombre del usuario.
