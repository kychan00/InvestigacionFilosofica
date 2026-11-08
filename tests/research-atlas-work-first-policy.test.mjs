import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const policy =
  JSON.parse(
    await readFile(
      new URL(
        "../benchmark/research-atlas/v11/work-first-policy.json",
        import.meta.url
      ),
      "utf8"
    )
  );

const embed =
  await readFile(
    new URL(
      "../js/research-atlas-embed.js",
      import.meta.url
    ),
    "utf8"
  );

const mainPage =
  await readFile(
    new URL(
      "../index.html",
      import.meta.url
    ),
    "utf8"
  );

test("RA11 declares Work as primary topology entity", () => {
  assert.equal(
    policy.schemaVersion,
    "research-atlas-work-first-policy-v1"
  );

  assert.equal(
    policy.topology.primaryEntity,
    "work"
  );

  assert.equal(
    policy.topology.method,
    "title-abstract-tfidf-cosine-v1"
  );

  assert.equal(
    policy.topology.abstractFallback,
    "title-only"
  );
});

test("human audit, Authority and Related Work are not required for base Atlas", () => {
  assert.equal(
    policy.topology.humanAuditRequired,
    false
  );

  assert.equal(
    policy.topology.authorAuthorityRequired,
    false
  );

  assert.equal(
    policy.topology.relatedWorkRequired,
    false
  );

  assert.equal(
    policy.optionalEnrichments
      .authorAuthority
      .requiredForBaseAtlas,
    false
  );

  assert.equal(
    policy.optionalEnrichments
      .relatedWork
      .requiredForBaseAtlas,
    false
  );
});

test("document similarity cannot claim influence or same-author", () => {
  const forbidden =
    new Set(
      policy.epistemicBoundary
        .forbiddenFromDocumentSimilarityAlone
    );

  for (const claim of [
    "influence",
    "citation",
    "same author"
  ]) {
    assert.ok(
      forbidden.has(claim),
      claim
    );
  }
});

test("main Atlas uses document similarity without enrichment readiness gate", () => {
  assert.match(
    embed,
    /addResearchAtlasDocumentSimilarity/
  );

  assert.equal(
    embed.includes(
      "assertResearchAtlasEnrichmentActivation"
    ),
    false
  );

  assert.equal(
    embed.includes(
      "research-atlas-enrichment-readiness"
    ),
    false
  );
});

test("main UI names the layer Título + abstract", () => {
  assert.match(
    mainPage,
    /Título \+ abstract/
  );
});
