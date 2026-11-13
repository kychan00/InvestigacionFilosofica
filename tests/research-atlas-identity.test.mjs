import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchAtlasIdentityAuthorityGraph,
  RESEARCH_ATLAS_IDENTITY_REVISION
} from "../src/core/research-atlas-identity.js";

import {
  buildResearchAtlasSnapshot,
  ResearchAtlasAssembler
} from "../src/core/research-atlas-assembler.js";

import {
  addResearchAtlasDocumentSimilarity
} from "../src/core/research-atlas-document-similarity.js";

import {
  validateResearchAtlasSnapshot
} from "../src/core/research-atlas-contract.js";


const ORCID =
  "0000-0002-7283-8051";


function response() {
  return {
    query:
      "argumentación",
    results: [
      {
        id:
          "crossref:10.1000/a",
        title:
          "Argumentación y adolescencia",
        abstract:
          "Estudio filosófico sobre argumentación y formación.",
        year:
          2021,
        doi:
          "10.1000/a",
        providers: [
          "Crossref",
          "ORCID"
        ],
        sourceRecords: [
          {
            provider:
              "Crossref",
            sourceId:
              "10.1000/a",
            query:
              "argumentación"
          },
          {
            provider:
              "ORCID",
            sourceId:
              ORCID + "/work/1",
            query:
              "Registro público ORCID"
          }
        ],
        matchedQueries: [
          {
            query:
              "argumentación",
            weight:
              1,
            type:
              "original"
          }
        ],
        authors: [
          {
            name:
              "Mauricio Méndez Huerta",
            id:
              "https://openalex.org/A123",
            orcid:
              "https://orcid.org/" +
              ORCID
          }
        ],
        orcidSearch: {
          profile:
            ORCID,
          displayName:
            "Mauricio Méndez Huerta",
          institutions: [
            "Universidad de Guadalajara"
          ],
          authorQuery:
            false
        },
        urls: {
          canonical:
            "https://doi.org/10.1000/a"
        }
      },
      {
        id:
          "orcid:" +
          ORCID +
          ":2",
        title:
          "Retórica, diálogo y argumentación",
        abstract:
          "Texto sobre retórica y diálogo.",
        year:
          2020,
        providers: [
          "ORCID"
        ],
        sourceRecords: [
          {
            provider:
              "ORCID",
            sourceId:
              ORCID + "/work/2",
            query:
              "Registro público ORCID"
          }
        ],
        matchedQueries: [
          {
            query:
              "argumentación",
            weight:
              1,
            type:
              "original"
          }
        ],
        authors: [
          {
            name:
              "M. Méndez Huerta",
            id:
              "https://orcid.org/" +
              ORCID,
            orcid:
              "https://orcid.org/" +
              ORCID
          },
          {
            name:
              "Ana Colaboradora",
            id:
              "https://openalex.org/A456"
          }
        ],
        orcidSearch: {
          profile:
            ORCID,
          displayName:
            "Mauricio Méndez Huerta",
          institutions: [
            "Universidad de Guadalajara"
          ],
          authorQuery:
            false
        },
        urls: {
          canonical:
            "https://orcid.org/" +
            ORCID
        }
      },
      {
        id:
          "crossref:10.1000/c",
        title:
          "Deliberación filosófica",
        abstract:
          "Una contribución sobre deliberación.",
        year:
          2019,
        doi:
          "10.1000/c",
        providers: [
          "Crossref"
        ],
        sourceRecords: [
          {
            provider:
              "Crossref",
            sourceId:
              "10.1000/c",
            query:
              "argumentación"
          }
        ],
        matchedQueries: [
          {
            query:
              "argumentación",
            weight:
              1,
            type:
              "original"
          }
        ],
        authors: [
          {
            name:
              "Autor Sin Identificador"
          }
        ],
        urls: {
          canonical:
            "https://doi.org/10.1000/c"
        }
      }
    ],
    errors: [],
    stats: {
      unique: 3,
      appearances: 4,
      merged: 1,
      providers: {
        Crossref: 2,
        ORCID: 2
      }
    }
  };
}


test("RA13 construye autoridad query-scoped sin fusionar por nombre solamente", () => {
  const built =
    buildResearchAtlasIdentityAuthorityGraph(
      response()
    );

  assert.equal(
    built.diagnostics.revision,
    RESEARCH_ATLAS_IDENTITY_REVISION
  );

  assert.equal(
    built.authorityGraph
      .authorities.length,
    2
  );

  assert.equal(
    built.diagnostics
      .orcidAuthorities,
    1
  );

  assert.equal(
    built.diagnostics
      .openAlexOnlyAuthorities,
    1
  );

  assert.equal(
    built.diagnostics
      .unresolvedWithoutIdentifier,
    1
  );
});


