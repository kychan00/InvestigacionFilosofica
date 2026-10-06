# Abstract enrichment V3.3 preflight

**Date:** 2026-10-05  
**Decision:** source route unresolved  
**V3.3 publication:** blocked  
**Mass embedding build:** blocked

This preflight tests acquisition mechanics only. It does not modify V3.2,
publish V3.3, change production retrieval or generate corpus embeddings.

## Deterministic target set

The target builder reread the same pinned source and eligibility contract used
by semantic retrieval:

- dataset: `CristianPelayo/openalex-philosophy`;
- revision: `09c329326ed24ccf986c4b4c47c9794f055516dc`;
- artifact: `v3.2/philosophy-corpus-v3-2-full.parquet`;
- eligible: `CORE` or `PROBABLE`, excluding `LOW_QUALITY` and `PARATEXT`;
- target: empty whitespace-normalized abstract.

It produced 244,353 rows and 244,353 unique OpenAlex IDs in pinned V3.2
source order. Sequences are contiguous from zero. The ignored JSONL artifact is:

```text
artifacts/semantic-retrieval/enrichment-v3.3-preflight/missing-targets-v3.2.jsonl
SHA-256 5f8b3e278200bd002418c8b0174ee323fbecbf495a25e7d45f21c6df8b2862ab
```

The builder is `scripts/retrieval/preflight_abstract_enrichment.py`. Repeated
runs atomically replace the target set; they do not append or silently resume a
different selection.

## Route 1: immutable Mearman/OpenAlex snapshot

The exact upstream revision resolved for the preflight is:

```text
Mearman/OpenAlex@ef02effac13bfbd0991612f444cebcef8a882453
```

At that revision, `data/works/abstracts/` contains 2,127 Parquet files totaling
177,328,395,882 bytes. The observed schema is:

| Column | Type |
| --- | --- |
| `work_id` | `int64` |
| `word` | `string` |
| `positions` | `list<int64>` |

The stable join key is therefore integer `work_id`. Abstracts must be rebuilt by
ordering words by every recorded position.

The source probe selected eight evenly spaced files over lexicographically
sorted paths. It scanned only their compressed `work_id` columns first, then
measured the token/position bytes in row groups containing at least one target.

| Measure | Result |
| --- | ---: |
| Sampled file bytes | 490,622,793 |
| Sampled row groups | 59 |
| Row groups containing targets | 50 (84.746%) |
| Distinct target IDs found | 219 |
| Compressed `work_id` bytes | 6,588,804 |
| Compressed token/position bytes | 484,006,734 |
| Token/position bytes in matching row groups | 430,352,359 (88.915%) |

The snapshot has neither a Parquet column index nor an offset index that would
permit selective token recovery inside those groups. Finding IDs is cheap, but
recovering their text would still read nearly all token/position data. If the
sample ratio generalized, approximately 157.7 GB of the 177.3 GB source would
be transferred. That extrapolation is an operational estimate, not a measured
full-snapshot byte count.

The complete ignored probe report is:

```text
artifacts/semantic-retrieval/enrichment-v3.3-preflight/mearman-source-probe.json
SHA-256 6652cb4d747a3b97892e8fed0ae4da00e6a186e3b78387341fa080db59d332f2
```

## Route 2: selective current OpenAlex API

One bounded, unauthenticated request used the first 100 deterministic targets.
The client sent only IDs and selected `id`, `abstract_inverted_index` and
`updated_date`. When a key is supplied through the environment, the client does
not persist it in reports or output artifacts.

| Measure | Result |
| --- | ---: |
| Requested IDs | 100 |
| IDs returned | 78 |
| Returned with reconstructable abstract | 41 |
| HTTP status | 200 |
| Request credits used | 1 |
| Unauthenticated daily limit reported | 1,000 |
| Remaining after the probe | 997 |

The first 100 records are a deterministic source-order smoke, not a random
sample. The 41% recovery observed here must not be extrapolated as an estimated
full-corpus recovery rate.

The full target set needs 2,444 requests at the official 100-ID OR-filter
maximum. This exceeds the unauthenticated daily limit reported by the response.
More importantly, this endpoint is live and mutable: a timestamped response can
be hashed and preserved, but it is not the pinned upstream snapshot required by
the original enrichment contract.

Ignored artifacts:

```text
artifacts/semantic-retrieval/enrichment-v3.3-preflight/abstract-enrichment-preflight.json
SHA-256 1fc43c1ace0ff59db36e5270ccf1c3da7f4fddbd886c488f0db4c6ef5f76bb46

artifacts/semantic-retrieval/enrichment-v3.3-preflight/openalex-api-probe-response.json
SHA-256 d132af5555e7f9a7631932ea867b903f1cae813fca3e1a03d448fb532f61391f

artifacts/semantic-retrieval/enrichment-v3.3-preflight/openalex-api-probe-normalized.jsonl
SHA-256 54146bc8d94a7ac68c325e5f572c18040a97a15d2bcabf23af4776fd89a4ba71
```

## Gate and required decision

Neither route may be silently substituted for the other:

1. **Pinned snapshot:** preserves the requested provenance, but needs a remote
   or temporary environment able to stream roughly 158 GB and should be treated
   as a substantial data build.
2. **Timestamped API acquisition:** is selective and practical with an API key,
   but changes the provenance contract from an immutable mirror revision to a
   preserved live API capture.

Until one route is explicitly chosen, do not run the remaining API batches,
publish V3.3, update `RETRIEVAL_DATASET_REVISION`, or generate the 451,823
embeddings. PR #4 remains draft.

## Reproduction

```bash
.venv-retrieval/bin/python scripts/retrieval/preflight_abstract_enrichment.py

.venv-retrieval/bin/python scripts/retrieval/preflight_abstract_enrichment.py \
  --probe-api

.venv-retrieval/bin/python scripts/retrieval/probe_mearman_abstracts.py \
  --targets artifacts/semantic-retrieval/enrichment-v3.3-preflight/missing-targets-v3.2.jsonl \
  --revision ef02effac13bfbd0991612f444cebcef8a882453 \
  --output artifacts/semantic-retrieval/enrichment-v3.3-preflight/mearman-source-probe.json
```

The API probe deliberately performs exactly one bounded request. There is no
command in this preflight that can launch the full 2,444-request acquisition.
