# Qwen3 browser semantic static v1

**Status:** closed — `FAIL`
**Frozen on:** 2026-10-10  
**Production impact:** none

## Question

Can the existing semantic search be made independent of an always-on project
computer by moving query embedding and vector search into the browser, while
keeping a sufficiently close approximation to the frozen 451,823-document
FAISS baseline?

This is a portability experiment, not a ranking improvement experiment. The
reference behavior remains the immutable 1,024-dimensional Qwen3 embedding
index built as `20261009T135455Z`.

## Architecture under test

```text
static GitHub Pages application
  -> pinned Qwen3 embedding ONNX model
  -> q8 inference in a real browser through WebGPU
  -> normalized 256-dimensional query prefix
  -> small static centroid table
  -> 32 of 256 semantic vector shards
  -> int8 approximate inner-product search
  -> candidate identifiers and scores
```

The complete vector payload is expected to be roughly 110 MiB before file
headers and manifests. A query should fetch only its selected shards, not the
whole index. Metadata packaging is deliberately outside the first three gates;
the experiment must establish embedding and retrieval feasibility first.

## Frozen inputs

- Source commit: `4ad76042be6be6ff5358045fa0dd850216898cdf`.
- Query set SHA-256:
  `595da8eae92f48c0b05e88ff02256085590aa7e2bf41a4a919499aaaa8df3b16`.
- FAISS SHA-256:
  `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`.
- Reference model:
  `Qwen/Qwen3-Embedding-0.6B@97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`.
- Browser model:
  `onnx-community/Qwen3-Embedding-0.6B-ONNX@c25a394dd583836952667c12f008335071b3f43d`.

The machine-readable contract is
`benchmark/semantic-retrieval/browser-static-v1/preregistration.json`.

## Fixed representation

- Use the first 256 components of each frozen 1,024-dimensional vector.
- L2-normalize after truncation.
- Quantize document vectors to signed int8 with the fixed multiplier 127.
- Keep query vectors as normalized float32 values.
- Train 256 spherical clusters from 65,536 uniformly sampled frozen vectors.
- Use seed `20261010`, 20 iterations and exactly 32 probed clusters.
- Rank by approximate inner product descending and vector ID ascending for
  exact ties.

These values cannot be changed after execution starts. A different dimension,
quantizer, cluster count or probe count is a new experiment.

## Gates

### Gate 1: genuine browser execution

All five frozen queries must run in a real browser. The audit must record a
non-fallback WebGPU adapter and q8 WebGPU ONNX sessions. Node inference and a
WASM/CPU fallback are forbidden.

### Gate 2: embedding parity

Each browser q8 embedding must have cosine similarity at least 0.98 against the
canonical PyTorch embedding; the five-query mean must be at least 0.99. Every
embedding must contain 1,024 finite values.

### Gate 3: retrieval preservation

Both the deterministic 32,768-document prototype and the full corpus must meet:

- mean Recall@10 at least 0.80;
- Recall@10 at least 0.60 for every query;
- mean Recall@50 at least 0.85.

Recall measures identifier overlap against exact 1,024-dimensional search over
the same corpus. It is not a human relevance metric and does not establish
absolute retrieval quality.

### Payload gate

- complete vector payload no greater than 140 MiB;
- centroid payload no greater than 1 MiB;
- selected vector shards no greater than 32 MiB per query;
- browser model network payload no greater than 650 MiB.

## Decision and boundaries

Every gate must pass without tuning for v1 to continue into full static
packaging. Failure closes v1 and leaves the current public alpha and its
traditional-search fallback unchanged.

This experiment does not modify production, `src/core/rank.js`, frozen
embeddings, frozen FAISS, prior benchmark artifacts or model weights. It uses
no human labels, reranker or generative model.

## Result

The experiment ran once on 2026-10-10 and failed the preregistered parity and
retrieval gates. Genuine browser execution passed on an Apple `metal-3`
non-fallback adapter, with an audited q8 WebGPU ONNX session and five complete
1,024-dimensional embeddings. The payload projection also passed: the complete
int8 vector representation was 117,473,980 bytes and the largest 32-shard
selection was 15,601,560 bytes.

However, the browser embeddings had mean cosine `0.772495` and minimum cosine
`0.681688` against the canonical PyTorch embeddings. End-to-end full-corpus
mean Recall@10 was `0.32` and mean Recall@50 was `0.368`. These values are far
below the frozen gates, so no static artifacts were published and no frontend
or production integration was attempted.

Canonical receipts and hashes are under
`benchmark/semantic-retrieval/browser-static-v1/`. Any subsequent attempt must
use a new preregistration and address exact embedding-space compatibility.
