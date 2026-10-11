# Qwen3 browser semantic static v4 result

**Decision:** `PASS`
**Executed:** 2026-10-10
**Production impact:** none

V4 retained all 1,024 dimensions, quantized frozen document vectors to signed
int8 and kept the 256-cluster/32-probe routing design. Every frozen gate passed.

| Gate | Observation |
| --- | --- |
| Browser execution | fp16 WebGPU, Apple `metal-3`, non-fallback |
| Embedding parity | mean cosine `0.999722`; minimum `0.999697` |
| Prototype retrieval | mean Recall@10 `0.96`; mean Recall@50 `0.96` |
| Full-corpus retrieval | mean Recall@10 `0.96`; minimum `0.90`; mean Recall@50 `0.948` |
| Static payload | vectors `464,474,044` bytes; centroids `1,048,576` bytes; maximum selected shards `69,356,076` bytes |

The result authorizes immutable static artifact construction and browser
validation. It does not by itself authorize a production switch. The fp16
model's 1,200,510,818-byte cold download remains a significant usability
tradeoff that must be shown to users before any later opt-in integration.

Recall measures identifier overlap against the exact frozen FAISS ranking. It
is not a human relevance score. No human labels, reranker or generative model
were used.
