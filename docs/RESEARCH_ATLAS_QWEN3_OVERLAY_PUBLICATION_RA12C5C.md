# RA12-C5-C â€” PublicaciÃ³n inmutable del overlay Qwen federado y prueba desde GitHub Pages

**Fase:** RA12-C5-C.  
**Base:** RA12-C5-B fusionado en `main` mediante PR #225.  
**Estado del producto:** experimental, fail-closed, sin `semantic-neighbor`, sin cambio de ranking/SearchResponse/UI y con RA11 preservado.

## Objetivo

Publicar **exactamente** el overlay Qwen generado por RA12-C5-B, fijar un commit OID inmutable de Hugging Face y demostrar desde el origen real `https://kychan00.github.io` que el navegador puede recuperar vectores individuales con HTTP 206, verificar sus SHA-256 y calcular cosenos documentales tanto overlayâ†”overlay como V4â†”overlay.

Esta fase **no vuelve a ejecutar Qwen para crear el release**. Tampoco repite la bÃºsqueda federada. Las fuentes encontraron las obras en C5-B; Qwen ya representÃ³ esas obras; C5-C sÃ³lo hace persistente y verificable esa representaciÃ³n.

## Fuente congelada

El Ãºnico artifact autorizado es:

- workflow C5-B: `42560032286`
- job: `128974206664`
- artifact: `13649068736`
- nombre: `research-atlas-ra12c5b-qwen-overlay-candidate`
- ZIP: `225,092` bytes
- SHA-256 ZIP: `9138b16de3e5367a9553a6af4a39f2e73ead808c337dc198b73e62cb6828199f`
- manifest SHA-256: `e76848f2876370b9682d8b906b8704371a331cd0ff2cae4a9fe0bb11a4216166`
- vectores: `88596081fb50f6dd4a47cbca24b711982a4beca3ed991555588b71ddc4abe89f`
- digests: `1c9a1bb51ef6162d96468f9b990a62a9fae31370140d5d705c1aeefda4f5d491`
- Ã­ndice: `8e2d1dc520c3c8f4d8bc85ec402ae6ec900e6cd3220a90f710debd3987c3bc90`
- metadata: `93ad389844a400f25091e53d7d8ad0d3cf9726f9450e7e61184b5631ce2eacb9`

El workflow rechaza cualquier ZIP con otro tamaÃ±o o SHA. Un rerun posterior de C5-B puede servir como regresiÃ³n, pero **no sustituye** esta fuente.

## Preflight

`prepare_ra12c5c_overlay_publication.py` vuelve a verificar:

- inventario exacto del ZIP y ausencia de rutas inseguras/symlinks;
- manifest original `built-unpublished` y `productionEnabled=false`;
- 207 identidades y 1024 dimensiones;
- modelo/revisiÃ³n Qwen histÃ³ricos;
- SHA y tamaÃ±o de vectors/digests/index/metadata;
- los 207 SHA individuales recomputados directamente desde cada slice de 1,024 bytes;
- ordinal/identidad entre Ã­ndice y metadata;
- 204 SHA de vector Ãºnicos y 3 repeticiones ya explicadas por texto idÃ©ntico;
- auditorÃ­a independiente C5-B `pass`;
- cero cuerpos de `abstract`, `documentText`, full text o PDF en metadata publicable.

Los seis archivos originales publicados (`manifest`, vectors, digests, Ã­ndice, metadata y auditorÃ­a de compatibilidad) se copian **byte por byte sin modificaciÃ³n**. SÃ³lo se derivan tres archivos pequeÃ±os: `identity-lookup.json`, `browser-reference.json` y `release-provenance.json`.

## PublicaciÃ³n manual protegida

