import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

import {
  evaluateResearchAtlasWorkCentricPolicy,
  validateResearchAtlasWorkCentricPolicy
} from "../src/core/research-atlas-work-centric-policy.js";

import {
  buildResearchAtlasSnapshot
} from "../src/core/research-atlas-assembler.js";


const policy =
  JSON.parse(
    await readFile(
      new URL(
        "../benchmark/research-atlas/v11/work-centric-policy.json",
        import.meta.url
      ),
      "utf8"
    )
  );


test("RA11 work-centric policy is valid and launch-ready without Author Authority", () => {
  const validation =
    validateResearchAtlasWorkCentricPolicy(
      policy
    );

  assert.equal(
    validation.ok,
    true,
    validation.errors.join("\n")
  );

  const report =
    evaluateResearchAtlasWorkCentricPolicy(
      policy
    );

  assert.equal(
    report.coreAtlasReady,
    true
  );

  assert.equal(
    report.authorAuthorityBlocking,
    false
  );

  assert.equal(
    report.relatedWorkBlocking,
    false
  );
});


test("RA11 forbids name-only person merging even though authors may be displayed", () => {
  assert.equal(
    policy.authors
      .displaySourceReportedNames,
    true
  );

  assert.equal(
    policy.authors
      .identityResolutionRequiredForDisplay,
    false
  );

  assert.equal(
    policy.authors
      .nameEqualityMayMergePeople,
    false
  );

  assert.equal(
    policy.authors
      .authorityIsOptionalEnrichment,
    true
  );
});


test("RA11 semantic evidence outranks textual fallback for the same work pair", () => {
  assert.equal(
    policy.coreTopology
      .semanticPriority
      .supersedesTextualFallbackForSamePair,
    true
  );

  assert.equal(
    policy.coreTopology
      .semanticPriority
      .metric,
    "cosine"
  );

  assert.equal(
    policy.coreTopology
      .textualFallback
      .method,
    "title-abstract-tfidf-v1"
  );
});


test("RA11 preserves title and abstract on WorkNode", () => {
  const snapshot =
    buildResearchAtlasSnapshot(
      {
        query:
          "aura and memory",
        results: [
          {
            id:
              "https://openalex.org/W900",
            title:
              "Aura and memory",
            abstract:
              "This abstract is preserved for work-centric topology.",
            authors: [],
            year: 2024,
            type:
              "article",
            language:
              "en",
            doi:
              null,
            isbn: [],
            topics: [],
            providers: [
              "OpenAlex Philosophy"
            ],
            sourceRecords: [
              {
                provider:
                  "OpenAlex Philosophy",
                sourceId:
                  "https://openalex.org/W900",
                query:
                  "aura and memory",
                rank:
                  1
              }
            ],
            matchedQueries: [
              {
                query:
                  "aura and memory",
                weight:
                  1,
                type:
                  "original"
              }
            ],
            urls: {},
            institutionalLinks: []
          }
        ],
        errors: [],
        stats: {
          appearances: 1,
          unique: 1,
          merged: 0,
          providers: {
            "OpenAlex Philosophy": 1
          }
        }
      }
    );

  const work =
    snapshot.nodes.find(
      node =>
        node.nodeType ===
        "work"
    );

  assert.equal(
    work.title,
    "Aura and memory"
  );

  assert.equal(
    work.abstract,
    "This abstract is preserved for work-centric topology."
  );
});


test("RA11 launch policy rejects any future attempt to make human audit mandatory", () => {
  const invalid =
    structuredClone(
      policy
    );

  invalid.launch
    .requiresAuthorHumanAudit =
      true;

  const validation =
    validateResearchAtlasWorkCentricPolicy(
      invalid
    );

  assert.equal(
    validation.ok,
    false
  );

  assert.match(
    validation.errors.join("\n"),
    /human-audit-must-not-block-atlas-launch/
  );
});
