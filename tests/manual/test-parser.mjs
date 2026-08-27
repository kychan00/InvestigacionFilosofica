import fs from "node:fs";

import {
  parseQuery
} from "./src/core/parser.js";

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
  "problema mente cuerpo Descartes",
  "justicia Rawls",
  "Ser y tiempo Heidegger",
  "Crítica de la razón pura",
  "libre albedrío y determinismo"
];

for (const query of tests) {
  const result = parseQuery(query, map);

  console.log("\n================================");
  console.log("QUERY:", query);
  console.log("IDIOMA:", result.language);

  console.log(
    "FILÓSOFOS:",
    result.philosophers.map(x => x.name)
  );

  console.log(
    "CONCEPTOS:",
    result.concepts.map(
      x => `${x.id} (${x.matched})`
    )
  );

  console.log(
    "OBRAS:",
    result.works.map(
      x => x.canonicalTitle
    )
  );

  console.log(
    "ÁREAS:",
    result.areas.map(
      x =>
        `${x.id}:${x.confidence.toFixed(2)}`
    )
  );
}
