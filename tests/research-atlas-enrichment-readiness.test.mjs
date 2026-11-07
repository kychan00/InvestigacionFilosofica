import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

import {
  assertResearchAtlasEnrichmentActivation,
  evaluateResearchAtlasEnrichmentReadiness,
  validateResearchAtlasEnrichmentReadiness
} from "../src/core/research-atlas-enrichment-readiness.js";


const config =
  JSON.parse(
    await readFile(
      new URL(
        "../benchmark/research-atlas/v10/enrichment-readiness.json",
        import.meta.url
      ),
      "utf8"
    )
  );


test("RA10 readiness config is valid but intentionally blocked today", () => {
  const validation =
    validateResearchAtlasEnrichmentReadiness(
      config
    );

  assert.equal(
    validation.ok,
    true,
    validation.errors.join("\n")
  );

  const report =
    evaluateResearchAtlasEnrichmentReadiness(
      config
    );

  assert.equal(
    report.valid,
    true
  );

  assert.equal(
    report.ready,
    false
  );

  assert.equal(
    report.authorAuthority.ready,
    false
  );

  assert.equal(
    report.relatedWork.ready,
    false
  );
});


test("Author Authority remains blocked until human audit and immutable publication exist", () => {
  const report =
    evaluateResearchAtlasEnrichmentReadiness(
      config
    );

  assert.deepEqual(
    report.authorAuthority.prepublicationBlockers,
    [
      "human-audit-judgments-not-versioned",
      "human-audit-gate-not-passed",
      "human-audit-zero-false-merges-not-established"
    ]
  );

  assert.ok(
    report.authorAuthority.blockers.includes(
      "authority-artifact-not-published"
    )
  );

  assert.ok(
    report.authorAuthority.blockers.includes(
      "authority-publication-not-pinned"
    )
  );
});


test("Related Work remains blocked until exact FAISS full build and publication exist", () => {
  const report =
    evaluateResearchAtlasEnrichmentReadiness(
      config
    );

  assert.deepEqual(
    report.relatedWork.prepublicationBlockers,
    [
      "original-faiss-not-recoverable",
      "full-related-work-index-not-built",
      "full-related-work-index-not-validated",
      "full-related-work-manifest-not-pinned"
    ]
  );

  assert.ok(
    report.relatedWork.blockers.includes(
      "related-work-artifact-not-published"
    )
  );
});


test("production activation throws while either enrichment is blocked", () => {
  assert.throws(
    () =>
      assertResearchAtlasEnrichmentActivation(
        config,
        {
          authorAuthority:
            true
        }
      ),
    /Author Authority activation is blocked/
  );

  assert.throws(
    () =>
      assertResearchAtlasEnrichmentActivation(
        config,
        {
          relatedWork:
            true
        }
      ),
    /Related Work activation is blocked/
  );
});


test("a future fully pinned and gated configuration may activate both enrichments", () => {
  const ready =
    structuredClone(
      config
    );

  ready.authorAuthority.humanAudit = {
    ...ready.authorAuthority
      .humanAudit,
    judgmentsVersioned:
      true,
    gatePassed:
      true,
    falseMergeCount:
      0
  };

  ready.authorAuthority.publication = {
    ...ready.authorAuthority
      .publication,
    published:
      true,
    revision:
      "abcdef1234567890",
    baseUrl:
      "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/abcdef1234567890/research-atlas/author-authority/v1/build",
    manifestSha256:
      "1".repeat(64),
    registrySha256:
      "2".repeat(64)
  };

  ready.relatedWork.fullBuild = {
    ...ready.relatedWork
      .fullBuild,
    originalFaissRecoverable:
      true,
    built:
      true,
    validated:
      true,
    manifestSha256:
      "3".repeat(64)
  };

  ready.relatedWork.publication = {
    ...ready.relatedWork
      .publication,
    published:
      true,
    revision:
      "fedcba0987654321",
    baseUrl:
      "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/fedcba0987654321/research-atlas/related-work/v1/build",
    manifestSha256:
      "3".repeat(64)
  };

  const report =
    assertResearchAtlasEnrichmentActivation(
      ready,
      {
        authorAuthority:
          true,
        relatedWork:
          true
      }
    );

  assert.equal(
    report.ready,
    true
  );

  assert.equal(
    report.authorAuthority
      .prepublicationReady,
    true
  );

  assert.equal(
    report.relatedWork
      .prepublicationReady,
    true
  );
});


test("published artifacts without immutable revision or checksums are invalid", () => {
  const invalid =
    structuredClone(
      config
    );

  invalid.authorAuthority.publication.published =
    true;

  const validation =
    validateResearchAtlasEnrichmentReadiness(
      invalid
    );

  assert.equal(
    validation.ok,
    false
  );

  assert.match(
    validation.errors.join("\n"),
    /revision|manifestSha256|registrySha256/
  );
});
