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

import {
  rankResults
} from "./src/core/rank.js";


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

for (const group of groups) {
  if (
    group.status ===
    "fulfilled"
  ) {
    raw.push(
      ...group.value
    );
  }
}


const merged =
  mergeResults(raw);


const ranked =
  rankResults(
    merged,
    parsed,
    map
  );


console.log(
  "\nCONSULTA:",
  userQuery
);

console.log(
  "APARICIONES:",
  raw.length
);

console.log(
  "ÚNICOS:",
  merged.length
);

console.log(
  "\nTOP 20:"
);


for (
  let i = 0;
  i <
    Math.min(
      20,
      ranked.length
    );
  i++
) {
  const item =
    ranked[i];

  console.log(
    `\n${i + 1}.`,
    `[${item.relevanceLevel}]`,
    `${item.relevanceScore}/100`,
    item.title
  );

  console.log(
    "   Q/P/S/B/I/PEN:",
    [
      item.ranking.query,
      item.ranking.philosophy,
      item.ranking.consensus,
      item.ranking.bibliography,
      item.ranking.impact,
      item.ranking.penalty
    ].join("/")
  );

  console.log(
    "   consultas:",
    item.matchedQueries.length
  );

  console.log(
    "   citas:",
    item.citedBy ?? "—"
  );

  console.log(
    "   DOI:",
    item.doi || "—"
  );
}
