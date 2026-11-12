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


    const journals =
      new Set(
        records.map(
          record =>
            record.journal
        )
      );


    assert.ok(
      journals.has(
        "Protrepsis"
      )
    );


    assert.ok(
      journals.has(
        "Quadripartita Ratio"
      )
    );


    assert.equal(
      [...journals].every(
        journal =>
          [
            "Protrepsis",
            "Quadripartita Ratio",
            "Sincronía"
          ].includes(
            journal
          )
      ),
      true
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
  "normaliza disponibilidad histórica y referencia bibliográfica de Sincronía",
  () => {
    const source = {
      id: "cucsh:sincronia:test",
      sourceId: "legacy:test",
      journal: "Sincronía",
      issueNumber: 12,
      title: "Artículo histórico",
      titleVariants: ["Artículo histórico"],
      authors: [{ name: "Autora Prueba" }],
      year: 1999,
      type: "journal-article",
      legacyOriginal: true,
      legacyAccessStatus: {
        status: "original-page-unavailable",
        originalUrl: "http://sincronia.cucsh.udg.mx/test.htm",
        auditRunId: 123,
        reason: "timeout",
        archiveAvailable: false
      },
      legacyTitleEncodingEvidence: {
        sourceUrl: "https://dialnet.unirioja.es/ejemplar/123"
      },
      urls: {
        canonical: "http://sincronia.cucsh.udg.mx/test.htm",
        relations: []
      }
    };

    const result = normalizeCucshRecord(source);

    assert.equal(
      result.sourceAvailability.status,
      "original-page-unavailable"
    );

    assert.equal(
      result.sourceRecords[0].accessStatus.status,
      "original-page-unavailable"
    );

    assert.equal(
      result.urls.reference,
      "https://dialnet.unirioja.es/ejemplar/123"
    );

    assert.equal(
      result.urls.canonical,
      "http://sincronia.cucsh.udg.mx/test.htm"
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


test(
  "Sincronía 1–90 contiene sólo artículos verificables, sin formularios",
  () => {
    const sincronia = records.filter(
      record => record.journal === "Sincronía"
    );
    assert.ok(sincronia.length >= 1450);
    const issues = new Set(
      sincronia.map(record => record.issueNumber)
    );
    for (let issue = 1; issue <= 90; issue++) {
      assert.ok(issues.has(issue), `Sincronía issue ${issue} missing`);
    }
    assert.ok(
      sincronia.every(
        record => Number.isInteger(record.issueNumber) &&
          record.issueNumber >= 1 && record.issueNumber <= 90
      )
    );
    assert.ok(sincronia.every(record => record.title && record.id));
    assert.ok(
      sincronia.filter(record => record.issueNumber === 44).length >= 10,
      "Issue 44 must retain its ten source-verified records"
    );

    assert.equal(
      sincronia.filter(
        record => /^declaraci[oó]n de (?:coautor[ií]a|autor[ií]a individual)$/i.test(record.title)
      ).length,
      0
    );
  }
);

test(
  "la búsqueda local recupera Sincronía histórica y moderna",
  () => {
    const sincronia = records.filter(
      record => record.journal === "Sincronía"
    );
    const historical = sincronia.find(
      record => record.issueNumber === 49 &&
        /filosof[ií]a de la ense[nñ]anza/i.test(record.title)
    );
    const historical44 = sincronia.find(
      record => record.issueNumber === 44 &&
        record.title === "Génesis de un personaje teatral"
    );
    const modern = sincronia.find(
      record => record.issueNumber === 90 && record.title?.length > 20
    );
    assert.ok(historical, "Missing Sincronía issue 49 philosophy article");
    assert.ok(historical44, "Missing Sincronía issue 44 historical article");
    assert.ok(modern, "Missing Sincronía issue 90 article");

    for (const record of [historical, historical44, modern]) {
      const results = searchCucshRecords(
        records,
        record.title,
        { rows: 40 }
      );
      assert.ok(
        results.some(result => result.journal === "Sincronía"),
        `Search did not recover Sincronía issue ${record.issueNumber}`
      );
    }
  }
);


test(
  "las 41 reparaciones originales conservan títulos legibles y se pueden buscar",
  () => {
    const sincronia = records.filter(record => record.journal === "Sincronía");
    const repaired = sincronia.filter(
      record => record.legacyTitleEncodingEvidence?.auditRunId === 43032349081
    );
    assert.equal(repaired.length, 41);
    assert.ok(repaired.every(record => !record.title.includes("\ufffd")));
    for (const title of [
      "Análisis del argumento del sueño en la primera meditación de Descartes",
      "La pérdida y el olvido de la memoria en el cuento Estoy rezando por tu salvación"
    ]) {
      assert.ok(repaired.some(record => record.title === title));
      const results = searchCucshRecords(records, title, { rows: 80 });
      assert.ok(
        results.some(record => record.title === title && record.journal === "Sincronía"),
        `Sincronía missing restored title: ${title}`
      );
    }
  }
);
