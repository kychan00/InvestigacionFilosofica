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
