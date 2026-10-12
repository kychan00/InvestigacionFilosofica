# Qwen3 browser semantic static v1 result

**Decision:** `FAIL`  
**Executed:** 2026-10-10  
**Production impact:** none

The WebGPU execution and payload gates passed, but the pinned browser ONNX
model did not reproduce the canonical embedding space closely enough. The
experiment therefore stopped before static publication or frontend
integration, exactly as preregistered.

## Gate results

| Gate | Result | Observation |
| --- | --- | --- |
| Browser execution | PASS | Apple `metal-3`, non-fallback adapter; q8 WebGPU ONNX session; 5/5 queries |
| Embedding parity | FAIL | mean cosine `0.772495`; minimum `0.681688` |
| 32,768-document prototype | FAIL | mean Recall@10 `0.34`; mean Recall@50 `0.404` |
| 451,823-document corpus | FAIL | mean Recall@10 `0.32`; mean Recall@50 `0.368` |
| Static payload | PASS | vectors `117,473,980` bytes; maximum selected shards `15,601,560` bytes |

The low retrieval overlap cannot be attributed to payload size or WebGPU
fallback: the browser contract itself passed. It follows the low cross-runtime
embedding cosine, so publishing these shards would connect an incompatible
query space to the frozen document space.

This comparison measures identifier overlap with the frozen exact FAISS
ranking. It uses no human relevance labels and makes no claim about absolute
retrieval quality.

## Frozen outputs

- `preregistration.json`: protocol frozen before execution.
- `reference-embeddings.json`: canonical PyTorch query vectors.
- `browser-embeddings.json`: q8/WebGPU query vectors and adapter/session audit.
- `result.json`: gate decision and complete per-query observations.
- `results.jsonl`: compact full-corpus rankings and recall.
- `metadata.json`: execution lineage and output hashes.

No model weights are stored here. A different ONNX export, dimension or index
would require a separately frozen experiment.
