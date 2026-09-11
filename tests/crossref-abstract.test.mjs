import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCrossrefWork
} from "../src/sources/crossref.js";


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
