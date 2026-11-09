import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSemanticDoi,
  normalizeSemanticOpenAlexId,
  semanticAliases,
  overlayDocumentText,
  overlayStableIdentity,
  classifySemanticCoverage
} from "../src/core/research-atlas-semantic-coverage.js";

test("RA12-C4 normalizes DOI and OpenAlex identities without fuzzy titles", () => {
  assert.equal(normalizeSemanticDoi("https://doi.org/10.1000/ABC.9"), "10.1000/abc.9");
  assert.equal(normalizeSemanticDoi("not-a-doi"), null);
  assert.equal(normalizeSemanticOpenAlexId("https://openalex.org/W123456"), "W123456");
  assert.equal(normalizeSemanticOpenAlexId("crossref:10.1/x"), null);
});

test("RA12-C4 Crossref DOI can resolve to an existing V4 vector without re-embedding", () => {
  const result = {
    id: "crossref:10.1000/existing",
    doi: "10.1000/EXISTING",
    title: "Existing work",
    providers: ["Crossref"]
  };
  const state = classifySemanticCoverage(result, alias =>
    alias === "doi:10.1000/existing"
      ? { workId: "W99", vectorId: 8, cluster: 2, ordinal: 3 }
      : null
  );
  assert.equal(state.state, "base-alias");
  assert.equal(state.requiresEmbedding, false);
  assert.equal(state.location.workId, "W99");
});

test("RA12-C4 direct OpenAlex identity is base-direct", () => {
  const result = {
    id: "https://openalex.org/W42",
    title: "Known work",
    providers: ["OpenAlex Philosophy"]
  };
  const state = classifySemanticCoverage(result, alias =>
    alias === "openalex:W42"
      ? { workId: "W42", vectorId: 42, cluster: 5, ordinal: 1 }
      : null
  );
  assert.equal(state.state, "base-direct");
  assert.equal(state.requiresEmbedding, false);
});

test("RA12-C4 genuinely external work becomes overlay candidate, not base mutation", () => {
  const result = {
    id: "crossref:10.2000/new",
    doi: "10.2000/new",
    title: "A newly discovered philosophical article",
    abstract: "A philosophical abstract.",
    providers: ["Crossref"]
  };
  const state = classifySemanticCoverage(result, () => null);
  assert.equal(state.state, "overlay-candidate");
  assert.equal(state.overlayIdentity, "doi:10.2000/new");
  assert.equal(state.requiresEmbedding, true);
  assert.equal(state.documentText, "A newly discovered philosophical article\n\nA philosophical abstract.");
});

test("RA12-C4 provider-local identity is allowed only for a single provider", () => {
  assert.equal(
    overlayStableIdentity({id:"ia:abc",providers:["Internet Archive"]}),
    "provider:internet-archive:ia:abc"
  );
  assert.equal(
    overlayStableIdentity({id:"same",providers:["A","B"]}),
    null
  );
});

test("RA12-C4 missing stable identity or title fails closed", () => {
  assert.equal(
    classifySemanticCoverage({title:"No stable id",providers:["A","B"]},()=>null).state,
    "unresolved"
  );
  assert.equal(
    classifySemanticCoverage({id:"x",providers:["CUCSH Filosofía"]},()=>null).reason,
    "missing-title"
  );
});

test("RA12-C4 aliases include source-record DOI but never title/year guesses", () => {
  const aliases=semanticAliases({
    title:"Same title",
    year:2020,
    providers:["Crossref"],
    sourceRecords:[{sourceId:"https://doi.org/10.3000/X"}]
  });
  assert.deepEqual(aliases,["crossref:10.3000/x","doi:10.3000/x"]);
  assert.equal(aliases.some(x=>x.includes("same title")),false);
});

test("RA12-C4 overlay text is frozen title + blank line + abstract", () => {
  assert.equal(overlayDocumentText({title:" A   title ",abstract:" A   body "}),"A title\n\nA body");
  assert.equal(overlayDocumentText({title:"Only title"}),"Only title");
  assert.equal(overlayDocumentText({abstract:"No title"}),null);
});
