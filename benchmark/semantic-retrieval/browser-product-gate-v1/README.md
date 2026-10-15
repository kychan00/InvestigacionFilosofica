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
