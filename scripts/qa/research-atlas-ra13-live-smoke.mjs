import assert from "node:assert/strict";

import {
  fetchOrcidPublicWorks
} from "../../src/sources/orcid.js?v=20261112-production-visible-v2";

import {
  ResearchAtlasAssembler
} from "../../src/core/research-atlas-assembler.js?v=20261113-ra13a-v1";

import {
  validateResearchAtlasSnapshot
} from "../../src/core/research-atlas-contract.js";


const ORCID =
  "0000-0002-7283-8051";

const displayName =
  "Mauricio Méndez Huerta";

const registry =
  await fetchOrcidPublicWorks(
    ORCID,
    {
      displayName
    }
  );

assert.ok(
  registry.works.length > 3,
  "El ORCID real debe seguir exponiendo una bibliografía pública utilizable"
);

const results =
  registry.works
    .slice(0, 6)
    .map(work => ({
      ...work,
      matchedQueries: [
        {
          query:
            displayName,
          weight:
            1,
          type:
            "original",
          provider:
            "ORCID"
        }
      ]
    }));

const response = {
  query:
    displayName,
  results,
  errors: [],
  stats: {
    unique:
      results.length,
    appearances:
      results.length,
    merged:
      0,
    providers: {
      ORCID:
        results.length
    }
  }
};

const snapshot =
  new ResearchAtlasAssembler({
    dynamicIdentity:
      true,
    filters: {},
    sourceRevisions: {
      orcid:
        "live-public-record"
    }
  }).ingest(
    response
  );

const validation =
  validateResearchAtlasSnapshot(
    snapshot
  );

assert.equal(
  validation.ok,
  true,
  validation.errors.join("\n")
);

const person =
  snapshot.nodes.find(node =>
    node.nodeType ===
      "authority-person" &&
    node.externalIdentifiers
      ?.some(identifier =>
        identifier.scheme ===
          "orcid" &&
        identifier.normalizedValue ===
          ORCID
      )
  );

assert.ok(
  person,
  "RA13 debe materializar una AuthorityPerson desde el ORCID real"
);

assert.equal(
  person.displayName,
  displayName
);

const contributions =
  snapshot.edges.filter(edge =>
    edge.type ===
      "contribution" &&
    edge.fromRef ===
      person.id
  );

assert.equal(
  contributions.length,
  results.length,
  "cada obra ORCID recuperada debe conservar su contribución confirmada"
);

assert.ok(
  snapshot.edges.some(edge =>
    edge.type ===
      "same-author"
  ),
  "varias obras del mismo ORCID deben producir relación same-author"
);

assert.equal(
  snapshot.session
    .identityLayer
    .mode,
  "query-scoped-deterministic"
);

console.log(
  "RA13 live ORCID:",
  JSON.stringify({
    orcid:
      ORCID,
    works:
      results.length,
    person:
      person.displayName,
    contributions:
      contributions.length,
    sameAuthorEdges:
      snapshot.edges.filter(
        edge =>
          edge.type ===
            "same-author"
      ).length,
    identityDiagnostics:
      snapshot.diagnostics
        .identityLayer
  })
);
