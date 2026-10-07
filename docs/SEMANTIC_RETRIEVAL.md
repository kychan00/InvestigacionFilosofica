# Semantic retrieval service

This service searches the project's pinned academic corpus without using a
generative LLM. It is intentionally separate from the static GitHub Pages
frontend.

## Architecture

```text
Pinned Hugging Face Parquet
        |
        v
Qwen/Qwen3-Embedding-0.6B (offline batches)
        |
        v
versioned Parquet embedding shards
        |
        v
FAISS IndexIDMap2(IndexFlatIP) + SQLite metadata/FTS
        |
        +--> semantic candidates (50 by default)
        +--> lexical candidates
                 |
                 v
Qwen/Qwen3-Reranker-0.6B (optional, enabled by default)
                 |
                 v
top 15 results with semantic_score, lexical_score and rerank_score
```

The embedding and index jobs are offline. A search request never traverses the
whole corpus and never rebuilds embeddings or FAISS.

FAISS search runs in a persistent local worker process. This is an intentional
native-runtime boundary: on macOS, executing `faiss-cpu` and PyTorch in one
process caused reproducible interpreter crashes. The query model stays loaded
in the API process and the FAISS index stays loaded in its worker, so the
boundary does not reload either one per request.

## Reproducible inputs

- Dataset: `CristianPelayo/openalex-philosophy`
- Dataset revision: `1c59478b679f5836ef6e8dce28b2d725d04f8e02`
- Source artifact: `v3.3/philosophy-corpus-v3-3-full.parquet`
- Search eligibility: `CORE` or `PROBABLE`, excluding `LOW_QUALITY` and
  `PARATEXT`
- Embedding model revision:
  `Qwen/Qwen3-Embedding-0.6B@97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`
- Reranker revision:
  `Qwen/Qwen3-Reranker-0.6B@e61197ed45024b0ed8a2d74b80b4d909f1255473`

The current V3.3 corpus has title, abstract, year, language, type and classifier
evidence. It does not currently carry authors, DOI, journal or full OpenAlex
topics in this Parquet. The normalizer supports these fields and preserves them
when a future enriched snapshot supplies them; absent fields are omitted from
the embedding text. Every source row is retained in `original_json` and the
OpenAlex identifier is kept as both `openalex_id` and a stable local ID such as
`openalex-W123456`.

## Storage and incremental updates

Large outputs stay below `artifacts/semantic-retrieval/`, which is ignored by
Git.

```text
artifacts/semantic-retrieval/
  embeddings/
    manifest.json
    state.sqlite3
    shards/*.parquet
  index/
    CURRENT
    versions/<build-id>/
      semantic.faiss
      documents.sqlite3
      manifest.json
```

`build_embeddings.py` compares stable IDs and content hashes. It embeds only new
documents. If an existing document changed, it stops and requires a full build
in a new artifact directory rather than silently mixing vector versions.

`build_faiss_index.py --incremental` copies the active immutable bundle and adds
only vector IDs that are not already indexed. `CURRENT` is replaced atomically
after validation, so the API never observes a half-written bundle.

At 1024 float32 dimensions, 451,823 vectors occupy about 1.72 GiB before FAISS
and metadata overhead. Plan for several GiB of persistent disk. A service that
keeps FAISS plus both 0.6B models resident should have at least 6-8 GiB of RAM;
GPU acceleration is preferable for reranking. A smaller Matryoshka dimension
can be configured and must be benchmarked as a new index contract before
production use.

## Installation

Use Python 3.10 or newer. Model files go to the normal Hugging Face cache, not
the Git repository.

```bash
python3 -m venv .venv-retrieval
.venv-retrieval/bin/pip install -r requirements-semantic-retrieval.txt
```

## Phase 1: embeddings, FAISS and semantic search

For a small end-to-end smoke build:

```bash
.venv-retrieval/bin/python scripts/retrieval/build_embeddings.py --limit 500
.venv-retrieval/bin/python scripts/retrieval/build_faiss_index.py
ENABLE_RERANKER=false .venv-retrieval/bin/python scripts/retrieval/search.py "Quine y el compromiso ontológico" --no-reranker
```

For the complete pinned corpus, omit `--limit`. This is a long-running offline
job and should run on a machine with adequate accelerator, disk and memory.

## Phase 2 and 3: reranking and hybrid retrieval

The reranker is lazy-loaded only when enabled. Both semantic and lexical
candidates retain their original component scores before reranking.

```bash
.venv-retrieval/bin/python scripts/retrieval/search.py "lógica y ontología en Frege" --mode hybrid
```

