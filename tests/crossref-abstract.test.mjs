import test from "node:test";
import assert from "node:assert/strict";

import {
  crossrefQueryField,
  isEligibleCrossrefWork,
  normalizeCrossrefWork
} from "../src/sources/crossref.js";


test(
  "descarta revistas, fascículos y registros sin título",
  () => {
    assert.equal(
      isEligibleCrossrefWork({
        type: "journal-issue",
        "container-title": [
          "TECNOCIENCIA Chihuahua"
        ]
      }),
      false
    );

    assert.equal(
      isEligibleCrossrefWork({
        type: "journal",
        title: [
          "TECNOCIENCIA CHIHUAHUA"
        ]
      }),
      false
    );

    assert.equal(
      isEligibleCrossrefWork({
        type: "journal-article",
        title: []
      }),
      false
    );
  }
);


test(
  "conserva obras reales aunque compartan nombre con una revista",
  () => {
    assert.equal(
      isEligibleCrossrefWork({
        type: "journal-article",
        title: [
          "Tecnociencia, entorno y sujeto tecnocientífico"
        ],
        "container-title": [
          "Eikasía Revista de Filosofía"
        ]
      }),
      true
    );
  }
);


test(
  "conserva autoría en consulta libre y usa campos precisos cuando se conoce la intención",
  () => {
    assert.equal(
      crossrefQueryField("original"),
      "query.bibliographic"
    );

    assert.equal(
      crossrefQueryField("author"),
      "query.author"
    );

    assert.equal(
      crossrefQueryField("work"),
      "query.title"
    );
  }
);


test(
  "limpia JATS/XML del abstract de Crossref",
  () => {
    const work =
      normalizeCrossrefWork({
        DOI:
          "10.1234/prueba",

        title: [
          "Razón y libertad"
        ],

        abstract:
          "<jats:p>El artículo analiza " +
          "<jats:italic>razón &amp; libertad</jats:italic> " +
          "en Kant.</jats:p>"
      });


    assert.equal(
      work.abstract,
      "El artículo analiza razón & libertad en Kant."
    );


    assert.doesNotMatch(
      work.abstract,
      /jats:|<[^>]*>/
    );
  }
);


test(
  "limpia JATS codificado como entidades",
  () => {
    const work =
      normalizeCrossrefWork({
        DOI:
          "10.1234/prueba2",

        title: [
          "Libertad"
        ],

        abstract:
          "&lt;jats:p&gt;" +
          "Libertad &amp; razón." +
          "&lt;/jats:p&gt;"
      });


    assert.equal(
      work.abstract,
      "Libertad & razón."
    );
  }
);


test(
  "limpia HTML/JATS del título de Crossref",
  () => {
    const work =
      normalizeCrossrefWork({
        DOI:
          "10.1234/titulo-markup",

        title: [
          "<i>L'Infinito nel pensiero dei Greci</i>. " +
          "Rodolfo Mondolfo"
        ]
      });


    assert.equal(
      work.title,
      "L'Infinito nel pensiero dei Greci. Rodolfo Mondolfo"
    );


    assert.doesNotMatch(
      work.title,
      /<[^>]*>|&lt;|&gt;/
    );
  }
);


test(
  "limpia HTML codificado como entidades del título",
  () => {
    const work =
      normalizeCrossrefWork({
        DOI:
          "10.1234/titulo-entidades",

        title: [
          "&lt;i&gt;Ética &amp; libertad&lt;/i&gt;"
        ]
      });


    assert.equal(
      work.title,
      "Ética & libertad"
    );
  }
);


test(
  "decodifica entidades HTML nombradas en abstract de Crossref",
  () => {
    const work =
      normalizeCrossrefWork({
        DOI:
          "10.1234/entidades-espanol",

        title: [
          "Excluidos de la felicidad"
        ],

        abstract:
          "<jats:p>" +
          "La sociedad moderna comenz&oacute; " +
          "su andadura con la promesa de alcanzar " +
          "la mayor felicidad para el mayor " +
          "n&uacute;mero. Arist&oacute;teles " +
          "consider&oacute; la felicidad un bien." +
          "</jats:p>"
      });


    assert.equal(
      work.abstract,
      "La sociedad moderna comenzó " +
      "su andadura con la promesa de alcanzar " +
      "la mayor felicidad para el mayor " +
      "número. Aristóteles " +
      "consideró la felicidad un bien."
    );


    assert.doesNotMatch(
      work.abstract,
      /&[a-z0-9#]+;/i
    );
  }
);


test(
  "decodifica entidades HTML doblemente codificadas",
  () => {
    const work =
      normalizeCrossrefWork({
        DOI:
          "10.1234/entidades-dobles",

        title: [
          "Ética"
        ],

        abstract:
          "La posici&amp;oacute;n " +
          "tambi&amp;eacute;n es filos&amp;oacute;fica."
      });


    assert.equal(
      work.abstract,
      "La posición también es filosófica."
    );
  }
);
