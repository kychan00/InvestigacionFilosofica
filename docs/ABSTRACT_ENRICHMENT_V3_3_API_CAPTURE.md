# V3.3 abstract enrichment: frozen API capture contract

**Frozen:** 2026-10-05, before the complete capture

**Source decision:** timestamped OpenAlex API capture

**Target set:** frozen

**V3.3 publication:** blocked pending capture and corpus validation

**Mass embedding build:** blocked

## Prospective amendment

The initial enrichment design preferred an immutable pinned
`Mearman/OpenAlex` snapshot. The source preflight established that recovering
target text from that snapshot would transfer approximately 158 GB because the
abstract Parquet files lack page indexes and target IDs occur in most sampled
row groups. The available local disk is not the limiting resource, but this
near-full remote scan is not operationally appropriate for the current
environment.

Before running the complete backfill, the source contract is prospectively
amended to a timestamped, fully preserved capture of the current OpenAlex API.
This is a provenance change, not a claim that the API is an immutable snapshot.
The frozen raw responses, timestamps, source `updated_date` values, batch
metadata and hashes make the actual input auditable after the live source
changes.

## Frozen target universe

- Base dataset: `CristianPelayo/openalex-philosophy`.
- Base revision: `09c329326ed24ccf986c4b4c47c9794f055516dc`.
- Base artifact: `v3.2/philosophy-corpus-v3-2-full.parquet`.
- Base artifact SHA-256:
  `81f39d5ae5ea192897a7c3cd405b3b0a3494a032658895219c7906e5f34e93c0`.
- Eligibility: `CORE` or `PROBABLE`, excluding `LOW_QUALITY` and `PARATEXT`.
- Target definition: empty whitespace-normalized abstract.
- Target rows: 244,353.
- Unique OpenAlex IDs: 244,353.
- Target order: pinned V3.2 source order.
- Target JSONL SHA-256:
  `5f8b3e278200bd002418c8b0174ee323fbecbf495a25e7d45f21c6df8b2862ab`.

No target may be added, removed, reordered or selected using returned abstract
content.

## Acquisition contract

- Endpoint: `https://api.openalex.org/works`.
- Authentication: API key through `Authorization: Bearer`; never in URL,
  output, logs or Git.
- Batch membership: consecutive groups of at most 100 frozen target IDs.
- Expected batches: 2,444.
- Filter: exact OR over `openalex_id`.
- Selected fields: `id`, `abstract_inverted_index`, `updated_date`.
- Execution: sequential requests with a small fixed delay.
- Retry: bounded exponential backoff only for transport failures, HTTP 429 and
  HTTP 5xx.
- A completed batch is immutable and is never requested again.
- Resume begins at the first absent batch after independently validating every
  completed batch's target fingerprint, raw response hash, normalized hash and
  row order.
- Missing or merged IDs are retained as explicit `found: false` rows; there is
  no alternative-source substitution.

The API account reports a free daily budget of 10,000 list requests. The frozen
2,444 sequential batches fit in one daily budget. Rate headers are preserved
per batch.

## Abstract reconstruction

For a returned `abstract_inverted_index`:

1. emit every `(position, word)` pair;
2. require non-negative integer positions;
3. reject conflicting duplicate positions;
4. sort by position;
5. join words with one space;
6. preserve the source `updated_date` separately.

Null or empty indices remain null. No generative model, translation, cleanup,
quality threshold or human label participates in reconstruction.

## Preserved artifacts

Ignored output directory:

```text
artifacts/semantic-retrieval/enrichment-v3.3-api-capture/
  batches/00000/
    response.json
    normalized.jsonl
    metadata.json
  ...
  openalex-abstract-capture.jsonl
  manifest.json
```

Each batch directory is atomically renamed into place only after all three
files exist and their hashes are known. The final JSONL is a concatenation in
frozen target order and contains exactly one normalized row per target.

## V3.3 build contract after capture

A complete validated capture permits a separate corpus builder to:

- start from the pinned V3.2 artifact;
- fill only currently empty `abstract` fields;
- preserve every existing non-empty abstract;
- preserve row count, row order, identifiers and every non-abstract field;
- emit a new V3.3 artifact rather than overwrite V3.2;
- record source and output hashes plus filled/missing counts.

Publication remains blocked until an independent validation confirms those
invariants. Updating semantic retrieval and generating embeddings remain
blocked until the published V3.3 revision passes the abstract audit and a new
20–100 document real-model smoke.

## Explicit exclusions

- no production change;
- no change to existing retrieval or `src/core/rank.js`;
- no Qwen inference;
- no embeddings or FAISS build;
- no human labels;
- no tuning based on recovered content;
- no model weights in the repository;
- no silent rerun of a completed batch;
- no claim that the live API capture equals the pinned Mearman snapshot.

## Frozen runner

The runner is `scripts/retrieval/capture_openalex_abstracts.py`. A full capture
requires the explicit `--all` flag. A bounded preflight requires
`--max-new-batches N`; neither mode is implicit.
