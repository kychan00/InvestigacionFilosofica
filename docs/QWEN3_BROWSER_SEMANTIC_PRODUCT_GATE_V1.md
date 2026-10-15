# Qwen3 browser semantic product gate v1

**Status:** frozen pass  
**Measured:** 2026-10-14 local time  
**Production default:** unchanged

This gate measured the public, URL-opt-in browser semantic V4 path before
making it discoverable in the ordinary interface. It is an engineering/product
measurement, not a relevance experiment. The frozen protocol is
`benchmark/semantic-retrieval/browser-product-gate-v1/preregistration.json`.

## What passed

- Chrome 155 used an Apple `metal-3` WebGPU adapter; it was not a fallback
  adapter.
- All three planned searches completed as `browser-static-v4`.
- All 36 rendered result keys matched the frozen expected order.
- No POST was made to the semantic service, so the successful searches did not
  depend on the Mac or Tailscale.
- The public browser module retained the immutable corpus revision.
- The warm reload transferred less than the cold run.

## Observed product cost

| Phase | Time | Encoded transfer | Peak sampled JS heap |
| --- | ---: | ---: | ---: |
| Cold first query | 194.611 s | 1,297,598,732 bytes | 1,365,499,026 bytes |
| Same-session repeat | 1.305 s | 0 bytes | 202,171,156 bytes |
| Reload, new query | 49.956 s | 80,163,169 bytes | 1,760,821,597 bytes |

The temporary Chrome profile reached 1,575,182,336 bytes after the full
sequence and was removed after measurement. JavaScript heap is not total
browser or GPU memory.

## Decision

The technical route passes, but the measured first-use cost is too large to
make it an implicit or default behavior. The production default remains
unchanged. The next permitted product step is a visible, explicit opt-in that
states the approximate 1.3 GB first download, local storage implications,
device/WebGPU requirement and fallback behavior before the user starts it.

This result applies only to the recorded Mac, Chrome version, adapter and
uncontrolled network. It is not a general compatibility claim.

## Integrity

- preregistration SHA-256:
  `0520c1e40ba8ea45178c0593126af7092fa95df4e857e7edf143026b2704bbf7`
- result SHA-256:
  `8601b54520af8f94a5ea1d63a38eff1aacc4fdf0c08a911ca191a0b531cc0a99`
- run log SHA-256:
  `336887a75f2f2f0ff1bb0ce8a49e96602bc3d2780534ed0d3a7d956d549fd365`
- frozen runner commit:
  `cac004c585d167311a32bbe6c64c1b940d5b649c`
