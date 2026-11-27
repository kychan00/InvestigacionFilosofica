# Phase 7A — scientific readiness, not automatic rollout

The last successful technical run on 1bc9dee passed all 11 checks. Live browser smoke decoded three legacy historical portraits (Kant, Hegel, Socrates). The paired snapshot cohort did not establish V2 portrait quality: 25 candidate profiles, 20 measured, 5 outside the bounded sample, 4 comparable abstentions and 16 rate-limited profiles, zero downloaded by either route. This is not zero false matches, nor evidence of an improvement. No human review completed.

## Proposed acceptance policy

The versioned release-policy.json records proposed thresholds before adjudication. The frozen 100-pair pilot remains separate from a planned 300-case independent risk-stratified cohort (60 contemporary, 50 historical, 60 Latin American, 60 homonyms, 40 variants, 30 initials). Keep identity, contribution and portrait labels separately. Pilot: all reviewed, at least 80 resolved, at least 80% coverage, precision >=98%, recall >=85%, zero observed false merges. These are proposed criteria, not measured accuracy; a small sample cannot guarantee a population error rate. Contribution: at least 100 independently reviewed cases, precision >=98%, recall >=85%. Portrait: at least 20 reviewed cases, >=80% comparable provider coverage, at least one actual successful download, zero observed wrong portraits. These preliminary thresholds require agreement and calibration before final rollout.

## Report

The benchmark job produces author-authority-v2-release-readiness/readiness.json. Check dataset revision, frozen sample checksum, and exact sample size; optional reviewed judgments are bound to the dataset revision and sample checksum, require notes and evidence. Report legacy/V2 pair metrics separately with null for undefined precision/recall, abstentions separate from false splits, recall accounting for unaccepted positive cases, and coverage over resolved gold. Portrait gains/losses count only comparable outcomes, not network errors. Bibliographic aggregate counts remain diagnostic. No human labels invented. Scientific readiness is explicitly blocked pending independent final cohort and contribution/portrait review; the report cannot activate production. CI success validates the reporting contract, not scientific readiness.

## Remaining work

7B: construct the independent cohort and blind review packets for the distinct scopes; resolve contribution relevance and synthetic membership defects; audit candidate ambiguity, exact archive mapping and SIVA identifiers against real evidence. 7C: review performance on mobile and desktop, verify rollback and URL-scoped preview, then require explicit approval for a separate activation change. Current default code is unchanged; no direct OpenAlex API. No persistent portrait cache. No production merge.

Manual review artifacts must be reviewed by an independent human with documented sources; never use model predictions as gold. The current pilot analyzer only measures supplied judgments, and intentionally cannot approve the missing scopes or the final cohort. In a later change, extend the gate to validate those reviewed datasets before considering activation.

## Phase 7B.1 — scoped attribution repair and nominal holdout packet

Unrelated coauthors with different ORCIDs are no longer contradictions of the selected profile. A relevant conflicting identifier remains an asserted conflict, not a verified rejection. Positive evidence and a relevant conflicting identifier for the same role are aggregated as ambiguous; different roles stay separate. Declared synthetic membership with invalid binding cannot fall back to ordinary creator metadata. Source candidates are explicitly described as retrieved records rather than the author's output. No changes to legacy archive behavior.

Build an initial disjoint-ID nominal risk holdout (up to 60 homonym pairs, 40 accent-perturbed queries, 30 initials queries) from frozen benchmark strata, excluding pilot and SIVA candidate IDs, with deterministic ordering, real source evidence and blank judgments. Do not fill shortages by duplicating profiles. These are different tasks, not pooled accuracy or independent human gold. Disjoint IDs do not establish disjoint persons. Contemporary/historical/Latin American reference cohorts remain pending; do not infer nationality or life dates from spelling or publication dates. Artifact: author-authority-v2-nominal-holdout. The final 300-case scientific gate remains blocked. CI pending.
