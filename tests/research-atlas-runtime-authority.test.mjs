import assert from "node:assert/strict";
import test from "node:test";

import {
  ResearchAtlasAssembler
} from "../src/core/research-atlas-assembler.js";

import {
  buildResearchAtlasRuntimeAuthorityGraph
} from "../src/core/research-atlas-runtime-authority.js";


function author(
  id,
  name,
  orcid = null
) {
  return {
    id,
    name,
    orcid
  };
}


function result(
  workId,
  title,
  authors
) {
  return {
    id:
      "https://openalex.org/" +
      workId,
    openalexId:
      workId,
    title,
    authors,
    year:
      2020,
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
          "https://openalex.org/" +
          workId,
        query:
          "authority runtime"
      }
    ],
    matchedQueries: [
      {
        query:
          "authority runtime",
        weight:
          1,
        type:
          "original"
      }
    ],
    urls: {
      canonical:
        "https://openalex.org/" +
        workId
    },
    institutionalLinks: []
  };
}


function response(
  results
) {
  return {
    query:
      "authority runtime",
    parsed: {},
    expansions: [],
    results,
    errors: [],
    stats: {
      appearances:
        results.length,
      unique:
        results.length,
      merged:
        0,
      providers: {
        "OpenAlex Philosophy":
          results.length
      }
    }
  };
}


test("RA10 confirma AuthorityPerson sólo con identificador fuerte", () => {
  const searchResponse =
    response([
      result(
        "W100",
        "First work",
        [
          author(
            "https://openalex.org/A123",
            "Ada Example"
          )
        ]
      ),
      result(
        "W200",
        "Second work",
        [
          author(
            "https://openalex.org/A123",
            "Ada Example"
          )
        ]
      )
    ]);

  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      searchResponse
    );

  assert.equal(
    graph.authorities.length,
    1
  );

  assert.ok(
    graph.identifierRegistry[
      "openalex-author:123"
    ]
  );

  const assembler =
    new ResearchAtlasAssembler({
      authorityGraph:
        graph
    });

  const snapshot =
    assembler.ingest(
      searchResponse
    );

  assert.equal(
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
        "authority-person"
    ).length,
    1
  );

  assert.equal(
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "contribution"
    ).length,
    2
  );

  assert.equal(
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "same-author"
    ).length,
    1
  );
});


test("mismo nombre con OpenAlex Author IDs distintos permanece separado", () => {
  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      response([
        result(
          "W100",
          "Homonym one",
          [
            author(
              "https://openalex.org/A111",
              "José Martínez"
            )
          ]
        ),
        result(
          "W200",
          "Homonym two",
          [
            author(
              "https://openalex.org/A222",
              "José Martínez"
            )
          ]
        )
      ])
    );

  assert.equal(
    graph.authorities.length,
    2
  );

  assert.notEqual(
    graph.identifierRegistry[
      "openalex-author:111"
    ],
    graph.identifierRegistry[
      "openalex-author:222"
    ]
  );
});


test("OpenAlex IDs distintos con el mismo ORCID convergen a una AuthorityPerson", () => {
  const orcid =
    "0000-0002-1825-0097";

  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      response([
        result(
          "W100",
          "Alias one",
          [
            author(
              "https://openalex.org/A111",
              "A. Example",
              orcid
            )
          ]
        ),
        result(
          "W200",
          "Alias two",
          [
            author(
              "https://openalex.org/A222",
              "Ada Example",
              orcid
            )
          ]
        )
      ])
    );

  assert.equal(
    graph.authorities.length,
    1
  );

  const authorityRef =
    graph.identifierRegistry[
      "orcid:" +
      orcid
    ];

  assert.equal(
    graph.identifierRegistry[
      "openalex-author:111"
    ],
    authorityRef
  );

  assert.equal(
    graph.identifierRegistry[
      "openalex-author:222"
    ],
    authorityRef
  );
});


test("ORCID contradictorios para el mismo OpenAlex ID bloquean promoción", () => {
  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      response([
        result(
          "W100",
          "Conflict one",
          [
            author(
              "https://openalex.org/A333",
              "Conflict Author",
              "0000-0002-1825-0097"
            )
          ]
        ),
        result(
          "W200",
          "Conflict two",
          [
            author(
              "https://openalex.org/A333",
              "Conflict Author",
              "0000-0003-1415-926X"
            )
          ]
        )
      ])
    );

  assert.equal(
    graph.authorities.length,
    0
  );

  assert.equal(
    graph.runtimeDiagnostics
      .conflicts
      .length,
    1
  );
});


test("nombre sin OpenAlex ID ni ORCID nunca se promueve a AuthorityPerson", () => {
  const searchResponse =
    response([
      result(
        "W100",
        "Name only",
        [
          {
            name:
              "José Martínez"
          }
        ]
      )
    ]);

  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      searchResponse
    );

  assert.equal(
    graph.authorities.length,
    0
  );

  const assembler =
    new ResearchAtlasAssembler({
      authorityGraph:
        graph
    });

  const snapshot =
    assembler.ingest(
      searchResponse
    );

  assert.equal(
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
        "authority-person"
    ).length,
    0
  );

  assert.equal(
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
        "author-mention"
    ).length,
    1
  );
});


test("coautoría sólo aparece entre AuthorityPerson confirmadas", () => {
  const searchResponse =
    response([
      result(
        "W100",
        "Joint work",
        [
          author(
            "https://openalex.org/A123",
            "Ada Example"
          ),
          author(
            "https://openalex.org/A456",
            "Bruno Example"
          )
        ]
      )
    ]);

  const graph =
    buildResearchAtlasRuntimeAuthorityGraph(
      searchResponse
    );

  const snapshot =
    new ResearchAtlasAssembler({
      authorityGraph:
        graph
    })
      .ingest(
        searchResponse
      );

  assert.equal(
    snapshot.edges.filter(
      edge =>
        edge.type ===
        "coauthor"
    ).length,
    1
  );
});
