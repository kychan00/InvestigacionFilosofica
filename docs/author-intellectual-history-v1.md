# Historia intelectual documentada — piloto V1
Se incorpora un archivo de hitos independiente de la cronología bibliográfica (colapsado al inicio, tres hitos por expansión). No cambia el recuento de obras, su orden ni su apertura. Los hitos se muestran únicamente cuando una identidad resuelta trae QID y nombre concordante con la autoridad revisada. No se intenta resolver homónimos mediante nombre, ni se agregan peticiones en tiempo real, ni se modifica el corpus propio de OpenAlex Philosophy.

## Cobertura
Seis autores, 32 hitos: Platón, Aristóteles, Kant, Hegel, Sor Juana y Dussel. No es una biografía exhaustiva. Los hitos pueden aparecer aun si no hay obras, siempre que se abra una ficha con identidad concordante. No se promete cobertura de autores sin QID. No se incorporan fechas de composición conjeturales de los diálogos. La Academia se presenta como un intervalo aproximado y el nacimiento de Sor Juana como dos alternativas discutidas. La Respuesta a Sor Filotea se identifica como redacción, no como edición original. Cada hito mantiene su fuente académica o institucional. Resúmenes redactados para el proyecto.

## Fuentes
- plato: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/plato/
- academy: Internet Encyclopedia of Philosophy — https://iep.utm.edu/plato-academy/
- aristotle: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/aristotle/#AriLif
- kant: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/kant/#LifWor
- hegel: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/hegel/
- sor: Biblioteca Nacional de España — https://www.bne.es/es/autores/juana-ines-cruz-sor
- sorDates: Biblioteca Virtual Miguel de Cervantes — https://www.cervantesvirtual.com/obras/autor/juana-ines-de-la-cruz-sor-1651-1695-61
- sorGov: Secretaría de Gobernación de México — https://www.gob.mx/segob/articulos/conoce-mas-acerca-de-sor-juana-ines-de-la-cruz?idiom=es
- dussel: Portal de Archivos Españoles — https://pares.cultura.gob.es/ParesBusquedas20/catalogo/autoridad/255594
- dusselUNAM: UNAM Global — https://unamglobal.unam.mx/global_revista/fallece-el-filosofo-enrique-dussel/

## Verificación
Pruebas unitarias de identidad, orden, incertidumbre y procedencia. Smoke de expansión 3/6/7, colapso, aislamiento del catálogo, temas y resoluciones 320/375/390/768/1280 en claro y oscuro. Sin nuevas dependencias, imágenes ni llamadas de red automáticas.

## Fase 2 — ampliación curada
Se agregan seis autoridades y 48 hitos (80 en total): Descartes, Nietzsche, Beauvoir, Arendt, Vasconcelos y Zea. Se aceptan únicamente identificadores QID o URI canónica de Wikidata con alias explícito concordante. Si displayName existe, un name alternativo no puede anular un desacuerdo. No se resuelven identidades por nombre solo. Se conserva la incertidumbre en La Flèche (1606 o 1607), la publicación por partes de Zaratustra y la publicación póstuma de La vida del espíritu. Las fechas de rectorías y cargos se muestran como intervalos. Los años de la historia intelectual no se mezclan con los registros bibliográficos.

Autoridades comprobadas: https://www.wikidata.org/wiki/Q9191, https://www.wikidata.org/wiki/Q9358, https://www.wikidata.org/wiki/Q7197, https://www.wikidata.org/wiki/Q60025, https://www.wikidata.org/wiki/Q1091141, https://www.wikidata.org/wiki/Q1879022.

- descartes: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/descartes/
- nietzsche: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/nietzsche/
- beauvoir: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/beauvoir/
- arendt: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/arendt/
- vasconcelos: El Colegio Nacional — https://colnal.mx/integrantes/jose-vasconcelos/
- zea: Enciclopedia Histórica y Biográfica de la Universidad de Guadalajara — https://enciclopedia.udg.mx/biografias/zea-aguilar-leopoldo
- zeaUNAM: Archivo y Taller de Historia Oral, UNAM — https://sites.google.com/filos.unam.mx/athoffyl/el-archivo/colecciones/memoria-institucional/leopoldo-zea
- zeaElem: Enciclopedia de la Literatura en México — https://www.elem.mx/autor/datos/4322

Se separa el lote de datos de la lógica del renderizado; pruebas de alias, fuentes, orden y publicación póstuma, más smoke de Zea y Arendt. La cobertura sigue siendo una selección, no una biografía exhaustiva. No se añaden llamadas externas automáticas.

## Fase 3 — diversidad histórica y geográfica
Se incorporan seis autoridades y 36 hitos (116 acumulados): Epicuro, Tomás de Aquino, Confucio, Frege, Russell y Mariátegui. Se emplean fechas tradicionales explícitas para Confucio y se distinguen los testimonios atribuidos al Comentario de Zuo de hechos incontrovertibles. No se fecha la composición de las Analectas. La cronología china conserva una banda antigua y luego siglos neutrales, sin trasladar las categorías de Renacimiento o Edad Media europea. La Summa theologiae se etiqueta como redacción inconclusa según la cronología de la fuente elegida. Se evita asignar acontecimientos del pensador peruano al homónimo Q6291218. La identidad regional china se aplica al dossier únicamente con autoridad y nombre concordantes.

Fuentes y autoridades de esta fase:
- epicurus: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/epicurus/
- aquinas: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/aquinas/
- confucius: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/confucius/
- frege: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/frege/
- russell: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/russell/
- mariategui: Museo José Carlos Mariátegui · Ministerio de Cultura del Perú — https://mariategui.cultura.pe/index.php/biografia
- https://www.wikidata.org/wiki/Q43216
- https://www.wikidata.org/wiki/Q9438
- https://www.wikidata.org/wiki/Q4604
- https://www.wikidata.org/wiki/Q60028
- https://www.wikidata.org/wiki/Q33760
- https://www.wikidata.org/wiki/Q335544

Validación: pruebas de seis identidades, alias, orden, tipos, fuentes, homónimo y periodización; smoke de escritura china, expansión y geometría. La revisión del lote no sustituye futuras revisiones historiográficas. No se añade ninguna llamada de red en tiempo de ejecución.
