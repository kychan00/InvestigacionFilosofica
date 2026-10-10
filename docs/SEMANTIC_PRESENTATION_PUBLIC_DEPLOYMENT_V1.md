# Semantic presentation public deployment v1

This operational change enables the already validated presentation transform
for public semantic requests. It does not change retrieval, ranking, the
reranker boundary, the traditional frontend default, or `src/core/rank.js`.

## Deployment contract

- The public LaunchAgent sets `ENABLE_PRESENTATION_HYGIENE=true`.
- The API still applies the transform only when the request also sends
  `enable_presentation_hygiene=true`.
- Requests that omit or disable the flag keep their original result objects.
- The public browser requests the transform only on its explicit
  `Semántica · alfa` path.
- The browser uses `display.title` and `display.abstract`, preserves all exact
  member IDs in `sourceRecords`, and discloses exact grouping in the card.
- Probable identity remains uncollapsed.
- A presentation failure returns the source list and marks API fallback; the
  existing semantic-to-federated fallback remains unchanged for API failures.

## Required public smoke

After restarting the daemon, one bounded smoke makes exactly two search calls
over the same frozen Quine Top-10 window:

1. request flag omitted: ten unchanged source results;
2. request flag true: nine representatives after the known exact pair
   collapses.

The smoke must verify health capability, default-off behavior, exact group
membership, flattened source order, score preservation, display fields,
reranker disablement and absence of presentation fallback. Outputs are
JSON/logs under
`benchmark/semantic-retrieval/public-presentation-smoke-v1/`.

## Frozen backend deployment result

The LaunchAgent capability was enabled and the daemon restarted on
2026-10-10. The frozen runner commit `43268b1` then executed its two public
searches exactly once.

The smoke passed:

- health advertised 451,823 documents, reranker unavailable and presentation
  hygiene available;
- the omitted request flag returned ten source results unchanged;
- the explicit request flag returned nine representatives;
- only `openalex-W2211243423` and `openalex-W7069018285` collapsed;
- flattened provenance reproduced the ten IDs and all component scores in
  source order;
- presentation fallback was not exercised.

Frozen hashes:

- `health.json`: `21db7fe6012066f4801914c5bac46e4e84f0f69fc70e0e3ec7b413baf77296a8`;
- `responses.json`: `1e6b108f78e12bc4fe0cc3d6a36008f365a4843f9a7618c501f70ccd95be749f`;
- `summary.json`: `f2a0ada68e78cea9af5f9dcfed66a38ea06d77de5d9e10848964be7646fe1a9b`;
- `run.log`: `fba4446ef5d01f0d40350efc09d2acd0716ff09e172a7a7aaa6cd70cb51dae61`.

## Frontend deployment result

The production client change was merged through PR 14 as
`02f445ba1e7f4ddd4a0c54ae37ca01e9b0c7e3db`. It:

- sends `enable_presentation_hygiene: true` only on the explicit semantic path;
- reads sanitized `display` fields;
- retains all exact-group member IDs and scores in normalized provenance;
- labels exact groups as equivalent records without calling them probable
  duplicates;
- leaves federated search selected by default and preserves its existing
  automatic fallback.

The frontend suite passed 75/75 tests. GitHub Pages workflow `38054638384`
passed both test and deploy jobs. Public asset inspection confirmed the request
flag, display/provenance normalization and exact-group disclosure. No extra
search inference was required for this verification.

## Rollback

Remove `ENABLE_PRESENTATION_HYGIENE` from the installed semantic API
LaunchAgent and restart it. The frontend may continue sending the request flag:
the server capability boundary will leave results unchanged.
