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

## Fase 4 — tradiciones tardoantigua, islámica, judía e india
Se incorporan seis autoridades y 30 registros (146 acumulados): Agustín de Hipona, Avicena, Averroes, Maimónides, Nāgārjuna y María Zambrano. Los siglos regionales son convenciones de ordenación y no equivalencias entre historias culturales. La fecha interna de los intervalos es un ancla de orden, no una fecha exacta. Avicena tiene dos fuentes para la discrepancia 970/980. Para Nāgārjuna se registra un periodo de actividad y una obra de atribución ampliamente aceptada sin fecha exacta; no se inventan nacimiento, muerte o viajes. El número de hitos puede ser inferior a tres cuando la evidencia es escasa. No se confunden sus homónimos con el pensador budista ni se usa el QID del cráter Avicenna. Se mantiene la distinción entre redacción y edición moderna. Los motivos SVG son originales y decorativos, sin afirmar que representan edificios históricos concretos.

Fuentes consultadas:
- augustine: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/archives/sum2018/entries/augustine/
- avicenna: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/ibn-sina/
- avicennaNatural: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/ibn-sina-natural/
- averroes: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/archives/spr2023/entries/ibn-rushd/
- maimonides: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/entries/maimonides/
- nagarjuna: Stanford Encyclopedia of Philosophy — https://plato.stanford.edu/archives/sum2024/entries/nagarjuna/
- zambrano: Fundación María Zambrano — https://fundacionmariazambrano.org/
- zambranoCVC: Centro Virtual Cervantes — https://cvc.cervantes.es/actcult/zambrano//cronologia/
- zambranoGov: Ministerio de Cultura de España · CIDA — https://www.cultura.gob.es/cultura/areas/archivos/mc/centros/cida/4-difusion-cooperacion/4-1-guias-de-lectura/escritoras/zambrano-maria.html

Autoridades:
- https://www.wikidata.org/wiki/Q8018
- https://www.wikidata.org/wiki/Q8011
- https://www.wikidata.org/wiki/Q39837
- https://www.wikidata.org/wiki/Q127398
- https://www.wikidata.org/wiki/Q171195
- https://www.wikidata.org/wiki/Q235134

Validación: pruebas de alias, homónimos, fuentes múltiples, incertidumbre, orden y geometría para escritura árabe y cobertura escasa. No hay nuevas consultas externas automáticas.

## Fase 5 — México y América Latina
Se incorporan seis autoridades y 53 registros (199 acumulados): Antonio Caso, Samuel Ramos, Luis Villoro, Adolfo Sánchez Vázquez, Bolívar Echeverría y Augusto Salazar Bondy. Los contextos de la historia intelectual curada prevalecen para el dossier latinoamericano frente al gentilicio de una descripción: el nacimiento en España no excluye la trayectoria de Villoro ni Sánchez Vázquez en México. No se afirma que el lugar de nacimiento sea una afiliación intelectual. Se incorpora el tipo «Edición revisada» para distinguir el ensayo de Caso de 1916 de la edición de 1919. Se mantienen años sin inferir días o meses, incluyendo el nacimiento de Ramos y Echeverría, para evitar conflictos de precisión entre fuentes. Los homónimos Alfonso Caso, Juan Villoro y Sebastián Salazar Bondy no reciben hitos de sus parientes. Se conserva la independencia de obras del corpus, sin nuevas llamadas externas.

Fuentes institucionales y editoriales:
- caso: El Colegio Nacional — https://colnal.mx/integrantes/antonio-caso/
- casoAML: Academia Mexicana de la Lengua — https://academia.org.mx/academicos-1946/item/antonio-caso-2
- ramos: El Colegio Nacional — https://colnal.mx/integrantes/samuel-ramos/
- ramosIIF: Instituto de Investigaciones Filosóficas · UNAM — https://www.filosoficas.unam.mx/~bib/ramos.html
- villoro: El Colegio Nacional — https://colnal.mx/integrantes/luis-villoro/
- villoroIIF: Instituto de Investigaciones Filosóficas · UNAM — https://www.filosoficas.unam.mx/sitio/sitio/sitio/sitio/luis-villoro
- sanchez: Secretaría de Cultura · México — https://www.gob.mx/cultura/prensa/adolfo-sanchez-vazquez-filosofo-autocritico-y-antidogmatico
- sanchezPublisher: Siglo XXI Editores — https://sigloxxieditores.com.mx/autor-a/adolfo-sanchez-vazquez/
- sanchezELM: Enciclopedia de la Literatura en México — https://www.elem.mx/autor/datos/109104
- echeverria: Archivo Bolívar Echeverría · UNAM — https://bolivare.unam.mx/trayectoria
- echeverriaBooks: Seminario Universitario de la Modernidad · UNAM — https://seminariomodernidad.unam.mx/index.php/component/content/article/57-modernidad-y-capitalismo-en-bolivar-echeverria?Itemid=101&catid=9
- salazar: Fondo de Cultura Económica — https://www.fcede.es/site/es/fceespa/autoresdetalle.aspx?idAutor=2892
- salazarDoctor: Universidade NOVA de Lisboa · Gerações Hispânicas — https://fabricadesites.fcsh.unl.pt/ghispanicas/2019/05/09/augusto-salazar-bondy/
- salazarBook: Siglo XXI Editores — https://sigloxxieditores.com.mx/libro/existe-una-filosofia-de-nuestra-america-2/

Autoridades:
- https://www.wikidata.org/wiki/Q601364
- https://www.wikidata.org/wiki/Q7412445
- https://www.wikidata.org/wiki/Q2370396
- https://www.wikidata.org/wiki/Q365193
- https://www.wikidata.org/wiki/Q891708
- https://www.wikidata.org/wiki/Q5711746

