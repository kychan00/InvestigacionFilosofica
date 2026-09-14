import test from "node:test";

import assert from "node:assert/strict";

import {
  readFile
} from "node:fs/promises";


import {
  cucshRetrievalScore,
  normalizeCucshRecord,
  searchCucshRecords
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


const records =
  dataset.records;


test(
  "snapshot CUCSH contiene el corpus filtrado esperado",
  () => {
    assert.equal(
      dataset.provider,
      "CUCSH Filosofía"
    );

    assert.ok(
      records.length >= 391
    );


    assert.ok(
      records.filter(
        record =>
          record.journal ===
          "Quadripartita Ratio"
      ).length >= 88
    );


    assert.ok(
      records.filter(
        record =>
          record.journal ===
          "Protrepsis"
      ).length >= 303
    );


    assert.deepEqual(
      [
        ...new Set(
          records.map(
            record =>
              record.journal
          )
        )
      ].sort(),
      [
        "Protrepsis",
        "Quadripartita Ratio"
      ]
    );
  }
);


test(
  "encuentra el artículo de Frankfurt sin DOI",
  () => {
    const results =
      searchCucshRecords(
        records,
        {
          query:
            "Escuela de Frankfurt",

          weight:
            1,

          type:
            "original"
        },
        {
          rows:
            5
        }
      );


    const result =
      results.find(
        item =>
          item.title ===
          "La Escuela de Frankfurt: Un entramado de disonancias"
      );


    assert.ok(
      result
    );

    assert.equal(
      result.doi,
      null
    );

    assert.deepEqual(
      result.providers,
      [
        "CUCSH Filosofía"
      ]
    );

    assert.equal(
      result.journal,
      "Protrepsis"
    );
  }
);


test(
  "busca también sobre variantes bilingües de título",
  () => {
    const results =
      searchCucshRecords(
        records,
        {
          query:
            "argumentation in philosophy",

          weight:
            0.9,

          type:
            "translation"
        },
        {
          rows:
            10
        }
      );


    assert.ok(
      results.some(
        item =>
          item.journal ===
            "Quadripartita Ratio" &&
          /argumentación en filosofía/i
            .test(
              item.title
            )
      )
    );
  }
);


test(
  "DOI exacto recupera el registro CUCSH",
  () => {
    const results =
      searchCucshRecords(
        records,
        "10.32870/qr.v10i19.187",
        {
          rows:
            3
        }
      );


    assert.ok(
      results.length >= 1
    );

    assert.equal(
      results[0].doi,
      "10.32870/qr.v10i19.187"
    );

    assert.equal(
      results[0].journal,
      "Quadripartita Ratio"
    );
  }
);


test(
  "normaliza al contrato federado",
  () => {
    const source =
      records.find(
        record =>
          record.doi ===
          "10.32870/qr.v10i19.187"
      );


    assert.ok(
      source
    );


    const result =
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


    assert.equal(
      result.providers[0],
      "CUCSH Filosofía"
    );

    assert.equal(
      result.sourceRecords[0]
        .provider,
      "CUCSH Filosofía"
    );

    assert.equal(
      result.sourceRecords[0]
        .journal,
      "Quadripartita Ratio"
    );

    assert.equal(
      result.urls.doi,
      "https://doi.org/10.32870/qr.v10i19.187"
    );

    assert.ok(
      Array.isArray(
        result.authors
      )
    );

    assert.ok(
      Array.isArray(
        result.topics
      )
    );

    assert.ok(
      Array.isArray(
        result.matchedQueries
      )
    );

    assert.ok(
      Array.isArray(
        result.institutionalLinks
      )
    );
  }
);


test(
  "paginación local no repite resultados",
  () => {
    const page1 =
      searchCucshRecords(
        records,
        "filosofía",
        {
          rows:
            5,

          page:
            1
        }
      );


    const page2 =
      searchCucshRecords(
        records,
        "filosofía",
        {
          rows:
            5,

          page:
            2
        }
      );


    assert.equal(
      page1.length,
      5
    );

    assert.equal(
      page2.length,
      5
    );


    const firstIds =
      new Set(
        page1.map(
          item =>
            item.id
        )
      );


    assert.equal(
      page2.some(
        item =>
          firstIds.has(
            item.id
          )
      ),
      false
    );
  }
);



test(
  "no confunde ética con estética ni erotética",
  () => {
    const aesthetic = {
      title:
        "Educación estética y pensamiento crítico",

      titleVariants: [],
      authors: [],
      subjects: [],
      abstract: null,
      abstractVariants: [],
      bibliographicSources: [],
      journal:
        "Quadripartita Ratio",
      publisher: null,
      doi: null
    };


    const erotetic = {
      title:
        "Presuposición erotética y argumentación",

      titleVariants: [],
      authors: [],
      subjects: [],
      abstract: null,
      abstractVariants: [],
      bibliographicSources: [],
      journal:
        "Quadripartita Ratio",
      publisher: null,
      doi: null
    };


    const ethical = {
      title:
        "La ética en el Tractatus",

      titleVariants: [],
      authors: [],
      subjects: [],
      abstract: null,
      abstractVariants: [],
      bibliographicSources: [],
      journal:
        "Protrepsis",
      publisher: null,
      doi: null
    };


    assert.equal(
      cucshRetrievalScore(
        aesthetic,
        "ética"
      ),
      0
    );


    assert.equal(
      cucshRetrievalScore(
        erotetic,
        "ética"
      ),
      0
    );


    assert.ok(
      cucshRetrievalScore(
        ethical,
        "ética"
      ) > 0
    );
  }
);


test(
  "Kant recupera títulos con kantiano",
  () => {
    const record = {
      title:
        "El ideal formativo kantiano",

      titleVariants: [],
      authors: [],
      subjects: [],
      abstract: null,
      abstractVariants: [],
      bibliographicSources: [],
      journal:
        "Protrepsis",
      publisher: null,
      doi: null
    };


    assert.ok(
      cucshRetrievalScore(
        record,
        "Kant"
      ) > 0
    );
  }
);
