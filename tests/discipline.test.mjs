import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  parseQuery
} from "../src/core/parser.js";

import {
  disciplineScore
} from "../src/core/discipline.js";


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


const parsed =
  parseQuery(
    "libre albedrío y determinismo",
    philosophyMap
  );


test(
  "trabajo filosófico obtiene D alto",
  () => {
    const result = {
      title:
        "Free Will and Determinism",

      journal:
        "Philosophical Studies",

      topics: [
        {
          name:
            "Philosophical Ethics and Theory"
        },
        {
          name:
            "Free Will and Agency"
        }
      ]
    };


    const discipline =
      disciplineScore(
        result,
        parsed,
        philosophyMap
      );


    assert.ok(
      discipline.score >= 0.70
    );
  }
);


test(
  "trabajo médico obtiene D bajo",
  () => {
    const result = {
      title:
        "Determinism and obesity",

      journal:
        "Journal of Clinical Medicine",

      topics: [
        {
          name:
            "Health and Lifestyle Studies"
        },
        {
          name:
            "Medical Research"
        }
      ]
    };


    const discipline =
      disciplineScore(
        result,
        parsed,
        philosophyMap
      );


    assert.ok(
      discipline.score <= 0.30
    );
  }
);
