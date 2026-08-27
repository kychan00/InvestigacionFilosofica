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
      2
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


    assert.ok(summon);
    assert.ok(ebook);


    assert.equal(
      summon.query,
      "Critique of Pure Reason Immanuel Kant"
    );


    assert.equal(
      ebook.query,
      "Critique of Pure Reason Immanuel Kant"
    );


    assert.match(
      ebook.url,
      /ebookcentral-proquest-com\.wdg\.biblio\.udg\.mx/
    );


    assert.match(
      ebook.url,
      /query=Critique%20of%20Pure%20Reason%20Immanuel%20Kant/
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
