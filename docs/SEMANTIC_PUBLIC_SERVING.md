# Semantic retrieval public serving

**Status:** public alpha validated on 2026-10-09

## Endpoint

The semantic API is available at:

`https://filosofia-semantic.tail829c9b.ts.net`

Useful routes:

- `GET /health`
- `POST /api/search/semantic`
- `POST /api/search/hybrid`

This deployment runs on the project Mac and is exposed through Tailscale
Funnel. It has no hosting fee, but it is available only while the Mac is awake,
connected and logged in. It is a public alpha, not a cloud service with an SLA.

## Frozen serving policy

- Index build: `20261009T135455Z`.
- Documents: 451,823.
- Reranker: disabled at the server capability boundary.
- A request cannot enable a server-disabled reranker.
- Presentation hygiene: disabled in the public daemon.
- A request cannot enable server-disabled presentation hygiene.
- Searches: one concurrent request.
- Rate limit: ten searches per client per ten minutes.
- Excess or concurrent searches return HTTP 429 before inference.
- GitHub Pages origin is allowed by CORS.
- Model weights and index files remain outside Git.

The exact public smoke outputs and validation receipt are under
`benchmark/semantic-retrieval/public-serving-v1/`.

## Automatic startup

Two user LaunchAgents start at login and restart after failure:

- `io.github.kychan00.investigacionfilosofica.tailscaled`
- `io.github.kychan00.investigacionfilosofica.semantic-api`

Their installed definitions live under `~/Library/LaunchAgents/`. Runtime logs
live under `~/.local/share/investigacionfilosofica/logs/`. Tailscale identity,
certificates and Funnel state live outside Git under
`~/.local/share/tailscale-investigacionfilosofica/`.

Inspect status:

```bash
launchctl print gui/$(id -u)/io.github.kychan00.investigacionfilosofica.semantic-api
/opt/homebrew/opt/tailscale/bin/tailscale --socket=/tmp/investigacionfilosofica-tailscaled.sock funnel status
curl https://filosofia-semantic.tail829c9b.ts.net/health
```

Stop public exposure without deleting data:

```bash
/opt/homebrew/opt/tailscale/bin/tailscale --socket=/tmp/investigacionfilosofica-tailscaled.sock funnel --https=443 off
```

## Validation

The public smoke requested five semantic results for a natural-language Quine
query. The API returned HTTP 200, the full-index top five, `reranker_enabled =
false`, and null reranker scores even though the request tried to enable the
reranker. A CORS preflight from `https://kychan00.github.io` returned HTTP 200.

Both LaunchAgents were then restarted. The authenticated node, stable hostname,
Funnel mapping, TLS certificate and public health endpoint recovered without a
new login.

## Frontend integration

The public GitHub Pages frontend was connected on 2026-10-09 through merge
commit `5453c4c1fdd7625c721ce71e8d5c307289e3036a`. The deployment workflow
`37985827954` passed its test and deploy jobs.

The integration preserves the operational boundary:

- traditional federated search remains selected by default;
- semantic search is an explicit `Semántica · alfa` choice;
- the browser sends `enable_reranker: false` and cannot elevate server
  capability;
- elapsed time and active-search messages remain visible while the API works;
- HTTP 429, HTTP 503, network failure or a sleeping Mac automatically activate
  the traditional search and disclose that fallback;
- semantic scores are labelled as similarity, not human relevance or
  probability;
- semantic results do not expose citation or open-access filters when those
  fields are absent from the corpus snapshot.

The integration changes neither `src/core/rank.js` nor the existing production
retrieval pipeline. The API remains available only while the Mac is awake,
connected and logged in; the fallback keeps the public page useful otherwise.

## Availability and active-engine indicator

The production frontend added an explicit operational indicator on 2026-10-09
through merge commit `68eb2a223e53e87f8bea72239f1f943b6d7b36ed` (PR 13).
GitHub Pages workflow `37987230177` passed its test and deploy jobs.

The indicator:

- calls the lightweight, unmetered `GET /health` route at page load and after a
  stale focus/visibility return;
- does not load the embedding model, run inference or consume the search rate
  limit;
- displays `Semántica disponible` with the document count only after a valid
  `status = ready` response;
- otherwise displays `Semántica no disponible` while leaving the traditional
  engine usable;
- distinguishes the selected, currently active and finally used engine;
- marks a semantic failure followed by federated retrieval as `respaldo
  automático`.

The traditional engine remains selected by default. The health result is
advisory: every semantic request still retains its runtime fallback because
availability can change after the check.

## Public operational smoke

A bounded five-query public smoke was captured on 2026-10-09 with the frozen
benchmark query set, Top 10, one request at a time, zero retries and reranking
disabled. The completed capture returned HTTP 200 for 5/5 queries and 50/50
results with null rerank scores. Warm-service latency was 0.733176–6.183507
seconds, with a 1.501462-second median and 2.5608638-second mean.

The runner was frozen before the first capture. That attempt stopped when it
encountered an empty source title, and the partial receipt remains preserved.
The corrected runner records missing titles instead of inventing text; it was
frozen separately before the completed capture. The final result contains one
missing title among 50 rows.

The operational gate is `PASS_WITH_DATA_QUALITY_FINDINGS`. Post-hoc inspection
found duplicate or near-duplicate works across distinct OpenAlex IDs, one
mojibake title/abstract, literal title markup and one clear title/abstract-level
topical drift in the Frege query. These are triage observations, not human
relevance labels. Full receipts and hashes live in
`benchmark/semantic-retrieval/public-smoke-v1/`.

## Metadata and work-identity audit

An audit-only runner was frozen in `39c5b21` and applied once to the frozen
50-result smoke. It does not mutate source records, scores or order and does not
use human labels.

The audit found:

- one exact-identity group containing two OpenAlex IDs, eligible for a future
  conservative presentation collapse while preserving both identifiers;
- one probable-same-work group containing three IDs, including the exact pair,
  which remains review-only;
- one missing title;
- one literal-HTML field;
- three suspected-mojibake fields across two documents.

The audit source retained SHA-256
`ad2f581a1c5714721b088ff24c716876c86bdba6b531abc6200349875cf0490e`.
Outputs and their hashes live in
`benchmark/semantic-retrieval/metadata-hygiene-v1/`. This result authorizes no
production change; presentation integration requires a separate prospective
contract and held-out validation.

The separate presentation transform has now passed its first held-out
validation: ranks 11–15 from the existing hybrid benchmark supplied 25 IDs
with zero overlap against the public Top 10. All IDs, ranks and scores were
preserved; the slice contained no exact duplicates or display anomalies, so no
record was collapsed or rewritten. Synthetic tests cover the positive collapse
and sanitization paths. The transform is still not connected to public serving.

## Default-off presentation API integration

The API integration contract was frozen in `2ec41cb` and its implementation in
`30722c1`. It uses independent server and request opt-ins, adds explicit status
metadata, applies presentation only after retrieval, and safely falls back to
the original result list if the optional transformation fails.

A bounded local smoke over the full 451,823-document index passed. The
default-off request preserved all ten source results exactly. The double-opt-in
request returned nine representatives after collapsing the known exact Quine
pair, while provenance reconstructed all ten IDs and scores in source order.
The complete Python suite passed 53/53 tests. Canonical receipts live in
`benchmark/semantic-retrieval/presentation-api-smoke-v1/`.

This code is not enabled in the public LaunchAgent or consumed by the frontend.
The public behavior therefore remains unchanged pending a separate deployment
decision.
