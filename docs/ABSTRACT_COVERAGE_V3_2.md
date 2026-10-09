# Abstract coverage audit: OpenAlex Philosophy V3.2

**Date:** 2026-09-30

**Gate:** `NEEDS_ENRICHMENT`

**Mass embedding build:** blocked

## Audited contract

- Dataset: `CristianPelayo/openalex-philosophy`
- Revision: `09c329326ed24ccf986c4b4c47c9794f055516dc`
- Artifact: `v3.2/philosophy-corpus-v3-2-full.parquet`
- Artifact SHA-256: `81f39d5ae5ea192897a7c3cd405b3b0a3494a032658895219c7906e5f34e93c0`
- Eligibility: `tier` in `CORE`, `PROBABLE`; exclude `document_role` values `LOW_QUALITY`, `PARATEXT`
- Abstract normalization: collapse whitespace and strip
- Short/suspicious definition fixed before inspection: 1–199 characters
- Useful-length reference fixed before inspection: at least 200 characters

The complete generated report remains outside Git at
`artifacts/semantic-retrieval/audits/abstract-coverage-v3.2.json`. Its SHA-256
is `ffd409cf97c63a4f5a74671f233dfa39c39dc402cdf91caefdaeb19b8c26fdbf`.

## Coverage

| Measure | Count | Eligible share |
| --- | ---: | ---: |
| Full Parquet rows | 822,445 | — |
| Eligible rows | 451,823 | 100.000% |
| Non-empty abstract | 207,470 | 45.918% |
| Missing abstract | 244,353 | 54.082% |
| Abstract at least 200 characters | 200,265 | 44.324% |

Of the non-empty abstracts, 96.527% contain at least 200 normalized characters.
The main issue is therefore missing coverage, not a corpus dominated by tiny
non-empty strings.

## Non-empty abstract lengths

| Statistic | Characters |
| --- | ---: |
| Mean | 1,246.514 |
| Median | 1,017 |
| Percentile 25 | 677 |
| Percentile 75 | 1,480 |
| Minimum non-empty | 1 |
| Minimum observed at useful threshold | 200 |
| Maximum | 27,902 |

| Length bin | Count |
| --- | ---: |
| 0 | 244,353 |
| 1–49 | 1,717 |
| 50–199 | 5,488 |
| 200–499 | 22,834 |
| 500–999 | 70,470 |
| 1000+ | 106,961 |

## Principal breakdowns

### Tier

| Tier | Eligible | With abstract | Without | Coverage |
| --- | ---: | ---: | ---: | ---: |
| CORE | 263,737 | 85,463 | 178,274 | 32.405% |
| PROBABLE | 188,086 | 122,007 | 66,079 | 64.868% |

### Document role

| Role | Eligible | With abstract | Coverage |
| --- | ---: | ---: | ---: |
| SCHOLARLY | 444,936 | 205,875 | 46.271% |
| REVIEW | 5,592 | 1,536 | 27.468% |
| SECOND_SIGNAL_RESCUE | 1,221 | 0 | 0.000% |
| EMPIRICAL_ADJACENT | 74 | 59 | 79.730% |

### Major languages

| Language | Eligible | With abstract | Coverage |
| --- | ---: | ---: | ---: |
| English | 386,858 | 167,294 | 43.244% |
| Spanish | 9,577 | 4,897 | 51.133% |
| German | 7,984 | 2,925 | 36.636% |
| French | 7,689 | 3,816 | 49.629% |
| Portuguese | 6,978 | 5,418 | 77.644% |
| Missing language | 11,649 | 10,228 | 87.802% |

### Major publication types

| Type | Eligible | With abstract | Coverage |
| --- | ---: | ---: | ---: |
| article | 328,618 | 146,243 | 44.502% |
| book-chapter | 51,982 | 17,548 | 33.758% |
| book | 24,029 | 11,984 | 49.873% |
| other | 18,161 | 12,531 | 69.000% |
| dissertation | 14,035 | 10,520 | 74.955% |
| preprint | 6,367 | 5,343 | 83.917% |

The generated JSON contains the complete breakdown by exact publication year,
language and type. Coverage rises strongly in recent decades: 29.705% in the
1990s, 42.704% in the 2000s, 49.652% in the 2010s and 64.559% in the 2020s.

## Reproducible samples and inspection

The audit selected the 50 lowest SHA-256 priorities for each category using
seed `20260930`, category and OpenAlex ID. The JSONL files remain outside Git.

