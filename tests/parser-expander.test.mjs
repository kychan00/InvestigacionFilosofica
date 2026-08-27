import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  parseQuery
} from "../src/core/parser.js";

import {
  expandQuery
} from "../src/core/expander.js";


const philosophyMap =
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../src/data/philosophy-map.json",
        import.meta.url
      ),
      "utf8"
    )
  );


test(
  "detecta Kant + libertad",
  () => {
    const parsed =
      parseQuery(
        "libertad en Kant",
        philosophyMap
      );

    assert.equal(
      parsed.philosophers[0]?.id,
      "kant"
    );

    assert.ok(
      parsed.concepts.some(
        item =>
          item.id === "freedom"
      )
    );
  }
);


test(
  "detecta Ser y tiempo como obra",
  () => {
    const parsed =
      parseQuery(
        "Ser y tiempo Heidegger",
        philosophyMap
      );

    assert.ok(
      parsed.works.some(
        item =>
          item.id ===
          "heidegger_bt"
      )
    );
  }
);


test(
  "expande español a inglés",
  () => {
    const parsed =
      parseQuery(
        "epistemología de Hume",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 5
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query ===
          "David Hume Epistemology"
      )
    );
  }
);


test(
  "preserva contexto en consulta multi-concepto",
  () => {
    const parsed =
      parseQuery(
        "libre albedrío y determinismo",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query ===
          "Free will Determinism"
      )
    );

    assert.ok(
      expansions.some(
        item =>
          item.query.includes(
            "causal determinism"
          )
      )
    );
  }
);
