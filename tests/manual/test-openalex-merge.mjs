import fs from "node:fs";

import {
  parseQuery
} from "./src/core/parser.js";

import {
  expandQuery
} from "./src/core/expander.js";

import {
  searchOpenAlex
} from "./src/sources/openalex.js";

import {
  mergeResults
} from "./src/core/merge-results.js";


const map = JSON.parse(
  fs.readFileSync(
    new URL(
      "./src/data/philosophy-map.json",
      import.meta.url
    ),
    "utf8"
  )
);


const userQuery =
  process.argv
    .slice(2)
    .join(" ")
    .trim()
  ||
  "libertad en Kant";


const parsed =
  parseQuery(
    userQuery,
    map
  );


const expansions =
  expandQuery(
    parsed,
    map,
    {
      maxQueries: 5
    }
  );


console.log(
  "\nCONSULTA:",
  userQuery
);


console.log(
  "\nEXPANSIONES:"
);

for (const item of expansions) {
  console.log(
    item.weight.toFixed(2),
    item.type.padEnd(12),
    item.query
  );
}


const groups =
  await Promise.allSettled(
    expansions.map(
      expansion =>
        searchOpenAlex(
          expansion,
          {
            perPage: 10
          }
        )
    )
  );


const raw = [];
const errors = [];


for (
  let i = 0;
  i < groups.length;
  i++
) {
  const group =
    groups[i];

  if (
    group.status ===
    "fulfilled"
  ) {
    raw.push(
      ...group.value
    );
  } else {
    errors.push({
      query:
        expansions[i].query,

      error:
        group.reason?.message ||
        String(group.reason)
    });
  }
}


const merged =
  mergeResults(raw);


console.log(
  "\nAPARICIONES:",
  raw.length
);

console.log(
  "RESULTADOS ÚNICOS:",
  merged.length
);

console.log(
  "DUPLICADOS FUSIONADOS:",
  raw.length - merged.length
);


if (errors.length) {
  console.log(
    "\nERRORES:"
  );

  for (const error of errors) {
    console.log(
      "-",
      error.query,
      "→",
      error.error
    );
  }
}


const multiQuery =
  merged
    .filter(
      item =>
        item.matchedQueries.length > 1
    )
    .sort(
      (a, b) =>
        b.matchedQueries.length -
        a.matchedQueries.length
    );


console.log(
  "\nENCONTRADOS POR VARIAS CONSULTAS:"
);


for (
  const item of
  multiQuery.slice(0, 15)
) {
  console.log(
    "\n",
    item.title
  );

  console.log(
    "  DOI:",
    item.doi || "—"
  );

  console.log(
    "  consultas:",
    item.matchedQueries.length
  );

  for (
    const match of
    item.matchedQueries
  ) {
    console.log(
      "   -",
      match.weight?.toFixed(2),
      match.query
    );
  }
}
