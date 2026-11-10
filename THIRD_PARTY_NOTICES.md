# Third-Party Notices

Investigación Filosófica depends on and, in some cases, bundles third-party
software. The root MIT License applies to the project's original code; it does
not relicense these components.

This file is a practical inventory based on the current dependency lockfile and
the browser bundles committed in `vendor/**`.

## Bundled / runtime components

| Component | Version in current lockfile | License |
| --- | --- | --- |
| `@huggingface/transformers` | 4.3.0 | Apache-2.0 |
| `@huggingface/tokenizers` | 0.2.0 | Apache-2.0 |
| `onnxruntime-web` | 1.31.0-dev.20260914-8d85527a0 | MIT |
| `onnxruntime-common` | 1.30.0 (plus dev variant used by web runtime) | MIT |
| `apache-arrow` | 17.0.0 | Apache-2.0 |
| `protobufjs` and `@protobufjs/*` | 7.6.6 / related packages | BSD-3-Clause |
| `flatbuffers` | 24.12.23 and transitive variant | Apache-2.0 |

Relevant license copies are stored under `LICENSES/**`.

## Direct project dependencies

| Component | Version | License |
| --- | --- | --- |
| `@duckdb/duckdb-wasm` | 1.33.1-dev57.0 | MIT |
| `franc-min` | 6.2.0 | MIT |
| `esbuild` | 0.28.2 | MIT |

## Additional transitive dependencies

The lockfile contains additional permissively licensed dependencies under MIT,
Apache-2.0, BSD-3-Clause, ISC, and 0BSD, together with optional/native packages
whose own terms continue to apply.

In particular, some `sharp` platform packages use Apache-2.0 and their
`libvips` packages are identified in the lockfile as LGPL-3.0-or-later.
Those packages are not relicensed by this project.

## Browser bundle notice preservation

The Qwen browser bundle build scripts are configured to preserve legal comments
at the end of generated bundles. This is intentional: generated artifacts must
not strip license notices belonging to incorporated dependencies.

## Model and dataset licenses

Model weights or datasets obtained at runtime or from external hosting retain
their own licenses. Their availability through this project does not change
those terms.
