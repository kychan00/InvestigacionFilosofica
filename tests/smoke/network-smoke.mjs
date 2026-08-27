import test from "node:test";
import assert from "node:assert/strict";

import {
  searchOpenAlex
} from "../../src/sources/openalex.js";

import {
  searchCrossref
} from "../../src/sources/crossref.js";


const expansion = {
  query:
    "Immanuel Kant freedom",

  weight:
    1,

  type:
    "smoke"
};


test(
  "OpenAlex responde",
  {
    timeout: 15000
  },
  async () => {
    const results =
      await searchOpenAlex(
        expansion,
        {
          perPage: 2
        }
      );

    assert.ok(
      Array.isArray(results)
    );

    assert.ok(
      results.length > 0
    );

    assert.ok(
      results[0].title
    );
  }
);


test(
  "Crossref responde",
  {
    timeout: 15000
  },
  async () => {
    const results =
      await searchCrossref(
        expansion,
        {
          rows: 2
        }
      );

    assert.ok(
      Array.isArray(results)
    );

    assert.ok(
      results.length > 0
    );

    assert.ok(
      results[0].title
    );
  }
);