El PR nunca escribe en Hugging Face. Tras fusionar C5-C, zXÛÜšÙ›İÈÙHZ™Xİ]HX[X[Y[HÛÛˆHœ˜\ÙH^XİN‚‚˜^”P“PĞT—ÔLLÍP×ÓÕ‘T“VB˜‚‘[ÙXÜ™]—ÕÒÑS˜\›X[™XÙH0î›šXØ[Y[H[ˆÚ]XˆXİ[ÛœË‚‚•\™Ù]‚‚˜^Üš\İX[”[^[ËÛÜ[˜[^\[ÜÛÜB‹Ü™\ÙX\˜ÚX]\ËÜ]Ù[ŒË\Ù[X[XË[İ™\›^KİŒKÜ˜LL˜ÍX‹\[MŒÌŒ‹Â˜‚‘[X›\Ú\ˆ˜[HÚH[™YšZ›ÈXH^\İKˆ\Üpê\È[\ØY^YÙH[ˆÒQH^\İH[\™XİÜš[È˜Z›È\ÙHÒQY[™HH\ØØ\™Ø\ˆ
Š˜ØYH\˜Ú]›ÊŠˆHÛÛ\\˜HÒKLM‹ˆ›ÈÙHÛÛœÚY\˜HX›XØYÈÜˆ[Y\›ÈXÚÈH]YH\ØYÙ›Û\˜^XH™YÜ™\ØYÈÛÜœ™Xİ[Y[K‚‚ˆÈÈYX˜H™X[\ÙHÚ]XˆYÙ\Â‚‘\Üpê\ÈHHX›XØXÚpìÛ‹Ú›ÛZ][HXœ™HH0èYÚ[˜H0î˜›XØH™X[HZ™Xİ]HğìÛÈÜÈpìÙ[ÜÈ^\š[Y[[\È[™\ÜÚ]Üš[Ëˆ\˜HØYH]Y\İ˜H[İ™\›^N‚‚ŒKˆ\ØØ\™ØHX[šY™\İšœÛÛ˜H™\šYšXØHİHÒHšZ˜YÎÂŒ‹ˆ\ØØ\™ØHH™\šYšXØH[0ë[™XÙHÛÛ\š[ZYÈÜšYÚ[˜[ÂŒËˆ\ØØ\™ØHH™\šYšXØH[\œ™YÛÈÛÛ\]ÈHYÙ\İÈ
‹Œ]\ÊNÂˆ\ØØ\™ØHH™\šYšXØH[ÛÚİ\\š]˜YÎÂKˆYØHY[YY8¡¤ˆÜ™[˜[8¡¤ˆYÙ\İHÌˆ]\ÎÂ‹ˆÛÛXÚ]H™XİÜœËšNÛÛˆ˜[™ÙX\˜H^Xİ[Y[HK]\ÎÂËˆ^YÙH
Š’ŒŠŠ‹ÛÛ[T˜[™ÙX^XİÈHİY\œÈH^Xİ[Y[HK]\ÎÂˆ™XÛÛ\]HÒKLMˆ[ÛXÙHH^YÙHYİX[YÛÛˆ[YÙ\İ]][XØYË‚‚•[ˆŒ˜[™ÛÈ[˜ÛÜœ™XİËÒHY™\™[K›ÙHÛÜËÛ\™ÛËÓÔ”ËÛ™]ÛÜšÈ\œ›ÜˆÈÛÛ˜]È[°è[YÈ›Ü]YXHHØ\XÚYYˆ[˜ØHÙHXÙ\H\ØØ\™Ø\ˆÚ[[˜Ú[ÜØ[Y[H[\˜Ú]›È™XİÜšX[ÛÛ\]Ë‚‚ˆÈÈÛÜÙ[›ÜÂ‚”ÙH™\šYšXØ[ˆ™\È\™\Èİ™\›^x¡¥İ™\›^HÛÛ˜H™Y™\™[˜ÚX\ÈØ[İ[Y\È\™Xİ[Y[H[\Y˜XİÛÛ™Ù[YËˆY[pè\ÈÙH™Xİ\\˜[ˆÜÈ™XİÜ™\ÈYYX[HHØY[˜HÜš\ÙÜ°èYšXØHLL‹PÌÈXHX›XØYN‚‚‹HYÙ\İX›XØ][ÛˆÒQˆXMLM˜ÍXLÌLN™˜ÙXNÍXYXLMYNMÍXŒLX‹HYÙ\İ›ÛİÒNˆÎØNÍ™MYLØX™MXÍÍÌXŒNÙ™MÌLLNMÌ™MÌ˜ÙMØÍLMŒX‹H[ˆ™X[HX›XØXÚpìÛ‹Øœ›İÜÙ\ˆØ]NˆLÌŒLØ‚”ğìÛÈ\Üpê\ÈH]][XØ\ˆ[™\[™Y[[Y[H[X›ÜÈYÜÈÙHØ[İ[[ˆÜÈÛÜÙ[›ÜÈ8¡¥İ™\›^Kˆ\ÛÜÈ˜[Ü™\ÈÚYÛšYšXØ[ˆ
Šœ›Ş[ZYY™\™\Ù[XÚ[Û˜[
Š‹›ÈÚ]K[™›Y[˜ÚXK™\ÜY\İKY[YY\ØİY[HšH\[™[˜ÚXK‚‚ˆÈÈÈ]YHÍKPÈ›ÈXÙB‚‹H›È]]HÂ‹H›ÈY]HØœ˜\È^\›˜\È[›ÈHÂ‹H›È\ØØ\™ØH[[Ù[È]Ù[ˆ[ˆ[˜]™YØYÜÂ‹H›È\ØHRTÔÈ[ˆ[˜]™YØYÜÂ‹H›È[XH\K›Ü[˜[^›Ü™Ø\ÙH[˜]™YØYÜÂ‹H›ÈÜ™XH[˜HÙYİ[™H°îœÜ]YYNÂ‹H›ÈØ[XšXHÙX\˜Ú™\ÜÛœÙXšH˜[šÚ[™ÎÂ‹H›È\Ú[Û˜HY[YY\ÈÜˆÚ[Z[]Yİ™XİÜÂ‹H›ÈXš[]HÙ[X[XË[™ZYÚ›Ü˜Â‹H›È[[Z[˜HLLK‚‚ˆÈÈ›Ü]YXYÜˆ[™\[™Y[HÙ]°ëXHXšY\ÎˆLL‹PŒÂ‚“HX›XØXÚpìÛˆ[ÛÚİ\Øİ[Y[[HLL‹PŒÈÚYİYHÚY[™È[˜HØ›YØXÚpìÛˆÙ\\˜YH[\ÈHİX[]ZY\ˆ›Ûİ]Ù[pè[XÛÈÙ[™\˜[ˆÍKPÈYYH[[Üİ˜\ˆ˜[œÜÜHHÛÜÙ[›È[İ™\›^HÚ[ˆ\ÙHÛÚİ\Üœ]YH\ØH]Y\İ˜\È^0ëXÚ]\ÎÈ
Š™\ÛÈ›È]]Üš^˜HØ[\œÙHŒÊŠˆ\˜H™\ÛÛ™\ˆÛÜšÒQ8¡¤™XİÜˆ[ˆ›ÙXØÚpìÛ‹‚‚ˆÈÈØ]HHØ[YB‚ÍKPÈğìÛÈ\ØHİX[™È^\İH]šY[˜ÚXHN‚‚‹H\Y˜XİÜšYÚ[˜[^XİÈH™]˜[YYÎÂ‹HX›XØXÚpìÛˆˆÛÛˆÒQ[›]]X›NÂ‹HÒH™[[İÈHÙÜÈÜÈ\˜Ú]›ÜÎÂ‹Hœ›İÜÙ\ˆ™X[\ÙHÚ]XˆYÙ\ÎÂ‹H˜[™ÙHŒˆHÛÛ[T˜[™ÙH^XİÈ\˜Hİ™\›^NÂ‹HÒH[™]šYX[HØYH™XİÜˆ]Y\İ™XYÎÂ‹HÛÜÙ[›Èİ™\›^x¡¥İ™\›^HÛÛˆ\šYYÙ™›[™NÂ‹HÛÜÙ[›È8¡¥İ™\›^H\Ø[™ÈÜÈ™XİÜ™\È]][XØYÜÎÂ‹H]\Ô[[YQ[˜X›YY˜[ÙXÙ[X[XÓ™ZYÚ›Ü‘[˜X›YY˜[ÙXHLLH[XİË‚‚“H˜\ÙHÜİ\š[ÜˆÙ°èH[X\ˆ[ˆ™\ÛÛ™YÜˆÛÛXš[˜YËˆX›XØ\ˆÍKPÈ
Š››ÊŠˆXİ]˜HÜˆğëHZ\Û[Èš[™İ[˜H\š\İHÙ[pè[XØK‚