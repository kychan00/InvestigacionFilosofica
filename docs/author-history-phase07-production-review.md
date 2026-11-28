# Fase 07A–07B · Recuperación contextual de historia intelectual

Seis PDF de producción facilitados por el usuario: Arendt (9 hitos), Caso (10), Russell (8) visibles; Avicena (5), Sor Juana (5) y Nāgārjuna (2) ausentes. Los PDF también muestran resultados potencialmente homónimos, roles dudosos y años sospechosos. No contienen payloads de proveedor, identificadores completos o confirmación de que cada fuente desplegable se abrió.

Este PR añade familias de títulos explícitas, no reglas de similitud genéricas. Cada familia cuenta una vez; se exigen dos familias con nombre de creador compatible. Las atribuciones tradicionales son indicios contextuales, no certificación de autoría. Se conserva la protección existente de QID, ORCID, roles e IDs incompatibles. Un VIAF no cotejado no habilita las variantes nuevas. Los autores identificados por las variantes reciben una nota contextual y enlaces a los catálogos de contraste.

## Fuentes de títulos
- Q8011: [Biblioteca Virtual Miguel de Cervantes · Avicena](https://www.cervantesvirtual.com/portales/academia_mexicana_de_la_lengua/obras/autor/avicena-15971/2); [Biblioteca Virtual Miguel de Cervantes · De anima](https://www.cervantesvirtual.com/obra/de-anima-latine/)
- Q183074: [Biblioteca Virtual Miguel de Cervantes · teatro de Sor Juana](https://www.cervantesvirtual.com/obras/autor/juana-ines-de-la-cruz-sor-1651-1695-61/?fmateria=teatro-mexicano-193&orden=TITULO&q=); [Biblioteca Virtual Miguel de Cervantes · loa al Divino Narciso](https://www.cervantesvirtual.com/portales/academia_mexicana_de_la_lengua/obra/el-divino-narciso-loa-y-auto-sacramental-02-loa-al-divino-narciso-vv-200-225/)
- Q171195: [Stanford Encyclopedia of Philosophy · Nāgārjuna](https://plato.stanford.edu/archives/spr2020/entries/nagarjuna/); [Penn Libraries · Nāgārjuna’s Middle Way](https://find.library.upenn.edu/catalog/9959651973503681)

Avicena: De anima latine y De corde son familias distintas del Canon; Prima primi canonis pertenece al Canon. Sor Juana: la loa y el auto sacramental se agrupan conservadoramente como una sola familia, mientras que Los empeños y la Respuesta son otras. Nāgārjuna: Middle Way se agrupa con Mūlamadhyamakakārikā; Suhṛllekha es una atribución tradicional distinta, no un nuevo hito canónico. No se usa Madhyamakavrttih como obra independiente ni se usa poesía moderna como evidencia.

## Alcance y coordinación
PR #404 Author Authority Graph V2 permanece experimental y separado; esta adaptación es solo de lectura contextual en la cronología, no modifica decisiones V1/V2, metadatos, corpus, índices ni retratos. No realiza solicitudes nuevas a OpenAlex ni usa API externa. No cambia los 199 hitos. Las obras ajenas y fechas dudosas permanecen como trabajo pendiente de 07C/07D; no se ocultan registros por tema o fecha. Los fixtures reconstruyen los títulos visibles del PDF, no reproducen todavía la resolución real de proveedores. Validación CI y prueba manual tras despliegue pendientes.
