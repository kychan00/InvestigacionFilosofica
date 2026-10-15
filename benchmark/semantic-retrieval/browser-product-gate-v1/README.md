# Browser semantic product gate v1

This directory records a single-device product measurement of the already
deployed, URL-opt-in browser semantic V4 path. It does not change retrieval,
ranking, model weights, corpus artifacts or production defaults.

The frozen method is in `preregistration.json`. The runner operates on the
public GitHub Pages URL with a disposable Chrome profile and writes JSON plus a
plain log. The profile is deleted after the measurements, so the approximately
1.12 GiB model cache is not retained locally.

Run only after the preregistration and runner commit is frozen:

```text
npm run measure:browser-semantic-product-gate
```

The result is intentionally limited to the recorded Mac, Chrome, GPU adapter
and uncontrolled network connection. It is not a cross-browser or cross-device
certification.

## Frozen result

The one allowed run passed all seven gates. On the recorded Apple Metal-3
adapter and Chrome 155, the cold search took 194.611 seconds and transferred
1,297,598,732 encoded bytes. Repeating the exact query in the same session took
1.305 seconds with zero network bytes. After a reload, a different query took
49.956 seconds and transferred 80,163,169 bytes.

All rendered result keys matched the frozen V4 order, the adapter was not a
fallback adapter, and no semantic-service POST occurred. The result does not
justify enabling the mode by default: the measured cold cost and peak
JavaScript heap remain substantial. The next product boundary is an explicit,
informed browser-mode opt-in.

Frozen hashes and the independently checked summary are in `metadata.json`.
