# Semantic retrieval real-model smoke: V3.3

**Local date:** 2026-10-06

**Gate:** `PASS`

## Frozen inputs

- Dataset: `CristianPelayo/openalex-philosophy`.
- Dataset revision: `1c59478b679f5836ef6e8dce28b2d725d04f8e02`.
- Dataset file: `v3.3/philosophy-corpus-v3-3-full.parquet`.
- Embedding model: `Qwen/Qwen3-Embedding-0.6B`.
- Embedding revision: `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`.
- Embedding dimension: 1,024.
- Reranker model: `Qwen/Qwen3-Reranker-0.6B`.
- Reranker revision: `e61197ed45024b0ed8a2d74b80b4d909f1255473`.
- Device: Apple MPS.
- Sample: first 20 eligible documents in frozen corpus order.

Model weights remained in the external Hugging Face cache and were not copied
into the repository.

## Memory preflight

The first attempt used the configured embedding batch size of 16. It failed
before writing any embedding shard or index:

```text
RuntimeError: MPS backend out of memory
MPS allocated: 8.85 GiB; max allowed: 9.07 GiB
requested allocation: 288.00 MiB
```

The failed directory contains only the initial SQLite state file. The valid
smoke was rerun in a fresh directory with `EMBEDDING_BATCH_SIZE=1`. This is an
operational memory setting only; corpus order, normalized document text,
model, revision, dimension and retrieval instruction were unchanged.

The reranker also used `RERANKER_BATCH_SIZE=1`. Its smoke was deliberately
limited to ten retrieved candidates; no score or ranking parameter was tuned
from the result.

## Embedding result

- Documents requested: 20.
- Documents embedded: 20.
- Existing documents reused: 0.
- Documents with a non-empty abstract: 19.
- Embedding shard:
  `part-000000000000-000000000019.parquet`.
- Shard size: 181,050 bytes.
- Shard SHA-256:
  `4a518cdb4a7655131fffed8dec8696c0c3e7b3e72b3c988f1019cd220e1cf676`.
- Embedding manifest SHA-256:
  `09d8a095e83ac20eda59620196856c716776aea56e3913bdf3d51158bc1d6200`.

## FAISS result

- Index implementation: `IndexIDMap2(IndexFlatIP)`.
- Metric: inner product on L2-normalized vectors.
- Indexed documents: 20.
- Added documents: 20.
- Index size: 82,170 bytes.
- Index SHA-256:
  `46a3d50ca1f854be558bc2574cffde21a6fbaaf878a9276d419f63d7e73fcfa8`.
- Index validation: `PASS`.

## Retrieval result

The fixed smoke query was:

> How does imagination constrain judgments about metaphysical possibility?

Without reranking, the first result was:

- `openalex-W7100616065` — *Imaginative blocks and impossibility: an essay in
  modal psychology*;
- semantic score: `0.573335587978363`.

With the frozen Qwen3 reranker, the same document remained first:

- semantic score: `0.573335587978363`;
- rerank score: `3.5400562286376953`.

The result directly discusses modal judgments, modal epistemology and modal
psychology. The result payload preserved its bibliographic metadata and both
scores. No generative model participated in retrieval.

## API result

The API was started against the smoke bundle and exercised over HTTP:

- `GET /health`: HTTP 200, `status=ready`, 20 documents, correct embedding
  model revision and index build ID;
- `POST /api/search/semantic`: HTTP 200, language filter applied, three
  results returned, expected document first;
- response retained `semantic_score`; reranking was explicitly disabled for
  the API request because the reranker had already been tested separately.

## Decision

`PASS`

The V3.3 material-quality gate and the required real-model smoke are complete.
A full offline embedding build is now scientifically permitted. It has not
been started: the workstation had only 7.5 GiB free, while a 451,823-document
bundle must hold the vectors plus repeated document metadata, SQLite state and
the FAISS publication bundle. The full build therefore requires external or
additional storage and must preserve the pinned contracts above.

