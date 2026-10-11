# Qwen3 browser semantic static v3 result

**Decision:** `FAIL`
**Executed:** 2026-10-10
**Production impact:** none

The fp16 WebGPU representation passed its central fidelity test. Five browser
embeddings completed on a non-fallback Apple `metal-3` adapter, and cosine
against the canonical PyTorch vectors was `0.999722` on average with a
`0.999697` minimum.

The fixed 256-dimensional corpus representation did not preserve enough of the
exact ranking. Full-corpus mean Recall@10 was `0.68`, minimum Recall@10 was
`0.40`, and mean Recall@50 was `0.70`. The payload gate passed, but v3 required
every gate to pass, so it stopped without static publication or production
integration.

This result isolates the remaining failure: browser fp16 inference is
compatible; 256-dimensional prefix truncation is not adequate for the frozen
retrieval-preservation thresholds. The comparison uses identifier overlap and
no human relevance labels.
