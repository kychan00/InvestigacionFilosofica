import test, {
  after
} from "node:test";

import assert from "node:assert/strict";

import {
  readFile
} from "node:fs/promises";


import {
  searchPhilosophy,
  searchMorePhilosophy
} from "../src/core/search-engine.js";


import {
  mergeResults
} from "../src/core/merge-results.js";


import {
  normalizeCucshRecord
} from "../src/sources/cucsh-filosofia.js";


const DATA_URL =
  new URL(
    "../src/data/cucsh-filosofia.json",
    import.meta.url
  );


const dataset =
  JSON.parse(
    await readFile(
      DATA_URL,
      "utf8"
    )
  );


const philosophyMap = {
  philosophers: [],
  concepts: [],
  areas: [],
  works: []
};


const originalFetch =
  globalThis.fetch;


globalThis.fetch =
  async input => {
    const url =
      String(input);

    if (
      url.includes(
        "cucsh-filosofia.json"
      )
    ) {
      return new Response(
        JSON.stringify(
          dataset
        ),
        {
          status:
            200,

          headers: {
            "content-type":
              "application/json"
          }
        }
      );
    }

    throw new Error(
      `Unexpected network request: ${url}`
    );
  };


after(
  () => {
    globalThis.fetch =
      originalFetch;
  }
);


const cucshOnlyOptions = {
  maxQueries:
    1,

  delayBetweenExpansions:
    0,

  openAlexPhilosophy: {
    enabled:
      false
  },

  openAlex: {
    enabled:
      false
  },

  crossref: {
    enabled:
      false
  },

  internetArchive: {
    enabled:
      false
  },

  cucshFilosofia: {
    enabled:
      true,

    rows:
      3
  }
};


test(
  "CUCSH Filosofía participa en searchPhilosophy",
  async () => {
    const response =
      await searchPhilosophy(
        "ética",
        philosophyMap,
        cucshOnlyOptions
      );


    assert.equal(
      response.results.length,
      3
    );


    assert.equal(
      response.stats.providers[
        "CUCSH Filosofía"
      ],
      3
    );


    assert.ok(
      response.results.every(
        result =>
          result.providers.includes(
            "CUCSH Filosofía"
          )
      )
    );


    assert.ok(
      response.results.some(
        result =>
          /ética/i.test(
            result.title
          )
      )
    );
  }
);


test(
  "searchMorePhilosophy pagina CUCSH sin repetir la primera página",
  async () => {
    const first =
      await searchPhilosophy(
        "ética",
        philosophyMap,
        cucshOnlyOptions
      );


    const second =
      await searchMorePhilosophy(
        first,
        philosophyMap,
        cucshOnlyOptions
      );


    assert.equal(
      second.pagination.batch,
      2
    );


    assert.equal(
      second.pagination
        .newAppearances,
      3
    );


    assert.equal(
      second.results.length,
      6
    );


    assert.equal(
      second.stats.providers[
        "CUCSH Filosofía"
      ],
      6
    );


    const ids =
      second.results.map(
        result =>
          result.id
      );


    assert.equal(
      new Set(ids).size,
      ids.length
    );
  }
);


test(
  "CUCSH y Crossref se deduplican por DOI",
  () => {
    const source =
      dataset.records.find(
        record =>
          record.doi ===
          "10.32870/qr.v10i19.187"
      );


    assert.ok(
      source
    );


    const cucsh =
      normalizeCucshRecord(
        source,
        {
          query:
            "argumentación",

          queryWeight:
            1,

          queryType:
            "original",

          rank:
            1,

          retrievalScore:
            100
        }
      );


    const crossref = {
      id:
        "crossref:10.32870/qr.v10i19.187",

      title:
        source.title,

      authors:
        cucsh.authors,

      year:
        source.year,

      type:
        "journal-article",

      language:
        "es",

      doi:
        source.doi,

      isbn: [],

      journal:
        "Quadripartita Ratio",

      publisher:
        null,

      abstract:
        null,

      citedBy:
        null,

      openAccess:
        null,

      topics: [],

      philosophers: [],
      traditions: [],

      providers: [
        "Crossref"
      ],

      sourceRecords: [
        {
          provider:
            "Crossref",

          sourceId:
            source.doi,

          rank:
            1,

          query:
            "argumentación",

          queryWeight:
            1,

          queryType:
            "original"
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

      relevanceScore:
        0,

      relevanceLevel:
        null,

      metadataConfidence:
        0,

      urls: {
        canonical:
          `https://doi.org/${source.doi}`,

        doi:
          `https://doi.org/${source.doi}`,

        openAccess:
          null
      },

      institutionalLinks: []
    };


    const merged =
      mergeResults([
        cucsh,
        crossref
      ]);


    assert.equal(
      merged.length,
      1
    );


    assert.deepEqual(
      [...merged[0].providers]
        .sort(),
      [
        "CUCSH Filosofía",
        "Crossref"
      ].sort()
    );


    assert.equal(
      merged[0]
        .sourceRecords
        .length,
      2
    );


    assert.equal(
      merged[0].doi,
      "10.32870/qr.v10i19.187"
    );
  }
);
