# RA12-D1 — resolvedor inmutable SearchResponse → ubicación Qwen

RA12-D1 conecta las publicaciones ya verificadas de B3 y C5-C sin activar todavía `semantic-neighbor`.

## Pins inmutables

- B3 lookup: `525900c5e663311b25cc0a42083f241acce2176f`
- B3 target: `research-atlas/qwen3-document-lookup/v1/ra12b2-run42439871082`
- B3 manifest SHA-256: `c2e350fc02819b55a8fa90a11f798f22bb6ed7be87448a6a2591a835b63b6834`
- B3 manifest: 56,568 bytes; 451,823 Work IDs; 256 particiones.
- C5-C overlay: `c74f0067ba665c23b09a0a79fa83651b00c0e53e`
- C5-C identity lookup SHA-256: `8cc87603b049538a1af36aba0b73d3f868f98c136b6832b1a5279896895383c8`
- C5-C identity lookup: 36,503 bytes; 207 identidades.

## Resolución

1. Una identidad OpenAlex explícita se busca sólo en la partición B3 que corresponde al primer byte de `SHA-256(WorkID)`. El manifest completo y la partición se verifican por SHA antes de aceptar la ubicación V4.
2. Los cuatro DOI que C5-A probó por DOI exacto contra OpenAlex se vuelven a contrastar contra B3. La ubicación debe coincidir exactamente con la evidencia C5-A.
3. Si no hay V4, se prueban identidades exactas `openalex:`/`doi:`/provider contra el lookup C5-C autenticado por SHA.
4. Cualquier otra obra queda `unresolved` y conserva RA11 como fallback en una fase posterior.

No se usa similitud de título para declarar identidad. No se consulta `api.openalex.org`. No se descargan vectores ni pesos. No cambia `SearchResponse`, ranking, UI ni el Atlas runtime.

## Resultado de esta fase

D1 entrega solamente una ubicación semántica autenticada:

- `base-direct` → V4 por WorkID;
- `base-alias` → V4 por autoridad DOI exacta C5-A;
- `overlay` → ordinal exacto C5-C;
- `unresolved` → futuro fallback RA11.

La siguiente fase puede consumir estas ubicaciones con clientes de vectores cacheados y crear `semantic-neighbor` sin repetir manifests/índices por cada obra.
