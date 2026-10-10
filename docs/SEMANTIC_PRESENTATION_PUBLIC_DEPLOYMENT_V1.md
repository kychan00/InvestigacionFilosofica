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

## Rollback

Remove `ENABLE_PRESENTATION_HYGIENE` from the installed semantic API
LaunchAgent and restart it. The frontend may continue sending the request flag:
the server capability boundary will leave results unchanged.
