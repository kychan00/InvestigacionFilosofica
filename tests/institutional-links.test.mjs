import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInstitutionalLinks
} from "../src/core/institutional-links.js";


test(
  "genera búsquedas institucionales UdeG",
  () => {
    const item = {
      title:
        "Critique of Pure Reason",

      language:
        "en",

      authors: [
        {
          name:
            "Immanuel Kant"
        }
      ]
    };


    const links =
      buildInstitutionalLinks(
        item
      );


    assert.equal(
      links.length,
      3
    );


    const summon =
      links.find(
        item =>
          item.id ===
          "udeg-summon"
      );

    const ebook =
      links.find(
        item =>
          item.id ===
          "ebook-central"
      );

    const britannica =
      links.find(
        item =>
          item.id ===
          "britannica-udeg"
      );


    assert.ok(summon);
    assert.ok(ebook);
    assert.ok(britannica);


    assert.equal(
      summon.query,
      "Critique of Pure Reason Immanuel Kant"
    );


    assert.equal(
      ebook.query,
      "Critique of Pure Reason Immanuel Kant"
    );


    assert.equal(
      britannica.query,
      "Critique of Pure Reason"
    );


    assert.match(
      ebook.url,
      /ebookcentral-proquest-com\.wdg\.biblio\.udg\.mx/
    );


    assert.match(
      britannica.url,
      /academic-eb-com\.wdg\.biblio\.udg\.mx/
    );


    assert.match(
      britannica.url,
      /query=Critique%20of%20Pure%20Reason/
    );


    assert.doesNotMatch(
      britannica.url,
      /Immanuel%20Kant/
    );


    assert.doesNotMatch(
      ebook.url,
      /pageNo=/
    );


    assert.doesNotMatch(
      ebook.url,
      /pageSize=/
    );
  }
);


test(
  "Britannica se oculta para registros en español",
  () => {
    const links =
      buildInstitutionalLinks({
        title:
          "La crítica de la razón pura y la filosofía trascendental",

        language:
          "es",

        authors: [
          {
            name:
              "Immanuel Kant"
          }
        ]
      });


    assert.equal(
      links.some(
        link =>
          link.id ===
          "britannica-udeg"
      ),
      false
    );


    assert.equal(
      links.some(
        link =>
          link.id ===
          "udeg-summon"
      ),
      true
    );


    assert.equal(
      links.some(
        link =>
          link.id ===
          "ebook-central"
      ),
      true
    );
  }
);


test(
  "Aula sólo se ofrece para registros en español",
  () => {
    const spanishLinks =
      buildInstitutionalLinks({
        title:
          "La ética de la liberación",

        language:
          "es",

        authors: [
          {
            name:
              "Enrique Dussel"
          }
        ]
      });


    assert.equal(
      spanishLinks.some(
        link =>
          link.id === "aula"
      ),
      true
    );


    const englishLinks =
      buildInstitutionalLinks({
        title:
          "The Ethics of Liberation",

        language:
          "en",

        authors: [
          {
            name:
              "Enrique Dussel"
          }
        ]
      });


    assert.equal(
      englishLinks.some(
        link =>
          link.id === "aula"
      ),
      false
    );
  }
);