Validación: pruebas de seis identidades, alias, orden, tipos, fuentes, edición revisada y homónimos; smoke de contexto transatlántico y fuentes múltiples. El archivo no es exhaustivo.

## Fase 6 — puente con el archivo latinoamericano
No se amplía la curaduría por duplicado. El inventario canónico existente (1,504 autores) y sus expedientes conservan sus IDs, obras, contribuciones, fechas y fuentes. Se establece un cruce explícito para los once autores de los lotes previos que ya pertenecen a la matriz. Cada cruce exige ID interno, nombre canónico y concordancia con las fechas de vida del expediente, incluidas alternativas de Sor Juana. Si cambia la identidad o su cronología, el enlace falla de manera segura hasta revisión humana. Los restantes 1,493 expedientes conservan su comportamiento original; no se les atribuyen hitos sin revisión.

- #0019 ↔ Q183074 — Sor Juana Inés de la Cruz (1648 / 1651–1695)
- #0069 ↔ Q335544 — José Carlos Mariátegui (1894–1930)
- #0071 ↔ Q365193 — Adolfo Sánchez Vázquez (1915–2011)
- #0074 ↔ Q891708 — Bolívar Echeverría (1941–2010)
- #0097 ↔ Q1091141 — José Vasconcelos (1882–1959)
- #0098 ↔ Q601364 — Antonio Caso (1883–1946)
- #0099 ↔ Q7412445 — Samuel Ramos (1897–1959)
- #0103 ↔ Q1879022 — Leopoldo Zea (1912–2004)
- #0105 ↔ Q2370396 — Luis Villoro (1922–2014)
- #0110 ↔ Q473518 — Enrique Dussel (1934–2023)
- #0162 ↔ Q5711746 — Augusto Salazar Bondy (1925–1974)

El buscador general enlaza directamente a la ficha existente; el modal del archivo llama al mismo renderer y al mismo modelo de hitos, con estado de expansión propio y paleta editorial independiente del tema del corpus. No se copian obras al archivo biográfico ni se suman sus hitos a las estadísticas bibliográficas. Se agregan pruebas contra los once JSON reales y el inventario, identidades contradictorias, navegación, expansión y geometría. El cruce es parcial; para ampliar cobertura se revisará evidencia de cada expediente, no se aplicará una equivalencia automática por nombre. No se modifica la matriz ni se introduce una consulta remota adicional.

## Fase 7 — proyección conservadora de la matriz
Se reutilizan los expedientes ya cargados, sin copiar registros ni consultar fuentes adicionales. Para los once enlaces curados se conserva el panel común; para los demás se proyecta una cronología del expediente solamente si hay datos fechados y fuentes rastreables. No es una biografía nueva ni una revisión de las fuentes originales. Se preservan fechas alternativas, aproximadas, intervalos, siglos y formatos de vida históricos. Se diferencian publicaciones consignadas, fechas bibliográficas genéricas, tesis, redacción y contribuciones; no se extraen acontecimientos de reediciones ni de contribuciones sin fecha. La responsabilidad intelectual se conserva tal como está codificada en la matriz, y se excluyen estados explícitamente dudosos. Los enlaces directos proceden de evidence_urls; las fuentes generales se indican como tales y permanecen en Fuentes. No se presentan como citas específicas. El panel permanece colapsado, con tres registros por expansión, estética propia y sin modificar recuentos. La cobertura exacta queda registrada por la prueba integral de los 1,504 expedientes; no se presupone cobertura total. Se añaden casos reales de Tlacaélel, Firmin, Dante Ramaglia, Salazar Bondy, Porfirio Miranda y la ficha sin verificación de Jesús A. Díaz.

## Fase 8 — auditoría y correcciones
La primera auditoría integral de CI (commit f310f1f) recorrió 1,504 expedientes: 1,355 proyecciones (11,335 registros fechados), 11 cruces curados, 138 sin proyección. Son resultados preliminares, no una nueva verificación historiográfica individual. El tiempo registrado por la prueba integral fue de 224–322 ms en los runners, incluyendo lecturas de archivos; no mide la carga en navegador. Las ocho verificaciones fallaron por la misma aserción de Salazar Bondy: la matriz registra la tesis de 1953 y su manifestación impresa de 1958 con edition_of_work. La corrección conserva ambos acontecimientos, tipifica la versión como edición de obra previa y expone el vínculo, sin generar entradas desde edition_history. Se mantiene intacto el catálogo. Se amplía la auditoría para contar tipos, evidencia directa/general, causas de exclusión y tiempo de proceso. Se corrige asimismo el smoke del archivo que importaba una URL antigua del módulo y duplicaba su inicialización; ahora reutiliza la URL del script cargado en la página. No se modifica la autorización ni el guardado. Las pruebas móviles aún deben completarse y las capturas revisarse.

## Corrección de integración en producción
Las fichas reales de Beauvoir, Caso y Confucio mostraban solo bibliografía: el modelo requería QID, mientras las rutas local y federada pueden entregar una identidad sin ese campo. Se incorpora corroboración acotada al renderer mediante nombres controlados y al menos dos grupos de títulos vinculados a sus autores; no se modifica la identidad global, no se consulta OpenAlex y no se sustituye ningún identificador explícito. Se cubren inicialmente las tres reproducciones y dos autores piloto adicionales; los casos sin evidencia permanecen sin panel. Se limita el alto de las cabeceras de época en escritorio. Pruebas con entradas sin QID, títulos repetidos, identificadores contradictorios y autorías ajenas. La prueba del renderer no equivale a comprobar el flujo real en producción; pendiente de verificación.