The first hybrid version deliberately uses a simple union by stable document
ID. It does not pretend that semantic cosine and SQLite BM25 are calibrated on
the same scale.

## Phase 4: API, filters and cache

```bash
RETRIEVAL_ARTIFACTS_DIR=artifacts/semantic-retrieval \
  .venv-retrieval/bin/uvicorn semantic_retrieval.api:app --host 127.0.0.1 --port 8000
```

`POST /api/search/semantic` and `POST /api/search/hybrid` accept:

```json
{
  "query": "¿Qué críticas existen contra la estética trascendental de Kant?",
  "limit": 15,
  "filters": {
    "year_from": 1950,
    "year_to": 2026,
    "languages": ["es", "en"]
  }
}
```

Filters are deterministic metadata comparisons and do not use a model. Query
embeddings have a bounded in-memory TTL cache keyed by normalized query, model,
revision, dimension and retrieval instruction.

Because the public frontend is static GitHub Pages, it must call a separately
deployed HTTPS instance of this API. The frontend should not be switched until
the full index is built, the benchmark is reviewed and an API host is selected.

## Evaluation

The internal queries live in
`benchmark/semantic-retrieval/queries-v1.jsonl`. Generate auditable JSONL output
with:

```bash
.venv-retrieval/bin/python scripts/retrieval/evaluate_retrieval.py \
  --output artifacts/semantic-retrieval/evaluation-v1.jsonl
```

Manual review should record conceptual relevance, topical precision, ranking
quality, multilingual behavior and false positives. Results with and without
reranking must be stored separately.

## Local real-model smoke (2026-09-30)

A non-production smoke artifact under `/tmp` validated 20 eligible records with
the pinned embedding model on Apple MPS, a 1024-dimensional FAISS index and a
natural-language query. The expected document, *Imaginative blocks and
impossibility: an essay in modal psychology*, ranked first with semantic score
`0.7154197`.

The pinned reranker also kept that document first with raw score `7.8420315`.
Its first local pass over 10 candidates took roughly three minutes, however.
That latency is not acceptable for an interactive deployment and remains a
serving/performance gate. The smoke does not replace a complete index build or
the benchmark over the full corpus. The same artifact returned HTTP 200 from
both `/health` and `POST /api/search/semantic`, with the expected document in
the API response.

## Abstract quality gate

The V3.2 abstract audit is documented in
[`ABSTRACT_COVERAGE_V3_2.md`](ABSTRACT_COVERAGE_V3_2.md). Only 207,470 of
451,823 eligible records have a non-empty abstract (45.918%). The historical
builder reconstructed abstracts only for selected classifier targets, and CORE
coverage is 32.405%. The gate is `NEEDS_ENRICHMENT`; the full embedding build is
blocked until a new, versioned corpus fills available abstracts by `work_id`
and passes the audit and smoke tests again.

The follow-up
[`ABSTRACT_ENRICHMENT_V3_3_PREFLIGHT.md`](ABSTRACT_ENRICHMENT_V3_3_PREFLIGHT.md)
freezes the 244,353-row enrichment target set and compares the two admissible
source routes. The pinned mirror is immutable but requires a near-full scan of
the 177.3 GB abstract subset; the current OpenAlex API is selective but mutable
and needs 2,444 requests for the complete target set. That preflight withheld
V3.3 construction until the provenance choice was fixed.

The choice is now fixed prospectively in
[`ABSTRACT_ENRICHMENT_V3_3_API_CAPTURE.md`](ABSTRACT_ENRICHMENT_V3_3_API_CAPTURE.md):
a timestamped, raw-response-preserving OpenAlex API capture over the frozen
244,353-ID target set. V3.3 publication and embeddings remain blocked until the
capture and separate corpus build pass their invariant checks.

The capture, build and remote verification are complete. The published V3.3
artifact is documented in
[`ABSTRACT_COVERAGE_V3_3.md`](ABSTRACT_COVERAGE_V3_3.md). It added 82,905
abstracts without changing any non-abstract value, raises eligible coverage to
64.267% and passed the matter-quality gate. The subsequent real-model smoke is
documented in
[`SEMANTIC_RETRIEVAL_SMOKE_V3_3.md`](SEMANTIC_RETRIEVAL_SMOKE_V3_3.md): 20
documents were embedded on Apple MPS, FAISS validation passed, semantic search
and the frozen reranker returned the expected document first, and both API
probes returned HTTP 200. The full build is permitted but awaits storage that
can safely hold the complete offline bundle.
