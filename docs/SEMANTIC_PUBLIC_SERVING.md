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
