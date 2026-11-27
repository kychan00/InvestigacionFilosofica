# SIVA · Sistema de Identidad Visual de Autores — V1

## Contrato

Solo el expediente principal de autor, no resultados generales ni otras rutas. Separa identidad bibliográfica, resolución de retrato, política de licencia, sesión de memoria y presentación. ORCID (P496) y OpenAlex (P10283) identifican al autor; Wikidata P18 identifica el archivo; Commons imageinfo proporciona miniatura y licencia. ORCID no suministra fotos. No se consulta por nombre ni se raspan perfiles institucionales. Las búsquedas por identificador deben devolver un único candidato humano y sus declaraciones deben coincidir exactamente; se rechazan conflictos. Los tres filósofos históricos revisados (Q9312, Q9235, Q913) pueden usar el QID existente y la forma canónica exacta del nombre del corpus si no existen identificadores contradictorios; no se asigna un QID a partir del nombre. No hay inferencia visual ni coincidencia facial. Ampliar esta excepción únicamente con revisión documental y preferentemente IDs del corpus.

## Rendimiento y ciclo de vida

Una sesión por expediente, reutilizada durante los renderizados de obras. Máximo 480 px por lado, 256 KiB transferidos (objetivo normal menor), tipos JPEG/PNG/WebP, 7 s de presupuesto total. Solicitudes anónimas sin cookies ni referrer, no-store; se usan IDs públicos, no cuenta ni consultas del usuario. Imagen mediante Blob URL; al cambiar de autor, salir del expediente o pagehide, abortar solicitudes, limpiar DOM y revocar URL. No se usan localStorage/IndexedDB/Cache Storage. El navegador controla sus cachés internas; no se promete borrarlas. BFCache vuelve a abrir el expediente si corresponde. Si API, CORS, licencia, identidad, tamaño o decodificación fallan, se conservan iniciales sin bloquear bibliografía. El usuario debe conocer que hay consultas externas públicas a Wikimedia; no se usa Firebase ni se añade analítica.

## Fuentes y expansión

V1: Wikidata + Commons, con ORCID/OpenAlex como claves. Adaptadores futuros: Europeana, archivos y universidades únicamente si su API permite comprobar derechos, autoría y coincidencia estable; no se activan por defecto. Un catálogo central de metadatos curados y contribuciones manuales se deja para fase posterior, sin almacenar retratos en los dispositivos. Política de medios en LICENSES/SIVA-PORTRAITS.md; MIT del software permanece intacta.

## Validación

Pruebas unitarias deterministas de homónimos, licencias, metadatos, límites y cancelación; smoke Playwright con respuestas simuladas, temas y dispositivos, cierre y cambio de autor. La prueba externa de disponibilidad real de Commons/CORS y dispositivos físicos debe distinguirse de la simulación. Documentación de APIs: https://www.wikidata.org/wiki/Wikidata:Data_access y https://www.mediawiki.org/wiki/API:Imageinfo.

### Refinamiento de memoria

La URL Blob provisional se revoca inmediatamente al cerrar o vencer el presupuesto, incluso si la decodificación no ha terminado. Una consulta agotada no se vuelve a lanzar por los renderizados repetidos del mismo expediente; se permite otra búsqueda al reabrirlo. La consulta exacta P10283 utiliza la forma minúscula habitual de Wikidata.
