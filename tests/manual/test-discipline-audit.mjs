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


const philosophyMap = JSON.parse(
  fs.readFileSync(
    new URL(
      "./src/data/philosophy-map.json",
      import.meta.url
    ),
    "utf8"
  )
);


const queries = [
  "problema mente cuerpo Descartes",
  "libre albedrío y determinismo"
];


function sleep(ms) {
  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}


for (const userQuery of queries) {
  console.log(
    "\n\n=================================================="
  );

  console.log(
    "AUDITORÍA:",
    userQuery
  );

  console.log(
    "=================================================="
  );


  const parsed =
    parseQuery(
      userQuery,
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


  const raw = [];


  for (const expansion of expansions) {
    try {
      const results =
        await searchOpenAlex(
          expansion,
          {
            perPage: 8
          }
        );

      raw.push(
        ...results
      );
    } catch (error) {
      console.error(
        "ERROR:",
        expansion.query,
        error.message
      );
    }

    await sleep(500);
  }


  const merged =
    mergeResults(raw);


  const ranked =
    rankResults(
      merged,
      parsed,
      philosophyMap
    );


  for (
    let i = 0;
    i < Math.min(15, ranked.length);
    i++
  ) {
    const item =
      ranked[i];

    console.log(
      `\n${i + 1}.`,
      `${item.relevanceScore}/100`,
      item.title
    );

    console.log(
      "   D:",
      item.ranking.discipline
    );

    console.log(
      "   D details:",
      JSON.stringify(
        item.ranking.disciplineDetails
      )
    );

    console.log(
      "   journal:",
      item.journal || "—"
    );

    console.log(
      "   type:",
      item.type || "—"
    );

    console.log(
      "   topics:"
    );

    const topics =
      (item.topics || [])
        .slice(0, 8);

    if (!topics.length) {
      console.log(
        "      —"
      );
    }

    for (const topic of topics) {
      console.log(
        "      -",
        topic.name
      );
    }
  }
}
