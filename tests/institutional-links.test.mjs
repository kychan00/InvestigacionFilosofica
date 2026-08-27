import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInstitutionalLinks
} from "../src/core/institutional-links.js";


test(
  "genera búsqueda institucional UdeG",
  () => {
    const links =
      buildInstitutionalLinks({
        title:
          "Critique of Pure Reason",

        authors: [
          {
            name:
              "Immanuel Kant"
          }
        ],

        doi:
          null
      });


    assert.equal(
      links.length,
      1
    );


    assert.equal(
      links[0].id,
      "udeg-summon"
    );


    assert.equal(
      links[0].query,
      "Critique of Pure Reason Immanuel Kant"
    );


    assert.ok(
      links[0].url.includes(
        "bibliotecaudg-summon-serialssolutions-com.wdg.biblio.udg.mx"
      )
    );


    assert.ok(
      links[0].url.includes(
        "Critique%20of%20Pure%20Reason%20Immanuel%20Kant"
      )
    );


    /*
     * No debemos conservar parámetros
     * de estado observados en una sesión.
     */
    assert.equal(
      links[0].url.includes(
        "SummGdw232714"
      ),
      false
    );
  }
);
