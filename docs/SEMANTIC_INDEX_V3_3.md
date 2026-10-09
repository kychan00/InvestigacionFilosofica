# Full semantic index: V3.3

**Local date:** 2026-10-09

**Gate:** `PASS`

## Scope

This is an offline, non-production index over the complete pinned V3.3 corpus.
It does not modify existing retrieval, `src/core/rank.js`, the public frontend
or any frozen Qwen3 experiment. No generative model or human label participated
in construction.

## Inputs

- Embedding documents: 451,823.
- Embedding shards: 402 ordered Parquet files.
- Embedding dimension: 1,024.
- Embedding model:
  `Qwen/Qwen3-Embedding-0.6B@97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`.
- Dataset:
  `CristianPelayo/openalex-philosophy@1c59478b679f5836ef6e8dce28b2d725d04f8e02`.
- Dataset file: `v3.3/philosophy-corpus-v3-3-full.parquet`.

The builder used an isolated artifacts directory. Its embedding view links the
local frozen manifest to the canonical iCloud shard directory; it does not
alter the resumable embedding state.

## Build

```bash
.venv-retrieval/bin/python scripts/retrieval/build_faiss_index.py \
  --artifacts-dir artifacts/semantic-retrieval/full-v3.3-index
```

The build completed as `20261009T135455Z` and atomically activated that
immutable version.

| Artifact | Logical size | SHA-256 |
| --- | ---: | --- |
| `semantic.faiss` | 1.7 GiB | `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68` |
| `documents.sqlite3` | 2.4 GiB | `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0` |
| `manifest.json` | 762 bytes | `cbe7e326c6687b50c734f1f19223da8de3673115ab46d11e2124ebcd30aa36c8` |

The FAISS contract is `IndexIDMap2(IndexFlatIP)` with inner product on
L2-normalized vectors.

## Independent validation

The active-bundle validator recomputed the FAISS SHA-256 and passed. Separate
checks confirmed:

- SQLite `PRAGMA integrity_check`: `ok`;
- FAISS vectors: 451,823;
- metadata rows: 451,823;
- FTS rows: 451,823;
- vector ID range: 0–451,822;
- distinct vector IDs: 451,823;
- distinct document IDs: 451,823;
- one real source vector (`451822`) retrieved itself at Top-1 with score
  `1.0000001192` and resolved to the expected metadata row.

After validation, all 402 source shards were evicted again through the iCloud
API. The canonical placeholders occupy zero local blocks; no remote shard was
deleted.

## Full-corpus functional smoke

The five existing internal queries ran once in semantic and hybrid modes with
the reranker disabled. Outputs remain JSONL under the ignored artifacts tree:

- semantic SHA-256:
  `65a7051cc9445c826ba494f4edc5144a548c543529965f52baa23f7424233bd0`;
- hybrid SHA-256:
  `f2df77553c47caa8d9b3ba6595f895489d6ce397415937e31f524cd8ef40e928`.

The first results directly matched all five topics and included Spanish,
English and Portuguese material. This is a functional smoke, not a relevance
judgment. It also exposed duplicate-looking bibliographic records with distinct
OpenAlex IDs; that observation must be evaluated prospectively and is not a
license for post-hoc tuning.

The local API returned HTTP 200 from `/health` with 451,823 documents and from
`POST /api/search/semantic` with deterministic language/year filters and
`enable_reranker=false`. The API was then stopped.

## Remaining gates

1. Review the five query result sets under a frozen human-review protocol.
2. Run a bounded full-index comparison with and without the frozen reranker;
   its current local latency is not yet interactive.
3. Decide how the 4.1 GiB active index bundle will be hosted and served over
   HTTPS.
4. Only after those gates, consider an opt-in frontend integration. The public
   ranking remains unchanged.
