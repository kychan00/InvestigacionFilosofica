# Qwen3 browser semantic static v2 result

**Decision:** `FAIL`
**Executed:** 2026-10-10
**Production impact:** none

V2 changed only the q8 browser execution provider from WebGPU to WASM. The
browser contract passed: five queries completed in Chrome through an audited
q8 WASM session with Node inference absent. Static payload constraints also
passed.

Embedding parity did not recover. Mean cosine against the canonical PyTorch
vectors was `0.785792` and the minimum was `0.671154`. Full-corpus mean
Recall@10 was `0.34`; mean Recall@50 was `0.424`. V2 therefore stopped before
publishing static shards or changing the frontend.

This shows that the v1 failure cannot be attributed only to the WebGPU
execution provider. The tested q8 ONNX representation is not interchangeable
with the frozen document-vector space under either audited browser backend.

The comparison uses identifier overlap, not human relevance labels. Model
weights are not stored in Git. `metadata.json` freezes hashes and lineage for
the reference vectors, browser vectors and evaluation outputs.
