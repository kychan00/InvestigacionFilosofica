# Qwen3 browser semantic static v2

**Status:** closed — `FAIL`
**Frozen on:** 2026-10-10
**Production impact:** none

V1 proved that the static payload is small enough and that the model loads in
a genuine browser, but q8/WebGPU produced an incompatible embedding space.
This is consistent with an open upstream Transformers.js report in which q4
and q8 WebGPU embedding inference can silently produce wrong vectors while
WASM remains correct:
<https://github.com/huggingface/transformers.js/issues/1736>.

V2 changes exactly one runtime variable: the pinned q8 ONNX model runs through
ONNX Runtime Web/WASM inside the browser. Node inference remains forbidden.
This does not require an always-on server or project computer.

All corpus-side choices remain those frozen for v1: 256-dimensional prefix,
fixed signed-int8 quantization, 256 spherical clusters, 32 probes, deterministic
sampling and identical parity/Recall@10/Recall@50 gates. The same five queries
are reused only as an engineering regression set; because v1 observations are
known, v2 is not presented as a new confirmatory relevance experiment.

If every gate passes, v2 may proceed directly to immutable static packaging.
If any gate fails, it stops without tuning and production remains unchanged.
The machine-readable contract is
`benchmark/semantic-retrieval/browser-static-v2/preregistration.json`.

## Result

V2 ran once on 2026-10-10. Browser execution passed with five complete
1,024-dimensional embeddings through an audited q8 WASM session and no Node
inference. Payload limits passed. Embedding parity failed with mean cosine
`0.785792` and minimum cosine `0.671154`; full-corpus mean Recall@10 was `0.34`
and mean Recall@50 was `0.424`.

No static shards were published and production remained unchanged. Canonical
receipts and hashes are under
`benchmark/semantic-retrieval/browser-static-v2/`.