| Sample | SHA-256 | Inspection result |
| --- | --- | --- |
| With abstract | `18c3a1581a2d637940cdaee38662a801f317e9caf0028906623af191a071dd12` | Predominantly substantive academic summaries; a small minority are notices, citations, contents or repository descriptions. |
| Without abstract | `d6b92e9f5bc44bdb725cf399e948ab530def55db975de67139f16edd5a5abe2f` | Plausible scholarly titles across articles, chapters, books and dissertations; absence cannot be explained only by paratext. |
| Short abstract | `58e0afda3c288c6893a868379e212064c358e102a93d9c1482daab7dab2f0b5b` | Most are access notices, previews, bibliographic fragments, repository notes or truncations; treating 1–199 characters as suspicious is justified. |

As a supporting, non-snapshot comparison, one request to the current OpenAlex
API returned 45 of the 50 missing-sample IDs; 14 of those 45 currently expose
an abstract. This does not reconstruct historical snapshot availability, but it
demonstrates that at least part of the V3.2 missing set can carry abstracts.

## Smoke input verification

Five documents from the real 20-document Qwen smoke were reconstructed through
the same `normalize_document()` and `build_document_text()` functions used by
the embedding job. All five contained an exact `Abstract:` block. The JSONL has
SHA-256 `a7cb106b344b24cd91c6751fef38fb79594a206bbf026688669db0e1f509ccd0`.

The modal-psychology result used this exact structure:

```text
Title:
Imaginative blocks and impossibility: an essay in modal psychology

Abstract:
The big philosophical questions about modality are metaphysical and epistemic: ...
```

Its normalized abstract contains 1,178 characters and the complete embedding
input has SHA-256
`a09da10f19a8c87d0949cbc0a049581ad9b0a184f91b4cafa1470e0b881c2af2`.
The smoke therefore did not operate on title alone.

## Transformation finding

The historical V3.1/V3.2 builder explicitly reconstructs abstracts only for:

- every `PROBABLE` and `BORDERLINE` record;
- `CORE` records whose primary concept belongs to the ambiguous-anchor set.

It discovers `data/works/abstracts`, joins abstract rows to those selected IDs
by integer `work_id`, unnests `positions`, and rebuilds text by ordering each
`word` by position. This selective target rule explains the large CORE versus
PROBABLE coverage gap and shows that V3.2 full was not intended to carry every
available upstream abstract.

The source workflow used `Mearman/OpenAlex` at mutable `main`; it did not record
an upstream revision. Before enrichment, the actual chosen upstream revision
and schema must be frozen. The historical extractor expects `work_id`, `word`
and `positions`; the current Hugging Face dataset card describes the abstract
subset separately and may expose a different representation at newer
revisions. The stable semantic join key is `work_id`.

## Gate decision

`NEEDS_ENRICHMENT`

Do not generate the 451,823 production embeddings from V3.2. Do not overwrite
V3.2, rerun the philosophy classifier, or change production retrieval.

The next admissible step is a targeted enrichment design:

1. freeze an exact `Mearman/OpenAlex` revision;
2. inspect and record the real `works__work_abstracts` schema at that revision;
3. restrict the upstream read to the 451,823 eligible `work_id` values;
4. reconstruct abstracts if the source remains inverted/tokenized;
5. preserve existing V3.2 fields and fill missing abstracts by `work_id`;
6. publish a new version such as V3.3 with counts, hashes and lineage;
7. pin its Hugging Face revision and rerun this audit plus the 20–100 document smoke;
8. only then reconsider the massive embedding build.

The enrichment source preflight is now recorded in
[`ABSTRACT_ENRICHMENT_V3_3_PREFLIGHT.md`](ABSTRACT_ENRICHMENT_V3_3_PREFLIGHT.md).
It fixed 244,353 unique missing-abstract targets, verified the pinned upstream
schema and proved a 100-ID API request can selectively recover abstracts. It
also established that the pinned snapshot would require a near-full text scan,
while the selective API is live rather than immutable. That preflight blocked
V3.3 and the mass embedding build until an explicit source-route decision.

That decision is now frozen prospectively in
[`ABSTRACT_ENRICHMENT_V3_3_API_CAPTURE.md`](ABSTRACT_ENRICHMENT_V3_3_API_CAPTURE.md):
use a single timestamped OpenAlex API capture, preserve every raw response and
hash, then build a separate V3.3 artifact. This changes the upstream provenance
contract explicitly; it does not treat the live API as an immutable snapshot.
