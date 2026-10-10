# Semantic presentation API integration v1

This contract connects the validated presentation transform to the semantic
API behind two independent opt-ins. It does not enable the feature publicly.

## Enablement boundary

- The server capability defaults off through
  `ENABLE_PRESENTATION_HYGIENE=false`.
- The request must also send `enable_presentation_hygiene=true`.
- A request cannot enable a server-disabled capability.
- An omitted or false request flag leaves `results` unchanged.

The health response advertises server availability. Each search response
reports whether presentation was requested, available, effectively enabled,
applied, or replaced by the safe fallback.

## Transformation boundary

Presentation runs only after retrieval and optional reranking have completed.
It receives exactly the returned result window: it does not overfetch, rebuild
candidates, rerank, blend scores, tune thresholds, or call a model.

When enabled:

- HTML cleanup and missing-title fallback live only under `display`;
- only exact DOI or exact normalized title + year + abstract may collapse;
- probable identity never collapses;
- the first source result remains the representative;
- representative order and scores remain unchanged;
- every member ID, source rank, and score remains under provenance;
- the returned result count may be smaller than the requested limit when an
  exact group collapses.

## Failure and compatibility boundary

If the optional presentation transform rejects malformed source results, the
API returns the original result list and marks `fallback=true`. Retrieval
errors keep their existing HTTP behavior so the public frontend can exercise
its existing federated fallback.

Default-off behavior must preserve the existing result objects exactly. The
response adds status metadata but does not rewrite the default result list.

## Validation gate

Before any deployment:

1. unit tests must cover both opt-ins, default-off identity, exact collapse,
   probable non-collapse, provenance, score/order preservation, and safe
   fallback;
2. the complete Python suite must pass;
3. a bounded local API smoke must show the feature off by default and applied
   only when both gates are true;
4. no production daemon, frontend, retrieval code, `src/core/rank.js`, or
   frozen experiment may change.

## Frozen implementation and local smoke

The double-gated API integration and its smoke runner were frozen in
`30722c151b9fd8e204d70d3e8b6a886004547d54`. The complete Python suite passed
53/53 tests.

The bounded local smoke used index build `20261009T135455Z` with 451,823
documents and the frozen Quine query. It made two requests over the same
Top-10 source window:

- default-off returned the ten original result objects with no presentation
  fields;
- explicit double opt-in returned nine representatives after collapsing one
  exact pair;
- the collapsed pair preserved IDs `openalex-W2211243423` and
  `openalex-W7069018285`, source ranks, and all component scores;
- flattening provenance reproduced the ten original IDs in their original
  order;
- reranking and presentation fallback remained unused.

Independent validation reproduced the ID and score mappings. Frozen hashes:

- `responses.json`:
  `e0bb3e22819e55ceb7321cbc04206d500275861abcab9a50fb020af1eb2b560d`
- `summary.json`:
  `50b58d83050a12a50bb47f1f7173c3c706b6d3dfe027059b3472b927b542ee39`
- `run.log`:
  `7b69c2fc3631ff9b8d1ed60d823d97ea7fc71c70e4428a2a943e15fa91d840ff`

The later operational decision is documented in
`SEMANTIC_PRESENTATION_PUBLIC_DEPLOYMENT_V1.md`. The public daemon now exposes
the capability and the production semantic-search client explicitly requests
it; the server default in code remains false and double opt-in remains
mandatory.
