# Author Authority V2 — Phase 4: Bibliography shadow integration

## Scope

V2 remains opt-in via `authorityShadowRevision`; public archives, statistics and saved items are not governed by V2. The primary data source is the pinned CristianPelayo/openalex-philosophy Hugging Face index, with zero added direct OpenAlex API calls.

## Evidence and capture

Capture snapshot membership records before archive deduplication and collaborator enrichment; capture complementary source batches before federated filtering. Each snapshot membership identifies the source work, author ID, position and revision. Names and ORCID copied from the selected profile are synthesized and cannot corroborate that membership independently. Source records retain creator positions and explicit roles (author, editor, translator, coordinator, compiler, reviewer or unknown); no provider inherits another provider's authors. Shared DOI provenance is not independent corroboration.

Snapshot membership, registry listings and publisher-asserted identifiers may be probable, not automatically confirmed. Identity and contribution remain separate. A matching name alone does not prove authorship. Rejected and unresolved are distinct.

Observer failures are isolated from legacy retrieval; clone/evaluation failures are shadow diagnostics. Compatibility capture for injected snapshot implementations is explicitly diagnosed as post-merge. The production snapshot path captures before merging and does not capture twice.

## Validation

The specialized workflow runs the bibliography integration suite. The pinned benchmark runner reuses the frozen 100-pair evidence pack and emits bibliography-shadow.json with counts for unique profiles, sampled mentions, unique works, distinct possible profile/work contributions, metadata availability, source, role and decision state. Sample membership is not authenticated person identity or independent human judgment. Malformed source rows remain reported in the shared diagnostics; no claims of population precision or recall are made. No new provider calls or credentials are needed.

Phase 4 remains pending CI and review of actual benchmark results. Phase 5 is not enabled by this change.