test("dos grafías con el mismo ORCID convergen en una AuthorityPerson", () => {
  const built =
    buildResearchAtlasIdentityAuthorityGraph(
      response()
    );

  const authority =
    built.authorityGraph
      .authorities
      .find(item =>
        item.externalIdentifiers
          .some(identifier =>
            identifier.scheme ===
              "orcid" &&
            identifier.normalizedValue ===
              ORCID
          )
      );

  assert.ok(authority);

  assert.deepEqual(
    new Set(
      authority.names
        .map(item =>
          item.value
        )
    ),
    new Set([
      "Mauricio Méndez Huerta",
      "M. Méndez Huerta"
    ])
  );

  assert.ok(
    authority.externalIdentifiers
      .some(identifier =>
        identifier.scheme ===
          "openalex-author" &&
        identifier.normalizedValue ===
          "123"
      )
  );

  assert.deepEqual(
    authority.affiliations
      .map(item =>
        item.institution
      ),
    [
      "Universidad de Guadalajara"
    ]
  );
});


test("RA13 materializa contribuciones, coautoría y mención no resuelta", () => {
  const snapshot =
    new ResearchAtlasAssembler({
      dynamicIdentity:
        true,
      filters: {},
      sourceRevisions: {
        fixture:
          "ra13-test"
      }
    }).ingest(
      response()
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

  assert.equal(
    snapshot.session
      .identityLayer
      .mode,
    "query-scoped-deterministic"
  );

  assert.equal(
    snapshot.diagnostics
      .identityLayer
      .orcidAuthorities,
    1
  );

  assert.equal(
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
          "authority-person"
    ).length,
    2
  );

  assert.equal(
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
          "author-mention"
    ).length,
    1
  );

  assert.ok(
    snapshot.edges.some(
      edge =>
        edge.type ===
          "same-author"
    )
  );

  assert.ok(
    snapshot.edges.some(
      edge =>
        edge.type ===
          "coauthor"
    )
  );
});


test("un OpenAlex author ID ligado a dos ORCID distintos queda fuera del registro compartido", () => {
  const conflicted = {
    query:
      "homónimos",
    results: [
      {
        ...response().results[0],
        id:
          "crossref:10.1000/x",
        title:
          "Obra X",
        authors: [
          {
            name:
              "Persona Uno",
            id:
              "https://openalex.org/A999",
            orcid:
              "https://orcid.org/0000-0001-1111-1111"
          }
        ]
      },
      {
        ...response().results[0],
        id:
          "crossref:10.1000/y",
        title:
          "Obra Y",
        authors: [
          {
            name:
              "Persona Dos",
            id:
              "https://openalex.org/A999",
            orcid:
              "https://orcid.org/0000-0002-2222-2222"
          }
        ]
      },
      {
        ...response().results[0],
        id:
          "crossref:10.1000/z",
        title:
          "Obra Z",
        authors: [
          {
            name:
              "Persona Ambigua",
            id:
              "https://openalex.org/A999"
          }
        ]
      }
    ]
  };

  const built =
    buildResearchAtlasIdentityAuthorityGraph(
      conflicted
    );

  assert.deepEqual(
    built.diagnostics
      .conflictingOpenAlexIds,
    ["999"]
  );

  assert.equal(
    built.authorityGraph
      .identifierRegistry[
        "openalex-author:999"
      ],
    undefined
  );

  assert.equal(
    built.authorityGraph
      .authorities.length,
    2
  );

  assert.equal(
    built.diagnostics
      .unresolvedConflicts,
    1
  );
});


test("RA13 no altera la topología Work-first de similitud documental", () => {
  const input =
    response();

  const base =
    addResearchAtlasDocumentSimilarity(
      buildResearchAtlasSnapshot(
        input,
        {
          filters: {},
          sourceRevisions: {
            fixture:
              "ra13-base"
          }
        }
      )
    );

  const enriched =
    addResearchAtlasDocumentSimilarity(
      new ResearchAtlasAssembler({
        dynamicIdentity:
          true,
        filters: {},
        sourceRevisions: {
          fixture:
            "ra13-base"
        }
      }).ingest(
        input
      )
    );

  const workEdges = snapshot =>
    snapshot.edges
      .filter(edge =>
        [
          "lexical-neighbor",
          "semantic-neighbor"
        ].includes(
          edge.type
        )
      )
      .map(edge => ({
        type:
          edge.type,
        fromRef:
          edge.fromRef,
        toRef:
          edge.toRef
      }))
      .sort((left, right) =>
        JSON.stringify(left)
          .localeCompare(
            JSON.stringify(right)
          )
      );

  assert.deepEqual(
    workEdges(enriched),
    workEdges(base)
  );
});
