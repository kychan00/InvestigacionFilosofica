# Semantic retrieval durable runtime v1

**Status:** installed and validated on 2026-10-10

The public semantic API no longer depends on a Codex-managed worktree. The
runtime remains local to the project Mac and therefore still requires the Mac
to be awake, connected and logged in.

## Installed layout

- source checkout: `/Users/kychan/filosofia/semantic-service`;
- source commit: `5f05e7c476f383c744e4afc55f3e2fc175e53435`;
- Python environment:
  `/Users/kychan/.local/share/investigacionfilosofica/venvs/semantic-retrieval-v1`;
- index and runtime artifacts:
  `/Users/kychan/.local/share/investigacionfilosofica/semantic-retrieval/v3.3`;
- logs: `/Users/kychan/.local/share/investigacionfilosofica/logs`;
- LaunchAgent:
  `~/Library/LaunchAgents/io.github.kychan00.investigacionfilosofica.semantic-api.plist`.

The 4.1 GiB index was moved on the same filesystem rather than copied. The
embedding manifest was materialized as a regular file so it does not point
back into the managed worktree. Embedding shards remain external, read-only
iCloud archive objects as designed.

## Frozen identity

- index build: `20261009T135455Z`;
- documents: 451,823;
- embedding manifest SHA-256:
  `1facaac58b4e4113d9d40ffceeb93ee64f3e35755a701b7dd6433a0b8339af44`;
- FAISS SHA-256:
  `31b82528a42bf416c86a77822d732b8d56381e2c1b0046df821c93e64dab6f68`;
- metadata SHA-256:
  `e32ad6066434f7fba9cd4df9211c1d6e45461e34c27bf5d113ccaa581fcf59d0`.

No model weights or index files entered Git.

## Acceptance result

The new Python environment first passed an isolated import and health smoke.
After the LaunchAgent cutover:

- local and public `/health` returned `ready`;
- the daemon advertised 451,823 documents, reranker unavailable and
  presentation hygiene available;
- the active LaunchAgent contained zero references to `.codex/worktrees`;
- the running process held no open files below `.codex/worktrees`;
- one public semantic acceptance query returned HTTP 200;
- its first result remained `openalex-W157960258` with semantic score
  `0.7339097261428833`;
- reranking remained disabled and presentation did not fall back.

The machine-readable receipt is
`benchmark/semantic-retrieval/durable-runtime-v1/summary.json`.

## Operations

Inspect the service:

```bash
launchctl print gui/$(id -u)/io.github.kychan00.investigacionfilosofica.semantic-api
curl http://127.0.0.1:8000/health
curl https://filosofia-semantic.tail829c9b.ts.net/health
```

Restart it after changing its installed plist:

```bash
launchctl bootout gui/$(id -u)/io.github.kychan00.investigacionfilosofica.semantic-api
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/io.github.kychan00.investigacionfilosofica.semantic-api.plist
```

The first semantic request after a process restart is a cold start and may take
substantially longer while Qwen and the FAISS worker initialize. Concurrent
requests are rejected with HTTP 429 during that interval by design.

## Remaining closure gate

Perform one login or reboot recovery smoke. If the LaunchAgent, Tailscale
Funnel, public health and one semantic query recover without manual repair,
the public semantic retrieval v1 operational gate can be declared closed and
the former managed worktree can be archived after preserving any desired
rollback environment.
