import fs from "node:fs";

import {
  parseQuery
} from "./src/core/parser.js";

import {
  expandQuery
} from "./src/core/expander.js";

const map = JSON.parse(
  fs.readFileSync(
    new URL(
      "./src/data/philosophy-map.json",
      import.meta.url
    ),
    "utf8"
  )
);

const tests = [
  "libertad en Kant",
  "epistemología de Hume",
  "justicia Rawls",
  "problema mente cuerpo Descartes",
  "Crítica de la razón pura",
  "libre albedrío y determinismo"
];

for (const query of tests) {
  const parsed = parseQuery(
    query,
    map
  );

  const expanded = expandQuery(
    parsed,
    map
  );

  console.log(
    "\n================================"
  );

  console.log(
    "QUERY:",
    query
  );

  for (const item of expanded) {
    console.log(
      item.weight.toFixed(2),
      item.type.padEnd(12),
      item.query,
      `[${item.reason}]`
    );
  }
}
