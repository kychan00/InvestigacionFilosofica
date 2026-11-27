# Phase 6A — SIVA portrait evidence in shadow mode

The existing SIVA resolver retains the actual selected Wikidata P18 claim, entity ID, revision when available, Commons file name and bridge method. The separate portrait decision uses an asserted authority-image-link and can reach probable, not confirmed; a license, ORCID, or authorship decision cannot establish depicted identity. An exact canonical filename is required for this experimental assertion. No new external calls or changes to the ordinary image acceptance policy. Live evidence without a known revision is explicitly marked live-unversioned, not identified as the HF revision.

Opt-in authorityPreview=1 evaluates only after the existing image validation, download and decode complete. Missing or failed media remains unresolved; normal portrait lifecycle and limits remain unchanged. The session keeps the assessment transiently and clears it on exit, with no persistent storage. The existing default portrait presentation is unchanged. A probable label is experimental, not a guarantee about the person.

The subsequent phase must address independent ORCID-free candidate discovery, stronger documentary evidence and conflicts, and verify real named-author cases before activation. The legacy historical/name and bibliographic bridges remain hypotheses, not verified person identities. No merge to production.

New unit tests exercise scope, missing/conflicting metadata and existing request counts. The responsive portrait smoke now exercises the experimental assessment across 32 viewport/theme combinations and verifies cleanup. CI validation remains required.
