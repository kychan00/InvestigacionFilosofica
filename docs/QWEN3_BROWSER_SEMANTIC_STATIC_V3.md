# Qwen3 browser semantic static v3

**Status:** closed — `FAIL`
**Frozen on:** 2026-10-10
**Production impact:** none

V1 and v2 established that the tested q8 ONNX representation does not match
the frozen PyTorch document-vector space through either WebGPU or WASM. V3 is
the final fidelity gate for this browser-Qwen3 route: it uses the pinned fp16
ONNX export on genuine WebGPU and leaves every corpus-side parameter unchanged.

The tradeoff is frozen and explicit. The ONNX graph plus external fp16 data are
1,200,510,818 bytes before browser-cache overhead. This remains zero-cost and
serverless, but it is a heavy first download. Passing the mathematical gates
would establish feasibility, not acceptable final product ergonomics.

The same five already-observed queries are an engineering regression set, not
a fresh confirmatory relevance evaluation. V3 uses no human labels. It cannot
change the 256-dimensional prefix, int8 document quantization, 256 clusters,
32 probes or retrieval thresholds after execution begins.

The machine-readable contract is
`benchmark/semantic-retrieval/browser-static-v3/preregistration.json`.

## Result

V3 ran once on 2026-10-10. Genuine fp16 WebGPU execution and embedding parity
passed: mean cosine was `0.999722` and minimum cosine was `0.999697`. The static
payload gate also passed. The frozen 256-dimensional representation failed the
retrieval gate, with full-corpus mean Recall@10 `0.68`, minimum Recall@10 `0.40`
and mean Recall@50 `0.70`.

No artifacts were published and production remained unchanged. Receipts and
hashes are under `benchmark/semantic-retrieval/browser-static-v3/`.
